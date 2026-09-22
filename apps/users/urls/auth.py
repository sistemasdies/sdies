from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenBlacklistView
from apps.users.serializers.auth import CustomTokenObtainSerializer
from rest_framework_simplejwt.views import TokenViewBase
from apps.users.views import (RecuperarPaso1View, RecuperarPaso2View,
                              RecuperarPaso3View, RecuperarPaso4View,
                              ConfigurarVerificacionView)


class CustomTokenObtainPairView(TokenViewBase):
    _serializer_class = 'apps.users.serializers.auth.CustomTokenObtainSerializer'


urlpatterns = [
    path('login/',   CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(),          name='token_refresh'),
    path('logout/',  TokenBlacklistView.as_view(),        name='token_blacklist'),
    path('recuperar/paso1/', RecuperarPaso1View.as_view(),      name='recuperar-paso1'),
    path('recuperar/paso2/', RecuperarPaso2View.as_view(),      name='recuperar-paso2'),
    path('recuperar/paso3/', RecuperarPaso3View.as_view(),      name='recuperar-paso3'),
    path('recuperar/paso4/', RecuperarPaso4View.as_view(),      name='recuperar-paso4'),
    path('configurar-verificacion/', ConfigurarVerificacionView.as_view(),
         name='configurar-verificacion'),
]
