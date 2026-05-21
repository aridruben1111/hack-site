import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useApi } from '../../hooks/useApi.js';
import { Spinner, ErrorBox, ExportButton, Section, KeyValue } from '../Common.jsx';

const icon = new L.DivIcon({
  className: 'recon-marker',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#22d3ee;border:3px solid #0f172a;box-shadow:0 0 12px #22d3ee"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

export default function IpModule({ target, registerSummary, initialData = null }) {
  const { data, loading, error, run } = useApi('ip', initialData);

  useEffect(() => {
    if (target && !initialData) run(target).catch(() => {});
  }, [target, run, initialData]);

  useEffect(() => {
    if (!registerSummary) return;
    if (data) {
      registerSummary({
        ok: true,
        text: `${data.ip} · ${data.geo.country || '?'} · ${data.geo.org || data.geo.isp || ''}`
      });
    }
  }, [data, registerSummary]);

  if (loading) return <Spinner label="Looking up IP geolocation…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const { geo, flags } = data;

  return (
    <div className="space-y-4">
      <Section title="Network info" right={<ExportButton data={data} filename={`ip-${target}.json`} />}>
        <KeyValue
          data={{
            'IP address': data.ip,
            'Resolved from': data.resolvedFrom || '—',
            Country: `${geo.country || ''}${geo.countryCode ? ` (${geo.countryCode})` : ''}`.trim() || '—',
            Region: geo.regionName || '—',
            City: geo.city || '—',
            ISP: geo.isp || '—',
            Organization: geo.org || '—',
            ASN: geo.as || '—',
            Timezone: geo.timezone || '—',
            Reverse: geo.reverse || '—'
          }}
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <span className={`badge ${flags.likelyDatacenter ? 'badge-warn' : 'badge-ok'}`}>
            {flags.likelyDatacenter ? 'Datacenter / hosting' : 'Not flagged hosting'}
          </span>
          <span className={`badge ${flags.likelyVpnOrTor ? 'badge-warn' : 'badge-ok'}`}>
            {flags.likelyVpnOrTor ? 'Possible VPN/Tor/proxy' : 'Not flagged proxy'}
          </span>
          {flags.isMobile && <span className="badge badge-info">Mobile</span>}
        </div>
      </Section>

      {geo.lat != null && geo.lon != null && (
        <Section title="Geolocation">
          <div className="h-72 rounded overflow-hidden border border-slate-800">
            <MapContainer
              key={`${geo.lat}-${geo.lon}`}
              center={[geo.lat, geo.lon]}
              zoom={5}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap"
              />
              <Marker position={[geo.lat, geo.lon]} icon={icon}>
                <Popup>
                  {data.ip}
                  <br />
                  {geo.city}, {geo.country}
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        </Section>
      )}
    </div>
  );
}
