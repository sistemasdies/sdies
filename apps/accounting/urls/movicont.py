from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.accounting.views.movicont_views import MoviContViewSet
router = DefaultRouter()
router.register(r'', MoviContViewSet, basename='movicont')
urlpatterns = [path('', include(router.urls))]
