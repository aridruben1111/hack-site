import { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { Spinner, ErrorBox, ExportButton, Section, Copyable } from '../Common.jsx';

export default function SubdomainsModule({ target, registerSummary, initialData = null }) {
  const { data, loading, error, run } = useApi('subdomains', initialData);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (target && !initialData) run(target).catch(() => {});
  }, [target, run, initialData]);

  useEffect(() => {
    if (!registerSummary) return;
    if (data) {
      registerSummary({
        ok: true,
        text: `${data.total} subdomains via crt.sh`
      });
    }
  }, [data, registerSummary]);

  if (loading) return <Spinner label="Querying crt.sh certificate transparency…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const filtered = data.subdomains.filter((s) =>
    !filter || s.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Section
        title={`Subdomains — ${data.total} found, ${data.validatedCount} live-checked`}
        right={<ExportButton data={data} filename={`subdomains-${target}.json`} />}
      >
        <input
          type="text"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full mb-3 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
        />
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-xs uppercase tracking-wider sticky top-0 bg-slate-900">
              <tr>
                <th className="text-left py-2">Subdomain</th>
                <th className="text-left py-2 w-20">Live</th>
                <th className="text-left py-2">Issuer</th>
                <th className="text-left py-2 w-40">First seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.name} className="table-row hover:bg-slate-800/30">
                  <td className="py-1.5">
                    <Copyable value={s.name} label="subdomain" />
                  </td>
                  <td className="py-1.5">
                    {s.skipped ? (
                      <span className="badge badge-warn" title={s.skipped}>blocked</span>
                    ) : s.live === true ? (
                      <span className="badge badge-ok">{s.status}</span>
                    ) : s.live === false ? (
                      <span className="badge badge-err">down</span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-1.5 text-slate-400 text-xs truncate max-w-xs">
                    {s.issuer || '—'}
                  </td>
                  <td className="py-1.5 text-slate-500 text-xs">
                    {s.firstSeen ? new Date(s.firstSeen).toISOString().slice(0, 10) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 mt-3">No subdomains match the filter.</p>
        )}
      </Section>
    </div>
  );
}
