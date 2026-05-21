import { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { Spinner, ErrorBox, ExportButton, Section } from '../Common.jsx';

export default function PortScanModule({ target, registerSummary, initialData = null }) {
  const { data, loading, error, run } = useApi('portscan', initialData);
  const [confirmed, setConfirmed] = useState(!!initialData);

  useEffect(() => {
    if (target && confirmed && !initialData) run(target).catch(() => {});
  }, [target, run, confirmed, initialData]);

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
          I have authorization — start scan
        </button>
      </div>
    );
  }

  if (loading) return <Spinner label="Probing top 20 TCP ports…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Section
        title={`Results (${data.openCount} open of ${data.scanned})`}
        right={<ExportButton data={data} filename={`portscan-${target}.json`} />}
      >
        <p className="text-xs text-slate-500 mb-3">{data.warning}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 w-20">Port</th>
                <th className="text-left py-2">Service</th>
                <th className="text-left py-2">State</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.port} className="table-row">
                  <td className="py-1.5 font-mono">{r.port}</td>
                  <td className="py-1.5 text-slate-300">{r.service}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
