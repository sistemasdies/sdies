"""Copia y restauración de la base de datos PostgreSQL.

Se apoya en los binarios oficiales ``pg_dump`` y ``psql``. La versión del
cliente debe ser igual o superior a la del servidor: producción corre
PostgreSQL 18, por eso el Dockerfile instala ``postgresql-client-18``.

La copia se genera en formato SQL plano con ``--clean --if-exists`` para que
pueda restaurarse sobre una base existente (por ejemplo, la local) sin tener
que borrarla manualmente. La restauración usa ``ON_ERROR_STOP`` para que un
error de SQL no se reporte como éxito.
"""
import glob
import gzip
import os
import shutil
import subprocess
import tempfile
import zipfile
import zlib

from django.conf import settings

TAMANO_BLOQUE = 1024 * 1024


class BackupError(Exception):
    """Error controlado del proceso de copia o restauración."""


def _texto(data, limite=4000):
    """Convierte la salida de un proceso a texto legible y acotado."""
    if isinstance(data, bytes):
        data = data.decode('utf-8', 'replace')
    data = (data or '').strip()
    return data[-limite:]


def _version(ruta):
    """Tupla numérica de la versión a partir de .../PostgreSQL/18/bin/..."""
    partes = os.path.normpath(ruta).split(os.sep)
    try:
        return tuple(int(x) for x in partes[-3].split('.'))
    except (IndexError, ValueError):
        return (0,)


def buscar_binario(nombre):
    """Localiza pg_dump/psql, incluso cuando no están en el PATH.

    En Windows la instalación oficial no agrega ``bin`` al PATH. Se puede
    forzar la carpeta con la variable de entorno ``PG_BIN``.
    """
    encontrado = shutil.which(nombre)
    if encontrado:
        return encontrado

    carpeta = os.environ.get('PG_BIN') or os.environ.get('POSTGRES_BIN')
    if carpeta:
        ruta = os.path.join(carpeta, f'{nombre}.exe' if os.name == 'nt' else nombre)
        if os.path.isfile(ruta):
            return ruta

    if os.name == 'nt':
        patrones = [
            rf'C:\Program Files\PostgreSQL\*\bin\{nombre}.exe',
            rf'C:\Program Files (x86)\PostgreSQL\*\bin\{nombre}.exe',
        ]
        candidatos = []
        for patron in patrones:
            candidatos.extend(glob.glob(patron))
        if candidatos:
            # La versión más alta es la que mejor soporta un servidor nuevo.
            return max(candidatos, key=_version)

    return None


def _conexion():
    """Datos de conexión a partir de settings.DATABASES['default']."""
    db = settings.DATABASES['default']
    if 'postgresql' not in (db.get('ENGINE') or ''):
        raise BackupError(
            'La copia de seguridad solo está disponible para PostgreSQL.'
        )
    opciones = db.get('OPTIONS') or {}
    return {
        'host': db.get('HOST') or '',
        'port': str(db.get('PORT') or ''),
        'user': db.get('USER') or '',
        'name': db.get('NAME') or '',
        'password': str(db.get('PASSWORD') or ''),
        'sslmode': str(opciones.get('sslmode') or ''),
    }


def _entorno(conn):
    env = os.environ.copy()
    if conn['password']:
        env['PGPASSWORD'] = conn['password']
    if conn['sslmode']:
        env['PGSSLMODE'] = conn['sslmode']
    env.setdefault('PGCONNECT_TIMEOUT', '30')
    return env


def _comando(binario, conn):
    args = [binario]
    if conn['host']:
        args += ['-h', conn['host']]
    if conn['port']:
        args += ['-p', conn['port']]
    if conn['user']:
        args += ['-U', conn['user']]
    if conn['name']:
        args += ['-d', conn['name']]
    return args


def borrar(ruta):
    try:
        os.unlink(ruta)
    except OSError:
        pass


def crear_dump(destino):
    """Genera un volcado SQL completo en ``destino``."""
    conn = _conexion()
    binario = buscar_binario('pg_dump')
    if not binario:
        raise BackupError(
            'No se encontró el programa pg_dump. Instale el cliente de '
            'PostgreSQL (versión 18 o superior) o defina la variable PG_BIN.'
        )

    cmd = _comando(binario, conn) + [
        '--format=plain',
        '--encoding=UTF8',
        '--no-owner',
        '--no-privileges',
        '--clean',
        '--if-exists',
    ]
    try:
        with open(destino, 'wb') as salida:
            proc = subprocess.run(
                cmd, stdout=salida, stderr=subprocess.PIPE, env=_entorno(conn)
            )
    except OSError as e:
        raise BackupError(f'No se pudo ejecutar pg_dump: {e}') from e

    if proc.returncode != 0:
        detalle = _texto(proc.stderr)
        raise BackupError(
            f'pg_dump falló (código {proc.returncode}). {detalle}'
        )
    if os.path.getsize(destino) == 0:
        raise BackupError(
            'pg_dump no generó contenido. Verifique la conexión a la base de datos.'
        )


