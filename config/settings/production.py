from .base import *
import os
from django.core.exceptions import ImproperlyConfigured

DEBUG = False

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    raise ImproperlyConfigured('La variable de entorno SECRET_KEY es obligatoria en producción.')

allowed_hosts_env = os.environ.get('ALLOWED_HOSTS')
if allowed_hosts_env:
    ALLOWED_HOSTS = [h.strip() for h in allowed_hosts_env.split(',') if h.strip()]
else:
    ALLOWED_HOSTS = ['localhost', '127.0.0.1']

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS            = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_SSL_REDIRECT            = True
CSRF_COOKIE_SECURE             = True
SESSION_COOKIE_SECURE          = True

# Sin SMTP configurado aun: el email de reportes se imprime en consola/log
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# SPA: servir el build de React por Whitenoise (mismo origen, sin CORS)
SPA_BUILD_DIR = BASE_DIR / 'apps' / 'erp_frontend' / 'build'
if SPA_BUILD_DIR.exists():
    WHITENOISE_ROOT       = str(SPA_BUILD_DIR)
    WHITENOISE_INDEX_FILE = True