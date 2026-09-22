"""
Inicializa datos básicos del ERP:
  - Permisos del sistema
  - Roles (Administrador, Contador, Auditor)
  - Usuario admin
  - Plan de cuentas PUC Colombia (clases 1-6)
  - Comprobantes estándar
  - Períodos del año actual
"""
import datetime
import calendar
from django.core.management.base import BaseCommand
from django.db import transaction

MODULES = {
    'plan_cuentas':     'Plan de Cuentas',
    'asientos':         'Asientos',
    'asientos_plantilla':'Asientos con Plantillas',
    'plantillas':       'Plantillas Contables',
    'terceros':         'Terceros',
    'centros_costo':    'Centros de Costo',
    'comprobantes':     'Comprobantes',
    'periodos':         'Períodos',
    'reportes':         'Reportes',
    'importar':         'Importar Datos',
    'usuarios':         'Usuarios',
    'roles':            'Roles',
}

ACTIONS = ['acceder', 'listar', 'agregar', 'editar', 'borrar']

PERMISOS = []
for mod, label in MODULES.items():
    for act in ACTIONS:
        PERMISOS.append((f'{mod}.{act}', f'{label} — {act}', mod))

COMPROBANTES = [
    ('CC', 'Comprobante de Contabilidad'),
    ('CE', 'Comprobante de Egreso'),
    ('CI', 'Comprobante de Ingreso'),
    ('ND', 'Nota Débito'),
    ('NC', 'Nota Crédito'),
    ('RC', 'Recibo de Caja'),
    ('AP', 'Asiento de Apertura'),
    ('CX', 'Cierre de Ejercicio'),
]

