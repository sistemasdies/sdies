"""Tests del servicio de asientos contables."""
from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from apps.accounting.services.journal_service import JournalService


class TestValidarPartidaDoble(TestCase):

    def _lineas(self, deb, cre):
        return [
            {'vr_debitos': str(deb), 'vr_creditos': '0', 'cuenta': '11050501'},
            {'vr_debitos': '0', 'vr_creditos': str(cre), 'cuenta': '21050101'},
        ]

    def test_asiento_cuadrado_pasa(self):
        JournalService.validar_partida_doble(self._lineas(1000, 1000))

    def test_diferencia_lanza_error(self):
        with self.assertRaises(ValidationError) as ctx:
            JournalService.validar_partida_doble(self._lineas(1000, 900))
        self.assertIn('100.00', str(ctx.exception))

    def test_cero_lanza_error(self):
        with self.assertRaises(ValidationError):
            JournalService.validar_partida_doble(self._lineas(0, 0))

    def test_una_linea_lanza_error(self):
        with self.assertRaises(ValidationError):
            JournalService.validar_partida_doble(
                [{'vr_debitos': '500', 'vr_creditos': '0', 'cuenta': 'X'}]
            )

    def test_muchas_lineas_cuadradas(self):
        lineas = [
            {'vr_debitos': '500',  'vr_creditos': '0',    'cuenta': '110505'},
            {'vr_debitos': '300',  'vr_creditos': '0',    'cuenta': '130505'},
            {'vr_debitos': '0',    'vr_creditos': '800',  'cuenta': '210505'},
        ]
        JournalService.validar_partida_doble(lineas)

    def test_diferencia_centavos_pasa(self):
        """Diferencias menores a 0.01 son toleradas (redondeo)."""
        lineas = [
            {'vr_debitos': '1000.005', 'vr_creditos': '0',        'cuenta': 'A'},
            {'vr_debitos': '0',        'vr_creditos': '1000.005', 'cuenta': 'B'},
        ]
        JournalService.validar_partida_doble(lineas)


class TestValidarPeriodo(TestCase):
    """Tests de validación de período — requieren fixtures o factories."""

    def test_fecha_sin_periodo_lanza_error(self):
        import datetime
        # Sin ningún período configurado, cualquier fecha falla
        # Usamos una empresa fake (no existe en DB)
        class FakeCompany:
            id = 'fake-id'
        with self.assertRaises(ValidationError) as ctx:
            JournalService.validar_periodo(FakeCompany(), datetime.date(2025, 1, 15))
        self.assertIn('período', str(ctx.exception).lower())
