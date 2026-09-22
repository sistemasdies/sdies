"""Tests de modelos contables."""
from django.test import TestCase
from django.core.exceptions import ValidationError


class TestMoviCont(TestCase):

    def _make_linea(self, deb, cre):
        from apps.accounting.models import MoviCont
        linea = MoviCont.__new__(MoviCont)
        linea.vr_debitos  = deb
        linea.vr_creditos = cre
        return linea

    def test_debito_y_credito_simultaneo_falla(self):
        from decimal import Decimal
        linea = self._make_linea(Decimal('100'), Decimal('100'))
        with self.assertRaises(ValidationError):
            linea.clean()

    def test_ambos_cero_falla(self):
        from decimal import Decimal
        linea = self._make_linea(Decimal('0'), Decimal('0'))
        with self.assertRaises(ValidationError):
            linea.clean()

    def test_negativo_falla(self):
        from decimal import Decimal
        linea = self._make_linea(Decimal('-100'), Decimal('0'))
        with self.assertRaises(ValidationError):
            linea.clean()
