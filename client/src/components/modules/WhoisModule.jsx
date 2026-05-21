import { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { Spinner, ErrorBox, ExportButton, Section, KeyValue, Copyable } from '../Common.jsx';

export default function WhoisModule({ target, registerSummary, initialData = null }) {
  const { data, loading, error, run } = useApi('whois', initialData);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (target && !initialData) run(target).catch(() => {});
  }, [target, run, initialData]);

  useEffect(() => {
    if (!registerSummary) return;
    if (data) {
      registerSummary({
        ok: true,
        text: `Registrar: ${data.summary.registrar || 'unknown'} · expires ${data.summary.expiryDate || '?'}`
      });
    }
  }, [data, registerSummary]);

  if (loading) return <Spinner label="Querying WHOIS server…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Section
        title="Summary"
        right={<ExportButton data={data} filename={`whois-${target}.json`} />}
      >
        <KeyValue
          data={{
            Registrar: data.summary.registrar,
            Registrant: data.summary.registrant,
            Created: data.summary.creationDate,
            Updated: data.summary.updatedDate,
            Expires: data.summary.expiryDate,
            'Name servers': Array.isArray(data.summary.nameServers)
              ? data.summary.nameServers.join(', ')
              : data.summary.nameServers,
            Status: Array.isArray(data.summary.status)
              ? data.summary.status.join(', ')
              : data.summary.status
          }}
        />
      </Section>

      <Section
        title="Parsed fields"
        right={
          <button onClick={() => setShowRaw((v) => !v)} className="btn">
            {showRaw ? 'Hide raw' : 'Show raw'}
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {Object.entries(data.parsed)
            .slice(0, 30)
            .map(([k, v]) => (
              <div key={k} className="flex gap-2 items-baseline truncate">
                <span className="text-slate-500 truncate min-w-[120px]">{k}</span>
                <span className="text-slate-300 truncate">
                  <Copyable value={Array.isArray(v) ? v.join(', ') : v} label={k} />
                </span>
              </div>
            ))}
        </div>
      </Section>

      {showRaw && (
        <Section title="Raw WHOIS">
          <pre className="text-[11px] text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-96">
            {data.raw}
          </pre>
        </Section>
      )}
    </div>
  );
}
