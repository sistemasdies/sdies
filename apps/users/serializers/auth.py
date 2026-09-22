from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.db import models
from apps.users.models import User, Role, Permission, UserPreference
from apps.users.services.controls import CONTROLES_CATALOGO, controles_usuario
from apps.accounting.models import CentroCosto, Cuenta, Comprobante


class CustomTokenObtainSerializer(TokenObtainPairSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop(self.username_field, None)
        self.fields['username'] = serializers.CharField()

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        if not username or not password:
            raise serializers.ValidationError('Credenciales inválidas.')
        user = User.objects.filter(
            models.Q(email__iexact=username) | models.Q(login__iexact=username)
        ).first()
        if not user or not user.check_password(password):
            raise serializers.ValidationError('Credenciales inválidas.')
        if not user.is_active:
            raise serializers.ValidationError('Usuario inactivo.')
        self.user = user
        refresh = self.get_token(user)
        return {'refresh': str(refresh), 'access': str(refresh.access_token)}

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['login']  = user.login
        token['nombre'] = user.NameUser
        return token


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Permission
        fields = ['id', 'code', 'name', 'module', 'description']


class RoleSerializer(serializers.ModelSerializer):
    permissions        = PermissionSerializer(many=True, read_only=True)
    permission_ids     = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Permission.objects.all(),
        source='permissions', write_only=True, required=False
    )
    centros_costo      = serializers.SerializerMethodField()
    cuentas            = serializers.SerializerMethodField()
    comprobantes       = serializers.SerializerMethodField()
    centros_costo_ids  = serializers.SlugRelatedField(
        many=True, slug_field='codigo', queryset=CentroCosto.objects.all(),
        source='centros_costo', write_only=True, required=False)
    cuentas_ids        = serializers.SlugRelatedField(
        many=True, slug_field='codigo', queryset=Cuenta.objects.all(),
        source='cuentas', write_only=True, required=False)
    comprobantes_ids   = serializers.SlugRelatedField(
        many=True, slug_field='codigo', queryset=Comprobante.objects.all(),
        source='comprobantes', write_only=True, required=False)
    users_count        = serializers.IntegerField(source='users.count', read_only=True)
    controles          = serializers.JSONField(required=False)

    class Meta:
        model  = Role
        fields = ['id', 'NameRole', 'description', 'is_system',
                  'permissions', 'permission_ids',
                  'centros_costo', 'cuentas', 'comprobantes',
                  'centros_costo_ids', 'cuentas_ids', 'comprobantes_ids',
                  'controles', 'users_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_controles(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError('Debe ser un objeto.')
        validos = {c['code'] for c in CONTROLES_CATALOGO}
        limpio  = {}
        for k, v in (value or {}).items():
            if k in validos and v in ('P', 'D'):
                limpio[k] = v
        return limpio

    def get_centros_costo(self, obj):
        return list(obj.centros_costo.values_list('codigo', flat=True))

    def get_cuentas(self, obj):
        return list(obj.cuentas.values_list('codigo', flat=True))

    def get_comprobantes(self, obj):
        return list(obj.comprobantes.values_list('codigo', flat=True))


class UserSerializer(serializers.ModelSerializer):
    role_nombre      = serializers.CharField(source='role.NameRole', read_only=True)
    permission_codes = serializers.SerializerMethodField()
    verificacion_pendiente = serializers.SerializerMethodField()
    controles        = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = ['id', 'login', 'email', 'NameUser', 'caja_user', 'fecha_nacimiento',
                  'frase_verificacion', 'verificacion_pendiente', 'estado',
                  'is_staff', 'is_active', 'is_superuser', 'role', 'role_nombre',
                  'permission_codes', 'controles', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_controles(self, obj):
        return controles_usuario(obj)

    def get_permission_codes(self, obj):
        if obj.is_superuser:
            return list(Permission.objects.values_list('code', flat=True))
        if not obj.role:
            return []
        return list(obj.role.permissions.values_list('code', flat=True))

    def get_verificacion_pendiente(self, obj):
        return not obj.frase_verificacion


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    class Meta:
        model  = User
        fields = ['login', 'email', 'NameUser', 'caja_user', 'fecha_nacimiento',
                  'frase_verificacion', 'password', 'role', 'is_staff', 'is_active']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user     = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_old_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError("Contraseña actual incorrecta.")
        return value


class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = UserPreference
        fields = ['data']
        read_only_fields = ['data']