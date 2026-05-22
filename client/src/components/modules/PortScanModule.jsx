import { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { Spinner, ErrorBox, ExportButton, Section, Copyable } from '../Common.jsx';

const PROFILES = [
  { id: 'top20', label: 'Top 20', hint: 'Fast — 20 most common ports' },
  { id: 'common', label: 'Common ~120', hint: 'Broad — all well-known ports' },
  { id: 'custom', label: 'Custom', hint: 'Your own ports / ranges' }
];

export default function PortScanModule({ target, registerSummary, initialData = null }) {
  const { data, loading, error, run } = useApi('portscan', initialData);
  const [confirmed, setConfirmed] = useState(!!initialData);
  const [profile, setProfile] = useState(initialData?.profile || 'top20');
  const [customPorts, setCustomPorts] = useState('22,80,443,8080,8443');
  const [banners, setBanners] = useState(true);
  const [showClosed, setShowClosed] = useState(false);

  const startScan = () => {
    const params = { profile, banners: banners ? '1' : '0' };
    if (profile === 'custom') params.ports = customPorts.trim();
    run(target, params).catch(() => {});
  };

  useEffect(() => {
    if (!registerSummary) return;
    if (data) {
      registerSummary({
        ok: data.openCount === 0,
        text: `${data.openCount} open / ${data.scanned} scanned`
      });
    }
  }, [data, registerSummary]);

  if (!confirmed) {
    return (
      <div className="card border-amber-700/40 bg-amber-950/10">
        <h3 className="font-semibold mb-2 text-amber-300">Port scan authorization</h3>
        <p className="text-sm text-slate-300 mb-3">
          Port scanning without authorization may be illegal in your jurisdiction. By starting the
          scan you confirm you have explicit permission to scan{' '}
          <span className="text-accent">{target}</span>.
        </p>
        <button onClick={() => setConfirmed(true)} className="btn btn-primary">
          I have authorization — continue
        </button>
      </div>
    );
  }

  const visible = data
    ? data.results.filter((r) => showClosed || r.state !== 'closed')
    : [];

  return (
    <div className="space-y-4">
      <Section title="Scan options">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PROFILES.map((p) => (
            <button
              key={p.id}
              onClick={() => setProfile(p.id)}
              title={p.hint}
              className={`btn ${profile === p.id ? 'btn-primary' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {profile === 'custom' && (
          <div className="mb-3">
            <label className="text-xs text-slate-400 block mb-1">
              Ports — comma-separated, ranges allowed (e.g. 22,80,443,8000-8100)
            </label>
            <input
              type="text"
              value={customPorts}
              onChange={(e) => setCustomPorts(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
              placeholder="22,80,443,8000-8100"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={banners} onChange={(e) => setBanners(e.target.checked)} />
            <span className="text-slate-300">Banner grab</span>
          </label>
          <button onClick={startScan} disabled={loading} className="btn btn-primary">
            {loading ? 'Scanning…' : 'Start scan'}
          </button>
        </div>
      </Section>

      {loading && <Spinner label="Probing TCP ports…" />}
      {error && <ErrorBox message={error} />}

      {data && !loading && (
        <Section
          title={`Results — ${data.openCount} open of ${data.scanned}`}
          right={
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={showClosed}
                  onChange={(e) => setShowClosed(e.target.checked)}
                />
                <span className="text-slate-400">Show closed</span>
              </label>
              <ExportButton data={data} filename={`portscan-${target}.json`} />
            </div>
          }
        >
          <div className="flex flex-wrap gap-2 mb-3 text-xs">
            <span className="badge badge-info">{data.profile}</span>
            <span className="badge badge-info">{data.durationMs} ms</span>
            {data.bannerGrab && <span className="badge badge-info">banners</span>}
            {Object.entries(data.openByCategory || {}).map(([cat, n]) => (
              <span key={cat} className="badge badge-warn">
                {cat}: {n}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mb-3">{data.warning}</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left py-2 w-16">Port</th>
                  <th className="text-left py-2">Service</th>
                  <th className="text-left py-2 w-24">State</th>
                  <th className="text-left py-2 w-20">Latency</th>
                  <th className="text-left py-2">Banner</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.port} className="table-row align-top">
                    <td className="py-1.5 font-mono">{r.port}</td>
                    <td className="py-1.5">
                      <span className="text-slate-300">{r.service}</span>
                      <span className="text-[10px] text-slate-500 ml-1.5">{r.category}</span>
                    </td>
                    <td className="py-1.5">
                      <span
                        className={`badge ${
                          r.state === 'open'
                            ? 'badge-err'
                            : r.state === 'filtered'
                            ? 'badge-warn'
                            : 'badge-ok'
                        }`}
                      >
                        {r.state}
                      </span>
                    </td>
                    <td className="py-1.5 text-slate-500 text-xs">
                      {r.latencyMs != null ? `${r.latencyMs} ms` : '—'}
                    </td>
                    <td className="py-1.5 text-xs text-slate-400 max-w-sm break-all">
                      {r.banner ? <Copyable value={r.banner} label="banner" /> : <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length === 0 && (
            <p className="text-sm text-slate-500 mt-3">
              No {showClosed ? '' : 'open or filtered '}ports to show.
            </p>
          )}
        </Section>
      )}

      {!data && !loading && !error && (
        <p className="text-sm text-slate-500">
          Choose a profile and press <span className="kbd">Start scan</span>.
        </p>
      )}
    </div>
  );
}
