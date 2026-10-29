"""Subida, listado y eliminación de imágenes en Cloudinary.

La firma (api_secret) vive únicamente en el backend: el navegador nunca recibe
las credenciales de Cloudinary.
"""
import cloudinary
import cloudinary.api
import cloudinary.uploader
from django.conf import settings

from apps.core.utils.exceptions import ServiceNotConfigured

# Foto tipo documento (3 x 4 cm a 300 DPI → proporción 3:4).
FOTO_ANCHO = 354
FOTO_ALTO  = 472


def _configurado():
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def _configurar():
    if not _configurado():
        raise ServiceNotConfigured(
            'Cloudinary no está configurado. Defina CLOUDINARY_CLOUD_NAME, '
            'CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.'
        )
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def subir_foto(archivo, public_id=None, folder=None, transformar=True):
    """Sube una imagen y devuelve dict con secure_url y public_id."""
    _configurar()
    folder = folder or settings.CLOUDINARY_FOLDER
    opciones = {
        'folder': folder,
        'resource_type': 'image',
        'overwrite': True,
        'invalidate': True,
    }
    if transformar:
        opciones['transformation'] = {
            'width': FOTO_ANCHO,
            'height': FOTO_ALTO,
            'crop': 'fill',
            'gravity': 'face',
            'quality': 'auto:good',
            'fetch_format': 'auto',
        }
    else:
        opciones['quality'] = 'auto:good'
        opciones['fetch_format'] = 'auto'
    if public_id:
        opciones['public_id'] = public_id

    resultado = cloudinary.uploader.upload(archivo, **opciones)
    return {
        'secure_url': resultado.get('secure_url'),
        'public_id': resultado.get('public_id'),
    }


def eliminar_foto(public_id):
    """Elimina una imagen de Cloudinary. No falla si no existe."""
    if not public_id:
        return
    _configurar()
    try:
        cloudinary.uploader.destroy(public_id, invalidate=True)
    except Exception:
        # El borrado remoto es best-effort: no debe romper la operación local.
        pass


def listar_imagenes(folder):
    """Lista las imágenes de una carpeta de Cloudinary.

    Usa ``resources_by_asset_folder`` para soportar las carpetas dinámicas
    (Media Library), donde el ``public_id`` no incluye el nombre de la carpeta.
    """
    _configurar()
    carpeta = (folder or '').strip('/')
    if carpeta:
        resultado = cloudinary.api.resources_by_asset_folder(
            carpeta, type='upload', max_results=200)
    else:
        resultado = cloudinary.api.resources(
            type='upload', resource_type='image', max_results=200)

    imagenes = []
    for r in resultado.get('resources', []):
        if r.get('resource_type', 'image') != 'image':
            continue
        public_id = r.get('public_id', '')
        imagenes.append({
            'public_id': public_id,
            'url':       r.get('secure_url', ''),
            'filename':  public_id.split('/')[-1],
            'width':     r.get('width'),
            'height':    r.get('height'),
        })
    return imagenes