# (codigo, descripcion, nivel, naturaleza, tipo_pgmd, clase_aptig, es_detalle)
CUENTAS_PUC = [
    ('1',      'ACTIVOS',                          '1','D','P','A', False),
    ('11',     'Efectivo y equivalentes de efectivo','2','D','D','A', False),
    ('1105',   'Caja',                              '3','D','D','A', False),
    ('110505', 'Caja general',                      '4','D','D','A', True),
    ('110510', 'Cajas menores',                     '4','D','D','A', True),
    ('1110',   'Bancos',                            '3','D','D','A', False),
    ('111005', 'Bancos nacionales',                 '4','D','D','A', True),
    ('111010', 'Bancos del exterior',               '4','D','D','A', True),
    ('13',     'Deudores',                          '2','D','P','A', False),
    ('1305',   'Clientes',                          '3','D','P','A', False),
    ('130505', 'Clientes nacionales',               '4','D','P','A', True),
    ('130510', 'Clientes del exterior',             '4','D','P','A', True),
    ('1330',   'Anticipos y avances',               '3','D','P','A', True),
    ('1355',   'Anticipo de impuestos y contrib.',  '3','D','P','A', False),
    ('135510', 'Retención en la fuente',            '4','D','P','A', True),
    ('135515', 'IVA retenido',                      '4','D','P','A', True),
    ('14',     'Inventarios',                       '2','D','P','A', False),
    ('1405',   'Materias primas',                   '3','D','P','A', True),
    ('1430',   'Productos terminados',              '3','D','P','A', True),
    ('15',     'Propiedades planta y equipo',       '2','D','P','A', False),
    ('1504',   'Terrenos',                          '3','D','P','A', True),
    ('1516',   'Construcciones y edificaciones',    '3','D','P','A', True),
    ('1524',   'Equipo de oficina',                 '3','D','P','A', True),
    ('1528',   'Equipo de computación y comunic.',  '3','D','P','A', True),
    ('1592',   'Depreciación acumulada',            '3','C','P','A', True),
    ('2',      'PASIVOS',                           '1','C','P','P', False),
    ('21',     'Obligaciones financieras',          '2','C','P','P', False),
    ('2105',   'Bancos nacionales',                 '3','C','P','P', True),
    ('2110',   'Bancos del exterior',               '3','C','P','P', True),
    ('22',     'Proveedores',                       '2','C','P','P', False),
    ('2205',   'Proveedores nacionales',            '3','C','P','P', True),
    ('2210',   'Proveedores del exterior',          '3','C','P','P', True),
    ('23',     'Cuentas por pagar',                 '2','C','P','P', False),
    ('2335',   'Costos y gastos por pagar',         '3','C','P','P', True),
    ('2360',   'Dividendos o participaciones',      '3','C','P','P', True),
    ('24',     'Impuestos, gravámenes y tasas',     '2','C','P','P', False),
    ('2404',   'IVA por pagar',                     '3','C','P','P', True),
    ('2408',   'Retención en la fuente por pagar',  '3','C','P','P', True),
    ('2412',   'ICA por pagar',                     '3','C','P','P', True),
    ('25',     'Obligaciones laborales',            '2','C','P','P', False),
    ('2505',   'Salarios por pagar',                '3','C','P','P', True),
    ('2510',   'Cesantías consolidadas',            '3','C','P','P', True),
    ('2515',   'Intereses sobre cesantías',         '3','C','P','P', True),
    ('2520',   'Prima de servicios',                '3','C','P','P', True),
    ('2525',   'Vacaciones consolidadas',           '3','C','P','P', True),
    ('3',      'PATRIMONIO',                        '1','C','P','A', False),
    ('31',     'Capital social',                    '2','C','P','A', False),
    ('3105',   'Capital suscrito y pagado',         '3','C','P','A', True),
    ('33',     'Reservas',                          '2','C','P','A', False),
    ('3305',   'Reserva legal',                     '3','C','P','A', True),
    ('36',     'Resultados del ejercicio',          '2','C','P','A', False),
    ('3605',   'Utilidad del ejercicio',            '3','C','P','A', True),
    ('3610',   'Pérdida del ejercicio',             '3','D','P','A', True),
    ('37',     'Resultados de ejercicios ant.',     '2','C','P','A', False),
    ('3705',   'Utilidades acumuladas',             '3','C','P','A', True),
    ('3710',   'Pérdidas acumuladas',               '3','D','P','A', True),
    ('4',      'INGRESOS',                          '1','C','M','A', False),
    ('41',     'Operacionales',                     '2','C','M','A', False),
    ('4135',   'Comercio al por mayor y menor',     '3','C','M','A', False),
    ('413505', 'Ventas de mercancías',              '4','C','M','A', True),
    ('4175',   'Servicios',                         '3','C','M','A', False),
    ('417520', 'Honorarios',                        '4','C','M','A', True),
    ('42',     'No operacionales',                  '2','C','M','A', False),
    ('4210',   'Dividendos y participaciones',      '3','C','M','A', True),
    ('4245',   'Utilidad en venta de inversiones',  '3','C','M','A', True),
    ('4295',   'Diversos',                          '3','C','M','A', True),
    ('5',      'GASTOS',                            '1','D','G','A', False),
    ('51',     'Operacionales de administración',   '2','D','G','A', False),
    ('5105',   'Gastos de personal',                '3','D','G','A', False),
    ('510506', 'Sueldos',                           '4','D','G','A', True),
    ('510515', 'Horas extras y recargos',           '4','D','G','A', True),
    ('510518', 'Comisiones',                        '4','D','G','A', True),
    ('510527', 'Auxilio de transporte',             '4','D','G','A', True),
    ('510530', 'Cesantías',                         '4','D','G','A', True),
    ('510533', 'Intereses sobre cesantías',         '4','D','G','A', True),
    ('510536', 'Prima de servicios',                '4','D','G','A', True),
    ('510539', 'Vacaciones',                        '4','D','G','A', True),
    ('510545', 'Aportes a EPS',                     '4','D','G','A', True),
    ('510548', 'Aportes a ARL',                     '4','D','G','A', True),
    ('510551', 'Aportes a pensiones',               '4','D','G','A', True),
    ('510554', 'Aportes a caja de compensación',    '4','D','G','A', True),
    ('5110',   'Honorarios',                        '3','D','G','A', True),
    ('5115',   'Impuestos',                         '3','D','G','A', False),
    ('511510', 'ICA',                               '4','D','G','A', True),
    ('511515', 'Predial unificado',                 '4','D','G','A', True),
    ('5120',   'Arrendamientos',                    '3','D','G','A', True),
    ('5125',   'Contribuciones y afiliaciones',     '3','D','G','A', True),
    ('5130',   'Seguros',                           '3','D','G','A', True),
    ('5135',   'Servicios',                         '3','D','G','A', False),
    ('513505', 'Aseo y vigilancia',                 '4','D','G','A', True),
    ('513510', 'Temporales',                        '4','D','G','A', True),
    ('513515', 'Acueducto y alcantarillado',        '4','D','G','A', True),
    ('513520', 'Energía eléctrica',                 '4','D','G','A', True),
    ('513525', 'Teléfono',                          '4','D','G','A', True),
    ('513530', 'Correo, portes y telegramas',       '4','D','G','A', True),
    ('5140',   'Gastos legales',                    '3','D','G','A', True),
    ('5145',   'Mantenimiento y reparaciones',      '3','D','G','A', True),
    ('5150',   'Adecuaciones e instalaciones',      '3','D','G','A', True),
    ('5155',   'Gastos de viaje',                   '3','D','G','A', True),
    ('5160',   'Depreciaciones',                    '3','D','G','A', True),
    ('5195',   'Diversos',                          '3','D','G','A', False),
    ('519520', 'Útiles, papelería y fotocopias',    '4','D','G','A', True),
    ('519525', 'Casino y restaurante',              '4','D','G','A', True),
    ('52',     'Operacionales de ventas',           '2','D','G','A', False),
    ('5205',   'Gastos de personal ventas',         '3','D','G','A', True),
    ('5245',   'Publicidad y propaganda',           '3','D','G','A', True),
    ('53',     'No operacionales',                  '2','D','G','A', False),
    ('5305',   'Financieros',                       '3','D','G','A', True),
    ('5310',   'Pérdida en venta de inversiones',   '3','D','G','A', True),
    ('5315',   'Gastos extraordinarios',            '3','D','G','A', True),
    ('5395',   'Diversos no operacionales',         '3','D','G','A', True),
    ('6',      'COSTOS DE PRODUCCIÓN Y VENTAS',     '1','D','G','A', False),
    ('61',     'Costo de ventas',                   '2','D','G','A', False),
    ('6135',   'Comercio al por mayor y menor',     '3','D','G','A', False),
    ('613535', 'Costo de mercancías vendidas',      '4','D','G','A', True),
    ('7',      'COSTOS DE PRODUCCIÓN',              '1','D','G','A', False),
    ('71',     'Materia prima',                     '2','D','G','A', True),
    ('72',     'Mano de obra directa',              '2','D','G','A', True),
    ('73',     'Costos indirectos',                 '2','D','G','A', True),
]


