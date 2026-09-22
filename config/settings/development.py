from .base import *

DEBUG = True
SECRET_KEY = 'dev-key-solo-para-desarrollo-no-usar-en-produccion'
ALLOWED_HOSTS = ['*']

INSTALLED_APPS += ['debug_toolbar']
MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE
INTERNAL_IPS = ['127.0.0.1']

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Connect timeout (psycopg2) para dev
DATABASES['default']['OPTIONS'] = {'connect_timeout': 30}
