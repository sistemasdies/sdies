from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.users.views import (
    UserViewSet, RoleViewSet, PermissionViewSet,
    AsumirRolView, RetomarRolView,
)

router = DefaultRouter()
router.register(r'roles',       RoleViewSet,       basename='role')
router.register(r'permissions', PermissionViewSet, basename='permission')
router.register(r'',            UserViewSet,       basename='user')

urlpatterns = [
    path('asumir-rol/',  AsumirRolView.as_view(),  name='asumir-rol'),
    path('retomar-rol/', RetomarRolView.as_view(), name='retomar-rol'),
    path('', include(router.urls)),
]