class Command(BaseCommand):
    help = 'Inicializa datos básicos: permisos, roles, admin, PUC Colombia, comprobantes, períodos'

    def add_arguments(self, parser):
        parser.add_argument('--email',    default='admin@erp.local')
        parser.add_argument('--password', default='Admin2025*')
        parser.add_argument('--login',    default='admin')

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Inicializando SDIES ===\n'))
        self._permisos()
        self._roles()
        admin = self._admin(options['email'], options['password'], options['login'])
        self._puc()
        self._comprobantes(admin)
        self._periodos(admin)
        self.stdout.write(self.style.SUCCESS('\n✅  Inicialización completada.\n'))
        self.stdout.write(f"   Swagger:    http://localhost:8000/api/docs/")
        self.stdout.write(f"   Email:      {options['email']}")
        self.stdout.write(f"   Contraseña: {options['password']}\n")

    def _permisos(self):
        from apps.users.models import Permission
        n = 0
        for code, name, module in PERMISOS:
            _, c = Permission.objects.get_or_create(code=code, defaults={'name':name,'module':module})
            if c: n += 1
        self.stdout.write(f"  ✓ Permisos: {n} creados")

    def _roles(self):
        from apps.users.models import Role, Permission
        n = 0
        roles_def = [
            ('Administrador', 'Acceso total', Permission.objects.all()),
            ('Contador',      'Operaciones contables',
             Permission.objects.filter(module__in=['plan_cuentas','asientos','asientos_plantilla','plantillas','comprobantes','periodos','terceros','centros_costo'])),
            ('Auditor',       'Solo lectura',
             Permission.objects.filter(code__endswith='.listar')),
        ]
        for name, desc, perms in roles_def:
            role, c = Role.objects.get_or_create(NameRole=name, defaults={'description':desc,'is_system':True})
            role.permissions.set(perms)
            if c: n += 1
        self.stdout.write(f"  ✓ Roles: {n} creados")

    def _admin(self, email, password, login):
        from apps.users.models import User, Role
        role = Role.objects.filter(NameRole='Administrador').first()
        user, created = User.objects.get_or_create(
            email=email,
            defaults={'login': login, 'NameUser': 'Administrador', 'is_staff': True,
                      'is_superuser': True, 'role': role}
        )
        if created:
            user.set_password(password)
            user.save()
        self.stdout.write(f"  ✓ Admin: {email} ({'creado' if created else 'existente'})")
        return user

    @transaction.atomic
    def _puc(self):
        from apps.accounting.models import Cuenta
        padres = {}
        n = 0
        for codigo, desc, nivel, nat, pgmd, apt, detalle in CUENTAS_PUC:
            padre = None
            for i in range(len(codigo)-1, 0, -1):
                if codigo[:i] in padres:
                    padre = padres[codigo[:i]]
                    break
            cuenta, c = Cuenta.objects.get_or_create(
                codigo=codigo,
                defaults={'descripcion':desc,'nivel':nivel,'naturaleza':nat,
                          'tipo_pgmd':pgmd,'clase_aptig':apt,'es_detalle':detalle,
                          'is_active':True,'padre':padre,'permite_cc':detalle}
            )
            padres[codigo] = cuenta
            if c: n += 1
        self.stdout.write(f"  ✓ PUC Colombia: {n} cuentas creadas")

    def _comprobantes(self, user):
        from apps.accounting.models import Comprobante
        n = 0
        for codigo, desc in COMPROBANTES:
            _, c = Comprobante.objects.get_or_create(
                codigo=codigo,
                defaults={'descripcion':desc,'activo':True,'numero_inicial':1,
                          'ultimo_numero':0,'created_by':user}
            )
            if c: n += 1
        self.stdout.write(f"  ✓ Comprobantes: {n} creados")

    def _periodos(self, user):
        from apps.accounting.models import PeriodoContable
        year = datetime.date.today().year
        n = 0
        for mes in range(1, 13):
            _, ultimo = calendar.monthrange(year, mes)
            _, c = PeriodoContable.objects.get_or_create(
                anio=year, mes=mes,
                defaults={'fecha_inicio': datetime.date(year, mes, 1),
                          'fecha_fin':    datetime.date(year, mes, ultimo),
                          'created_by': user}
            )
            if c: n += 1
        self.stdout.write(f"  ✓ Períodos {year}: {n} creados")