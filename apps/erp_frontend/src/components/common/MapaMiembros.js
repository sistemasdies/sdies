import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícono por defecto de Leaflet (soluciona problema de ruta en bundlers)
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function MapaMiembros({ miembros, onCerrar }) {
  const puntos = useMemo(() => {
    return (miembros || [])
      .map(m => {
        const lat = parseFloat(m.tercero?.latitud ?? m.latitud);
        const lng = parseFloat(m.tercero?.longitud ?? m.longitud);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { ...m, lat, lng };
        }
        return null;
      })
      .filter(Boolean);
  }, [miembros]);

  const centro = useMemo(() => {
    if (puntos.length === 0) return [4.710989, -74.072092]; // Bogotá por defecto
    const sumLat = puntos.reduce((acc, p) => acc + p.lat, 0);
    const sumLng = puntos.reduce((acc, p) => acc + p.lng, 0);
    return [sumLat / puntos.length, sumLng / puntos.length];
  }, [puntos]);

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.85)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-xl" style={{ height: '85vh', maxWidth: '95vw' }}>
        <div className="modal-content shadow" style={{ height: '100%' }}>
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="bi bi-geo-alt me-2"></i>
              Mapa de miembros ({puntos.length} ubicado{puntos.length === 1 ? '' : 's'})
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onCerrar}></button>
          </div>
          <div className="modal-body p-0" style={{ height: '100%' }}>
            {puntos.length === 0 ? (
              <div className="d-flex flex-column justify-content-center align-items-center h-100 text-muted">
                <i className="bi bi-map fs-1 mb-3"></i>
                <p>No hay miembros con coordenadas registradas en esta congregación.</p>
              </div>
            ) : (
              <MapContainer
                center={centro}
                zoom={13}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                />
                {puntos.map((m, idx) => (
                  <Marker key={`${m.id || m.cedula || idx}`} position={[m.lat, m.lng]} icon={DefaultIcon}>
                    <Popup>
                      <div className="small">
                        <strong>{m.nombre_completo || m.tercero?.nombre_completo || 'Sin nombre'}</strong>
                        <div className="text-muted">{m.tercero?.direccion || m.direccion || '—'}</div>
                        {(m.tercero?.celular || m.celular) && (
                          <div><i className="bi bi-phone me-1"></i>{m.tercero?.celular || m.celular}</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCerrar}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
