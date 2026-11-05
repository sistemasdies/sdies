from .base import *

DEBUG = True
SECRET_KEY = 'dev-key-solo-para-desarrollo-no-usar-en-produccion'
ALLOWED_HOSTS = ['*']

INSTALLED_APPS += ['debug_toolbar']
MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE

DEBUG_TOOLBAR_CONFIG = {
    'SHOW_TOOLBAR_CALLBACK': lambda request: (
        not request.path.startswith('/api/reports/ficha-membresia')
    ),
}
INTERNAL_IPS = ['127.0.0.1']

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env_file('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env_file('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = env_file('DEFAULT_FROM_EMAIL', default='SDIES <mysdies@gmail.com>')

# Connect timeout (psycopg2) para dev
DATABASES['default']['OPTIONS'] = {'connect_timeout': 30}
