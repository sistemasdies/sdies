import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Permission(models.Model):
    code        = models.CharField(max_length=100, unique=True)
    name        = models.CharField(max_length=200)
    module      = models.CharField(max_length=50)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['module', 'code']

    def __str__(self):
        return f"[{self.module}] {self.code}"


class Role(models.Model):
    NameRole       = models.CharField(max_length=50, unique=True)
    description    = models.TextField(blank=True)
    permissions    = models.ManyToManyField(Permission, blank=True, related_name='roles')
    centros_costo  = models.ManyToManyField('accounting.CentroCosto', blank=True,
                                             related_name='roles')
    cuentas        = models.ManyToManyField('accounting.Cuenta', blank=True,
                                             related_name='roles')
    comprobantes   = models.ManyToManyField('accounting.Comprobante', blank=True,
                                             related_name='roles')
    controles      = models.JSONField(default=dict, blank=True,
                                      help_text="Ej: {'editar_movimiento': 'P'|'D'}")
    is_system      = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.NameRole


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError('El email es obligatorio')
        email = self.normalize_email(email)
        user  = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    login        = models.CharField(max_length=10, unique=True)
    email        = models.EmailField(unique=True)
    NameUser     = models.CharField(max_length=30)
    caja_user    = models.CharField(max_length=8, blank=True, default='')
    fecha_nacimiento = models.DateField(null=True, blank=True)
    frase_verificacion = models.CharField(max_length=30, blank=True, default='')
    reset_token   = models.CharField(max_length=64, blank=True, default='')
    reset_token_expira = models.DateTimeField(null=True, blank=True)
    role         = models.ForeignKey(Role, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name='users')
    observacion  = models.TextField(blank=True)
    estado       = models.IntegerField(default=1)
    fecha_cierre = models.DateTimeField(null=True, blank=True)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['login', 'NameUser']

    class Meta:
        db_table = 'users_user'

    def __str__(self):
        return f"{self.login} ({self.email})"

    def get_full_name(self):
        return self.NameUser

    def has_permission(self, perm_code: str) -> bool:
        if self.is_superuser:
            return True
        if not self.role:
            return False
        return self.role.permissions.filter(code=perm_code).exists()


class UserPreference(models.Model):
    """Preferencias/estado de navegación por usuario.

    Guarda el último estado de cada pantalla (filtros, fechas, etc.)
    en un JSONField para rehidratarlos al volver a entrar.
    La fila se crea automáticamente con el usuario y se elimina con él.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE,
                                related_name='preferencias')
    data = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['user']

    def __str__(self):
        return f"Preferencias de {self.user.login}"

    def get(self, clave, default=None):
        return self.data.get(clave, default)

    def set(self, clave, valor):
        self.data[clave] = valor
        self.save(update_fields=['data', 'updated_at'])