import { useEffect } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { Spinner, ErrorBox, ExportButton, Section, KeyValue } from '../Common.jsx';

export default function TechModule({ target, registerSummary }) {
  const { data, loading, error, run } = useApi('tech');

  useEffect(() => {
    if (target) run(target).catch(() => {});
  }, [target, run]);

  useEffect(() => {
    if (!registerSummary) return;
    if (data) {
      registerSummary({
        ok: true,
        text: `${data.detected.length} technologies detected`
      });
    }
  }, [data, registerSummary]);

  if (loading) return <Spinner label="Fingerprinting technology stack…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Section
        title={`Detected (${data.detected.length})`}
        right={<ExportButton data={data} filename={`tech-${target}.json`} />}
      >
        {data.detected.length === 0 && (
          <p className="text-sm text-slate-500">No known technologies detected.</p>
        )}
        <div className="space-y-3">
          {Object.entries(data.grouped).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-1">{category}</h4>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <span key={item} className="badge badge-info">{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Server fingerprint">
        <KeyValue
          data={{
            URL: data.url,
            Status: data.status,
            Server: data.server,
            'X-Powered-By': data.poweredBy,
            'Meta generator': data.generator
          }}
        />
      </Section>
    </div>
  );
}
