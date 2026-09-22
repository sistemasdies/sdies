from .base import *
import os

DEBUG = False
SECRET_KEY = os.environ.get('SECRET_KEY') or 'railway-insecure-secret-key-para-arranque'
ALLOWED_HOSTS = (os.environ.get('ALLOWED_HOSTS') or 'localhost,127.0.0.1').split(',')

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