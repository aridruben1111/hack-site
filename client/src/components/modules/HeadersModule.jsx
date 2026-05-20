import { useEffect } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { Spinner, ErrorBox, ExportButton, Section, Copyable } from '../Common.jsx';

export default function HeadersModule({ target, registerSummary }) {
  const { data, loading, error, run } = useApi('headers');

  useEffect(() => {
    if (target) run(target).catch(() => {});
  }, [target, run]);

  useEffect(() => {
    if (!registerSummary) return;
    if (data) {
      const missing = data.security.totalChecked - data.security.presentCount;
      registerSummary({
        ok: missing <= 1,
        text: `Grade ${data.security.grade} · ${missing} missing`
      });
    }
  }, [data, registerSummary]);

  if (loading) return <Spinner label="Fetching HTTP headers…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Section
        title={`Security headers — ${data.security.presentCount}/${data.security.totalChecked} present`}
        right={
          <div className="flex items-center gap-2">
            <span
              className={`badge ${
                data.security.grade === 'A' || data.security.grade === 'B'
                  ? 'badge-ok'
                  : data.security.grade === 'C' || data.security.grade === 'D'
                  ? 'badge-warn'
                  : 'badge-err'
              }`}
            >
              Grade {data.security.grade}
            </span>
            <ExportButton data={data} filename={`headers-${target}.json`} />
          </div>
        }
      >
        <div className="space-y-2">
          {data.security.analysis.map((h) => (
            <div key={h.name} className="border border-slate-800 rounded p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`badge ${h.present ? 'badge-ok' : 'badge-err'}`}>
                    {h.present ? '✓' : '✗'}
                  </span>
                  <span className="font-semibold text-sm">{h.name}</span>
                </div>
                {h.present && (
                  <div className="text-xs text-slate-400 max-w-md truncate">
                    <Copyable value={h.value} label={h.name} />
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">{h.description}</p>
              {!h.present && (
                <p className="text-xs text-amber-300 mt-1">→ {h.recommendation}</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="All response headers">
        <div className="grid grid-cols-1 gap-1 text-xs">
          {Object.entries(data.headers).map(([k, v]) => (
            <div key={k} className="flex gap-2 py-1 border-b border-slate-800">
              <span className="text-slate-500 min-w-[160px] truncate">{k}</span>
              <span className="text-slate-300 break-all">
                <Copyable value={v} label={k} />
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
