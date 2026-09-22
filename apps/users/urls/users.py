from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.users.views import UserViewSet, RoleViewSet, PermissionViewSet

router = DefaultRouter()
router.register(r'roles',       RoleViewSet,       basename='role')
router.register(r'permissions', PermissionViewSet, basename='permission')
router.register(r'',            UserViewSet,       basename='user')

urlpatterns = [path('', include(router.urls))]
