# ERP Contable Profesional

Sistema contable multiempresa — Django 5 + React + SQLite/PostgreSQL.

## Requisitos

| Componente | Versión mínima |
|---|---|
| Python | 3.11 / 3.12 / 3.13 / 3.14 |
| pip | 23+ |
| Node.js | 18+ (solo para el frontend) |
| Redis | 7+ (solo si usas Celery) |
| Docker | 24+ (opcional) |

> **Python 3.14:** los paquetes usan rangos abiertos (`>=`) para que pip
> resuelva automáticamente la versión compatible más reciente.

---

## Inicio rápido — LOCAL (sin Docker)

```bash
# 1. Crear entorno virtual
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / Mac
source venv/bin/activate

# 2. Actualizar pip primero (importante en Python 3.14)
pip install --upgrade pip

# 3. Instalar dependencias
pip install -r requirements/development.txt

# 4. Crear carpeta de base de datos y migrar
mkdir db
python manage.py migrate

# 5. Cargar datos iniciales
#    (empresa demo + PUC Colombia + comprobantes + períodos + admin)
python manage.py init_data \
  --empresa "Mi Empresa S.A.S." \
  --nit "900123456-1" \
  --email "admin@miempresa.com" \
  --password "Admin2025*"

# 6. Arrancar servidor
python manage.py runserver

# API disponible en: http://localhost:8000/api/docs/
```

---

## Inicio rápido — DOCKER

```bash
cp .env.example .env
# Editar .env: cambiar SECRET_KEY por algo seguro

docker-compose up -d --build

docker-compose exec backend python manage.py init_data \
  --empresa "Mi Empresa S.A.S." \
  --nit "900123456-1" \
  --email "admin@miempresa.com" \
  --password "Admin2025*"

# API: http://localhost:8000/api/docs/
# Frontend: http://localhost:3000
```

---

## Solución de problemas frecuentes

### Error al instalar WeasyPrint
WeasyPrint requiere librerías del sistema.

**Ubuntu / Debian:**
```bash
sudo apt install build-essential libpango-1.0-0 libpangocairo-1.0-0 \
     libcairo2 libgdk-pixbuf2.0-0 libffi-dev libssl-dev
```

**Windows:** instalar [GTK3 Runtime](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases)

**Mac:**
```bash
brew install pango cairo gdk-pixbuf libffi
```

### Error con WeasyPrint en Python 3.14
Si WeasyPrint no tiene aún wheels para 3.14, instalar sin él temporalmente:
```bash
pip install -r requirements/development.txt --ignore-requires-python
```
O comentar la línea `WeasyPrint` en `requirements/base.txt` y usar solo Excel.

### Error "externally-managed-environment" (Linux)
```bash
# Siempre usar venv, nunca pip global en sistemas modernos
python -m venv venv && source venv/bin/activate
pip install -r requirements/development.txt
```

---

## Endpoints principales

```
POST  /api/auth/login/                     ← obtener JWT
POST  /api/auth/refresh/
POST  /api/auth/logout/

GET   /api/accounts/arbol/                 ← plan de cuentas árbol
GET   /api/accounts/?nivel=4               ← cuentas por nivel
GET   /api/accounts/{id}/saldo/?fecha_hasta=2025-12-31

GET   /api/movicont/                       ← asientos (paginado)
POST  /api/movicont/                       ← crear asiento
POST  /api/movicont/{id}/contabilizar/
POST  /api/movicont/{id}/reversar/
POST  /api/movicont/{id}/anular/

GET   /api/periodos/
POST  /api/periodos/{id}/cerrar/

GET   /api/comprobantes/
GET   /api/centros-costo/
GET   /api/terceros/
GET   /api/plantillas/

GET   /api/banking/cuentas/
GET   /api/banking/transacciones/
GET   /api/banking/conciliaciones/

GET   /api/reports/balance-general/?fecha_hasta=2025-12-31
GET   /api/reports/estado-resultados/?fecha_desde=2025-01-01&fecha_hasta=2025-12-31
GET   /api/reports/balance-comprobacion/
POST  /api/reports/exportar/               ← dispara tarea Celery PDF/Excel

GET   /api/audit/logs/
GET   /api/companies/

GET   /api/docs/                           ← Swagger UI completo
```

---

## Tablas SQL Server → Modelos Django

| SQL Server | Modelo Django | App |
|---|---|---|
| `CentroCostos` | `CentroCosto` | accounting |
| `Terceros` | `Tercero` | accounting |
| `Cuentas` | `Cuenta` | accounting |
| `Comprobantes` | `Comprobante` | accounting |
| `MoviCont` (PK triple) | `MoviContCabecera` + `MoviContLinea` | accounting |
| `CierrePeriodoContable` | `CierrePeriodoContable` | accounting |
| `PlantillasContables` | `PlantillaContable` | accounting |
| `DetallePlantillas` | `DetallePlantilla` | accounting |
| `usuarios` | `User` | users |
| `Perfil` | `Role` | users |
| `DatosEmpresa` | `Company` | tenants |
| `Creditos` / `Abonos` | `CuentaBancaria` / `TransaccionBancaria` | banking |

---

## Correr tests

```bash
pytest apps/ -v --cov=apps --cov-report=html
# Reporte HTML en: htmlcov/index.html
```

## Estructura de carpetas

```
erp_contable/
├── apps/
│   ├── core/           # BaseModel, soft delete, permisos, middleware
│   ├── tenants/        # Multiempresa (Company, CompanyUser)
│   ├── users/          # User, Role, Permission + JWT auth
│   ├── accounting/     # Núcleo contable
│   │   ├── models/     # Cuenta, Comprobante, Tercero, CentroCosto,
│   │   │               # MoviContCabecera, MoviContLinea, PeriodoContable
│   │   ├── services/   # JournalService, BalanceService, CierreService
│   │   ├── serializers/
│   │   ├── views/
│   │   └── management/commands/init_data.py   ← datos iniciales
│   ├── banking/        # Cuentas bancarias + conciliación
│   ├── reports/        # Reportes financieros + exportación async
│   └── audit/          # AuditLog inmutable
├── config/             # Settings, URLs, WSGI, Celery
├── docker/             # Dockerfile, nginx.conf
├── docker-compose.yml
├── manage.py
└── requirements/
    ├── base.txt         ← producción + desarrollo
    ├── development.txt  ← testing + debug
    └── production.txt   ← PostgreSQL + Sentry
```
