import { useState } from 'react';
import API from '../../api/client';
import toast from 'react-hot-toast';

const getPlantillas  = () => API.get('/plantillas/?page_size=1000');
const getDetalles    = (pid) => API.get(`/plantillas/detalles/?plantilla=${pid}&page_size=10000`);
const bulkImport     = (data) => API.post('/plantillas/detalles/bulk-import/', data);

const PLANTILLA_CSV =
`cod_plantilla,item,cuenta,doc_ref,observacion,tipo_mov,valor,base,cedula,centro_costo,comentarios,doc_soporte
NOM001,1,510505,,Salario DIGITE,D,DIGITE,,,,,
NOM001,2,210505,,Aporte salud DIGITE,C,DIGITE,,,,,
NOM001,3,510506,,Aporte pension DIGITE,D,DIGITE,,,,,`;

const detectarSep = (l) => {
  const t=(l.match(/\t/g)||[]).length, c=(l.match(/,/g)||[]).length, s=(l.match(/;/g)||[]).length;
  return t>=c&&t>=s?'\t':s>c?';':',';
};

const extraerError = (err) => {
  const d = err?.response?.data;
  if (!d) return 'Error de conexión';
  if (typeof d==='string') return d;
  if (typeof d.detail==='string') return d.detail;
  if (Array.isArray(d.detail)) return d.detail[0];
  const v = Object.values(d)[0];
  return Array.isArray(v)?v[0]:typeof v==='string'?v:JSON.stringify(d);
};

