"""Excepciones de dominio compartidas."""


class ServiceNotConfigured(Exception):
    """Un servicio externo (p. ej. Cloudinary) no tiene credenciales configuradas."""