def crear_dump_temporal():
    fd, ruta = tempfile.mkstemp(prefix='sdies_dump_', suffix='.sql')
    os.close(fd)
    try:
        crear_dump(ruta)
    except Exception:
        borrar(ruta)
        raise
    return ruta


def crear_zip_temporal(ruta_sql, nombre_sql, media_root=None):
    """Empaqueta el SQL y, si existe, la carpeta media/ en un .zip temporal."""
    ruta_zip = None
    try:
        fd, ruta_zip = tempfile.mkstemp(prefix='sdies_backup_', suffix='.zip')
        os.close(fd)
        with zipfile.ZipFile(ruta_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.write(ruta_sql, nombre_sql)
            if media_root and os.path.isdir(media_root):
                for raiz, _, archivos in os.walk(media_root):
                    for nombre in archivos:
                        completo = os.path.join(raiz, nombre)
                        relativo = os.path.relpath(completo, media_root)
                        try:
                            zf.write(completo, os.path.join('media', relativo))
                        except OSError:
                            continue
    except Exception:
        if ruta_zip:
            borrar(ruta_zip)
        raise
    finally:
        borrar(ruta_sql)
    return ruta_zip


def gzip_y_borrar(ruta, tamano=TAMANO_BLOQUE):
    """Generador que comprime ``ruta`` y la elimina al terminar."""
    compresor = zlib.compressobj(9, zlib.DEFLATED, 31)
    try:
        with open(ruta, 'rb') as archivo:
            while True:
                bloque = archivo.read(tamano)
                if not bloque:
                    break
                dato = compresor.compress(bloque)
                if dato:
                    yield dato
        resto = compresor.flush()
        if resto:
            yield resto
    finally:
        borrar(ruta)


def leer_y_borrar(ruta, tamano=TAMANO_BLOQUE):
    """Generador que entrega ``ruta`` y la elimina al terminar."""
    try:
        with open(ruta, 'rb') as archivo:
            while True:
                bloque = archivo.read(tamano)
                if not bloque:
                    break
                yield bloque
    finally:
        borrar(ruta)


def restaurar(archivo_sql):
    """Ejecuta el SQL sobre la base configurada. Devuelve la salida de psql."""
    conn = _conexion()
    binario = buscar_binario('psql')
    if not binario:
        raise BackupError(
            'No se encontró el programa psql. Instale el cliente de '
            'PostgreSQL (versión 18 o superior) o defina la variable PG_BIN.'
        )

    cmd = _comando(binario, conn) + [
        '--single-transaction',
        '--set', 'ON_ERROR_STOP=1',
        '--file', archivo_sql,
    ]
    try:
        proc = subprocess.run(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env=_entorno(conn),
        )
    except OSError as e:
        raise BackupError(f'No se pudo ejecutar psql: {e}') from e

    salida = _texto(proc.stdout)
    if proc.returncode != 0:
        detalle = _texto(proc.stderr) or salida
        raise BackupError(
            f'La restauración falló (código {proc.returncode}). {detalle}'
        )
    return salida


def _extraer_sql_de_zip(ruta_zip, destino):
    with zipfile.ZipFile(ruta_zip) as zf:
        candidatos = [
            info for info in zf.infolist()
            if not info.is_dir()
            and info.filename.lower().endswith(('.sql', '.sql.gz'))
        ]
        if not candidatos:
            raise BackupError(
                'El archivo .zip no contiene una copia de la base de datos '
                '(.sql o .sql.gz).'
            )
        # Preferir la copia de la base y, entre varias, la de mayor tamaño.
        candidatos.sort(
            key=lambda i: ('backup' in i.filename.lower(), i.file_size),
            reverse=True,
        )
        info = candidatos[0]
        with zf.open(info) as origen:
            if info.filename.lower().endswith('.gz'):
                with gzip.GzipFile(fileobj=origen) as descompreso:
                    with open(destino, 'wb') as salida:
                        shutil.copyfileobj(descompreso, salida, TAMANO_BLOQUE)
            else:
                with open(destino, 'wb') as salida:
                    shutil.copyfileobj(origen, salida, TAMANO_BLOQUE)


def restaurar_desde_archivo(archivo):
    """Restaura una copia subida (.sql, .sql.gz o .zip)."""
    nombre = os.path.basename(archivo.name or 'copia.sql')
    minuscula = nombre.lower()
    with tempfile.TemporaryDirectory(prefix='sdies_restore_') as tmpdir:
        subido = os.path.join(tmpdir, 'copia_subida')
        with open(subido, 'wb') as salida:
            for bloque in archivo.chunks():
                salida.write(bloque)

        sql = subido
        if minuscula.endswith('.sql.gz'):
            sql = os.path.join(tmpdir, 'copia.sql')
            with gzip.open(subido, 'rb') as origen:
                with open(sql, 'wb') as salida:
                    shutil.copyfileobj(origen, salida, TAMANO_BLOQUE)
        elif minuscula.endswith('.zip'):
            sql = os.path.join(tmpdir, 'copia.sql')
            _extraer_sql_de_zip(subido, sql)

        return restaurar(sql)