export default function ImportadorDetallePlantillas() {
  const [filas,     setFilas]     = useState([]);
  const [errores,   setErrores]   = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargando,  setCargando]  = useState(false);
  const [progreso,  setProgreso]  = useState(0);
  const [paso,      setPaso]      = useState(1);
  const [sepInfo,   setSepInfo]   = useState('');

  const parsear = (texto) => {
    const limpio = texto.replace(/^\uFEFF/,'').replace(/\r/g,'');
    const lineas = limpio.split('\n').filter(l=>l.trim());
    if (lineas.length<2) return {datos:[],errs:[],sep:','};

    // Forzar coma como separador — el formato es fijo
    const sep = ',';
    const hdrs = lineas[0].split(sep).map(h=>h.trim().toLowerCase()
      .replace(/[óo]/g,'o').replace(/[éo]/g,'e'));

    // Columnas en posición fija:
    // 0:CodPlantilla 1:ItemPlantilla 2:Cuenta 3:DocRef 4:Observacion
    // 5:TipoMov 6:Valor 7:Base 8:Cedula 9:CentroCosto 10:Comentarios 11:DocSoporte
    const datos=[], errs=[];

    lineas.slice(1).forEach((linea,idx2)=>{
      if (!linea.trim()) return;
      const v = linea.split(sep).map(x=>x.trim().replace(/^"|"$/g,''));
      const g = (i) => (v[i]||'').trim();

      const cod_plantilla = g(0);
      const itemRaw       = g(1);
      const cuenta        = g(2);
      const doc_ref       = g(3);
      const observacion   = g(4);
      const tipo_mov      = g(5);
      const valor         = g(6);
      const base          = g(7);
      const cedula        = g(8);
      const centro_costo  = g(9);
      const comentarios   = g(10);
      const doc_soporte   = g(11);

      const errFila=[];
      if (!cod_plantilla)          errFila.push('Falta cod_plantilla');
      if (cod_plantilla.length>7)  errFila.push('cod_plantilla máx 7');
      if (!itemRaw)                errFila.push('Falta item');
      if (isNaN(parseInt(itemRaw)))errFila.push('item debe ser numérico');
      if (cuenta.length>10)        errFila.push('cuenta máx 10 chars');
      if (doc_ref.length>8)        errFila.push('doc_ref máx 8 chars');
      if (observacion.length>50)   errFila.push('observacion máx 50 chars');
      if (tipo_mov && !['D','C','d','c'].includes(tipo_mov))
                                   errFila.push('tipo_mov debe ser D o C');
      if (valor.length>10)         errFila.push('valor máx 10 chars');
      if (base.length>10)          errFila.push('base máx 10 chars');
      if (cedula.length>12)        errFila.push('cedula máx 12 chars');
      if (centro_costo.length>7)   errFila.push('centro_costo máx 7 chars');
      if (comentarios.length>200)  errFila.push('comentarios máx 200 chars');
      if (doc_soporte.length>8)    errFila.push('doc_soporte máx 8 chars');

      datos.push({
        cod_plantilla, item: parseInt(itemRaw)||0,
        cuenta, doc_ref, observacion,
        tipo_mov: tipo_mov.toUpperCase(),
        valor, base, cedula, centro_costo, comentarios, doc_soporte,
        _fila: idx2+2, _errores: errFila, _valida: errFila.length===0,
      });
      if (errFila.length) errs.push({fila:idx2+2, errores:errFila});
    });
    return {datos, errs, sep};
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const {datos,errs,sep} = parsear(ev.target.result);
      setFilas(datos); setErrores(errs);
      setSepInfo(sep==='\t'?'Tabulación':sep===';'?'Punto y coma':'Coma');
      setPaso(2);
    };
    reader.readAsText(file,'UTF-8');
    e.target.value='';
  };

  const importar = async () => {
    const validas = filas.filter(f=>f._valida);
    if (!validas.length) {toast.error('No hay filas válidas'); return;}
    setCargando(true); setProgreso(0);

    // 1. Cargar plantillas existentes → codigo→id
    let plantMap={};
    try {
      const r = await getPlantillas();
      (r.data.results||r.data).forEach(p=>{plantMap[p.cod_plantilla]=p.id;});
    } catch { toast.error('No se pudo cargar plantillas'); setCargando(false); return; }

    // 2. Preparar registros válidos agrupados para envío masivo
    const sinPlantilla = validas.filter(f=>!plantMap[f.cod_plantilla]);
    const conPlantilla = validas.filter(f=>!!plantMap[f.cod_plantilla]);

    let creados=0, actualizados=0, fail=sinPlantilla.length;
    const erroresImport = sinPlantilla.map(f=>({
      fila:f._fila, cod:f.cod_plantilla, item:f.item,
      error:`Plantilla "${f.cod_plantilla}" no existe`,
    }));

    if (conPlantilla.length>0) {
      setProgreso(50);
      const registros = conPlantilla.map(f=>({
        plantilla:    plantMap[f.cod_plantilla],
        item:         f.item,
        cuenta:       f.cuenta,
        doc_ref:      f.doc_ref,
        observacion:  f.observacion,
        tipo_mov:     f.tipo_mov,
        valor:        f.valor,
        base:         f.base,
        cedula:       f.cedula,
        centro_costo: f.centro_costo,
        comentarios:  f.comentarios,
        doc_soporte:  f.doc_soporte,
      }));
      try {
        const res = await bulkImport({registros});
        creados      = res.data.creados;
        actualizados = res.data.actualizados;
        if (res.data.errores?.length) {
          fail += res.data.errores.length;
          res.data.errores.forEach(e=>erroresImport.push(
            {fila:'—', cod:'—', item:e.item, error:e.error}
          ));
        }
      } catch(err) {
        fail += conPlantilla.length;
        erroresImport.push({fila:'—', cod:'todos', item:'—', error:extraerError(err)});
      }
    }

    setProgreso(100);
    setCargando(false);
    setResultado({creados, actualizados, fail, erroresImport});
    setPaso(3);
    if (creados||actualizados)
      toast.success(`${creados} creado(s), ${actualizados} actualizado(s)`);
    if (fail) toast.error(`${fail} con error`);
  };

  const reiniciar = () => {
    setFilas([]); setErrores([]); setResultado(null);
    setProgreso(0); setSepInfo(''); setPaso(1);
  };

  const descargarPlantilla = () => {
    const a = Object.assign(document.createElement('a'),{
      href: URL.createObjectURL(new Blob([PLANTILLA_CSV],{type:'text/csv;charset=utf-8;'})),
      download:'plantilla_detalles.csv',
    });
    a.click();
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-list-ul me-2 text-primary"></i>
          Importar Detalles de Plantillas
        </span>
        <button className="btn btn-outline-secondary btn-sm" onClick={descargarPlantilla}>
          <i className="bi bi-download me-1"></i>Descargar plantilla
        </button>
      </div>

      <div className="card-body">

        {/* ── PASO 1 ── */}
        {paso===1 && (
          <div>
            <div className="alert alert-primary border-0 mb-4">
              <i className="bi bi-info-circle me-2"></i>
              Importa los <strong>renglones de detalle</strong> de las plantillas contables.
              Si el par <code>cod_plantilla + item</code> ya existe, <strong>actualiza</strong> los campos.
            </div>

            <div className="row g-4 mb-4">
              <div className="col-md-7">
                <h6 className="fw-semibold mb-2">Columnas del archivo:</h6>
                <table className="table table-sm table-bordered small">
                  <thead className="table-light">
                    <tr><th>Columna</th><th>Req.</th><th>Máx.</th><th>Descripción</th></tr>
                  </thead>
                  <tbody>
                    {[
                      ['cod_plantilla','Sí','7','Debe existir en plantillas'],
                      ['item','Sí','—','Número de línea (entero)'],
                      ['cuenta','No','10','Código de cuenta contable'],
                      ['doc_ref','No','8','Documento de referencia'],
                      ['observacion','No','50','Texto de observación'],
                      ['tipo_mov','No','1','D=Débito, C=Crédito'],
                      ['valor','No','10','Valor o palabra clave (DIGITE)'],
                      ['base','No','10','Valor base'],
                      ['cedula','No','12','Cédula del tercero'],
                      ['centro_costo','No','7','Código centro de costo'],
                      ['comentarios','No','200','Comentarios adicionales'],
                      ['doc_soporte','No','8','Documento soporte'],
                    ].map(([col,req,max,desc])=>(
                      <tr key={col}>
                        <td><code>{col}</code></td>
                        <td><span className={`badge bg-${req==='Sí'?'danger':'secondary'}`}>{req}</span></td>
                        <td className="text-center">{max}</td>
                        <td>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="col-md-5">
                <h6 className="fw-semibold mb-2">Ejemplo:</h6>
                <div className="bg-light rounded p-2 font-monospace" style={{fontSize:10}}>
                  <div className="text-muted">cod_plantilla,item,cuenta,doc_ref,observacion,tipo_mov,valor,base,cedula,centro_costo,comentarios,doc_soporte</div>
                  <div>NOM001,1,510505,,Salario DIGITE,D,DIGITE,,,,, </div>
                  <div>NOM001,2,210505,,Aporte salud,C,DIGITE,,,,,</div>
                </div>
                <ul className="list-unstyled mt-3 small">
                  {[
                    'cod_plantilla debe existir previamente',
                    'item es el número de renglón único por plantilla',
                    'Si cod+item existe → actualiza los campos',
                    'Campos vacíos se importan como vacíos',
                    'tipo_mov: solo D o C (mayúscula)',
                  ].map(t=>(
                    <li key={t} className="d-flex gap-2 mb-1">
                      <i className="bi bi-check-circle text-success flex-shrink-0 mt-1"></i>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border rounded p-5 text-center"
              style={{borderStyle:'dashed',cursor:'pointer'}}
              onClick={()=>document.getElementById('file-det-plt').click()}>
              <i className="bi bi-cloud-upload display-3 text-primary d-block mb-3"></i>
              <p className="mb-1 fw-semibold fs-5">Haz clic para seleccionar el archivo</p>
              <p className="text-muted small mb-0">CSV — separador automático</p>
              <input type="file" id="file-det-plt" accept=".csv,.txt,.tsv"
                className="d-none" onChange={onFileChange}/>
            </div>
          </div>
        )}

        {/* ── PASO 2: previsualizar ── */}
        {paso===2 && (
          <div>
            <div className="d-flex gap-3 mb-3 flex-wrap align-items-center">
              <span className="badge bg-success fs-6 py-2 px-3">✓ {filas.filter(f=>f._valida).length} válidas</span>
              <span className="badge bg-danger  fs-6 py-2 px-3">✗ {filas.filter(f=>!f._valida).length} con errores</span>
              <span className="badge bg-secondary fs-6 py-2 px-3">{filas.length} total</span>
              <span className="badge bg-info text-dark fs-6 py-2 px-3">Sep: {sepInfo}</span>
            </div>

            {errores.length>0 && (
              <div className="alert alert-warning mb-3">
                <strong>Filas con errores (se omitirán):</strong>
                <ul className="mb-0 mt-2">
                  {errores.slice(0,10).map(e=>(
                    <li key={e.fila} className="small">
                      <strong>Fila {e.fila}:</strong> {e.errores.join(' | ')}
                    </li>
                  ))}
                  {errores.length>10&&<li className="small text-muted">...y {errores.length-10} más</li>}
                </ul>
              </div>
            )}

            <div className="table-responsive" style={{maxHeight:400, overflowX:'auto'}}>
              <table className="table table-sm table-hover mb-0" style={{minWidth:1400}}>
                <thead className="table-dark sticky-top">
                  <tr>
                    <th style={{width:45}}>#</th>
                    <th style={{width:36}}></th>
                    <th style={{width:90}}>Plantilla</th>
                    <th style={{width:60}}>Item</th>
                    <th style={{width:100}}>Cuenta</th>
                    <th style={{width:90}}>Doc.Ref</th>
                    <th style={{width:180}}>Observación</th>
                    <th style={{width:60}}>Tipo</th>
                    <th style={{width:90}}>Valor</th>
                    <th style={{width:90}}>Base</th>
                    <th style={{width:110}}>Cédula</th>
                    <th style={{width:90}}>C.Costo</th>
                    <th style={{width:160}}>Comentarios</th>
                    <th style={{width:90}}>Doc.Soporte</th>
                    <th style={{minWidth:200}}>Errores</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f=>(
                    <tr key={f._fila} className={!f._valida?'table-danger':''}>
                      <td className="small text-muted">{f._fila}</td>
                      <td>
                        {f._valida
                          ?<i className="bi bi-check-circle-fill text-success"></i>
                          :<i className="bi bi-x-circle-fill text-danger"></i>}
                      </td>
                      <td><code className="small fw-bold">{f.cod_plantilla}</code></td>
                      <td className="text-center"><span className="badge bg-secondary">{f.item}</span></td>
                      <td><code className="small">{f.cuenta||'—'}</code></td>
                      <td className="small">{f.doc_ref||'—'}</td>
                      <td className="small">{f.observacion||'—'}</td>
                      <td className="text-center">
                        {f.tipo_mov
                          ?<span className={`badge bg-${f.tipo_mov==='D'?'info':'warning'} text-dark`}>{f.tipo_mov}</span>
                          :'—'}
                      </td>
                      <td className="small">{f.valor||'—'}</td>
                      <td className="small">{f.base||'—'}</td>
                      <td className="small">{f.cedula||'—'}</td>
                      <td className="small">{f.centro_costo||'—'}</td>
                      <td className="small">{f.comentarios||'—'}</td>
                      <td className="small">{f.doc_soporte||'—'}</td>
                      <td className="small">
                        {f._errores.length>0
                          ?<span className="text-danger fw-semibold">{f._errores.join(' · ')}</span>
                          :<span className="text-success">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {cargando && (
              <div className="mt-3">
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <span>Importando...</span><span>{progreso}%</span>
                </div>
                <div className="progress" style={{height:8}}>
                  <div className="progress-bar bg-primary progress-bar-striped progress-bar-animated"
                    style={{width:`${progreso}%`}}></div>
                </div>
              </div>
            )}

            <div className="d-flex gap-2 mt-3 justify-content-end">
              <button className="btn btn-outline-secondary" onClick={reiniciar} disabled={cargando}>
                <i className="bi bi-arrow-left me-1"></i>Volver
              </button>
              <button className="btn btn-primary px-4" onClick={importar}
                disabled={cargando||!filas.filter(f=>f._valida).length}>
                {cargando
                  ?<><span className="spinner-border spinner-border-sm me-1"></span>Importando {progreso}%...</>
                  :<><i className="bi bi-upload me-1"></i>Importar {filas.filter(f=>f._valida).length} detalles</>}
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: resultado ── */}
        {paso===3 && resultado && (
          <div>
            <div className="row g-3 mb-4">
              {[
                {label:'Creados',      value:resultado.creados,     color:'success'},
                {label:'Actualizados', value:resultado.actualizados,color:'primary'},
                {label:'Con error',    value:resultado.fail,        color:'danger'},
              ].map(k=>(
                <div key={k.label} className="col-md-4">
                  <div className={`card border-0 bg-${k.color} text-white text-center p-4`}>
                    <div className="display-4 fw-bold">{k.value}</div>
                    <div className="mt-1">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {resultado.erroresImport.length>0 && (
              <div className="alert alert-danger">
                <strong>Errores:</strong>
                <div className="table-responsive mt-2">
                  <table className="table table-sm mb-0 bg-white">
                    <thead className="table-light">
                      <tr><th>Fila</th><th>Plantilla</th><th>Item</th><th>Error</th></tr>
                    </thead>
                    <tbody>
                      {resultado.erroresImport.map((e,i)=>(
                        <tr key={i}>
                          <td className="small">{e.fila}</td>
                          <td><code className="small">{e.cod}</code></td>
                          <td className="small">{e.item}</td>
                          <td className="small text-danger">{e.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="text-center mt-4">
              <button className="btn btn-primary btn-lg px-5" onClick={reiniciar}>
                <i className="bi bi-arrow-repeat me-1"></i>Nueva importación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}