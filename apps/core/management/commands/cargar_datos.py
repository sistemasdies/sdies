from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import connection
from django.db.models.signals import post_save
from django.contrib.auth import get_user_model

from apps.users.signals import crear_preferencias

User = get_user_model()


class Command(BaseCommand):
    help = 'Carga los datos de produccion desde un fixture y deja el esquema consistente.'

    def add_arguments(self, parser):
        parser.add_argument('--fixture', default='db/fixtures/data.json',
                            help='Ruta del fixture a cargar (default: db/fixtures/data.json)')
        parser.add_argument('--no-sync-passwords', action='store_true',
                            help='No reescribir la contrasena del superusuario admin')

    def handle(self, *args, **options):
        fixture = options['fixture']

        sync_passwords = not options['no_sync_passwords']

        loaded = post_save.receivers
        post_save.disconnect(crear_preferencias, sender=User)

        try:
            self.stdout.write(f'Cargando fixture: {fixture}')
            call_command('loaddata', fixture, verbosity=1)
        finally:
            post_save.receivers = loaded
            self.stdout.write(self.style.SUCCESS('Signal post_save restaurado.'))

        self._reset_sequences()

        if sync_passwords:
            self._set_password('admin', 'Admin1234!')
            if User.objects.filter(login='dies').exists():
                self._set_password('dies', 'Admin1234!')

        for pref in User.objects.all():
            from apps.users.models import UserPreference
            UserPreference.objects.get_or_create(user=pref)

        n_user = User.objects.count()
        self.stdout.write(self.style.SUCCESS(f'Listo: {n_user} usuarios.'))

    def _reset_sequences(self):
        """Avanza las secuencias identity tras insertar PKs explicitos."""
        with connection.cursor() as cur:
            cur.execute("""
                SELECT table_name, column_name,
                       pg_get_serial_sequence(table_schema || '.' || table_name, column_name) AS seq
                  FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND is_identity = 'YES'
            """)
            rows = [(t, c, s) for t, c, s in cur.fetchall() if s]
        for table, column, seq in rows:
            table_sql = connection.ops.quote_name(table)
            column_sql = connection.ops.quote_name(column)
            with connection.cursor() as cur:
                cur.execute(
                    f"SELECT setval(%s, GREATEST(1, "
                    f"(SELECT COALESCE(MAX({column_sql}), 1) FROM {table_sql})))",
                    [seq],
                )
        self.stdout.write(self.style.SUCCESS(f'Sequencias reseteadas: {len(rows)} tablas.'))

    def _set_password(self, login, password):
        try:
            u = User.objects.get(login=login)
        except User.DoesNotExist:
            self.stderr.write(f'Usuario {login} no existe, omitido.')
            return
        u.set_password(password)
        u.save(update_fields=['password'])
        self.stdout.write(self.style.SUCCESS(f'Password reseteado: {login}'))