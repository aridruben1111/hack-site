import { useEffect } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { Spinner, ErrorBox, ExportButton, Section, KeyValue, Copyable } from '../Common.jsx';

const gradeColor = {
  A: 'badge-ok',
  B: 'badge-ok',
  C: 'badge-warn',
  D: 'badge-warn',
  E: 'badge-err',
  F: 'badge-err'
};

export default function SslModule({ target, registerSummary, initialData = null }) {
  const { data, loading, error, run } = useApi('ssl', initialData);

  useEffect(() => {
    if (target && !initialData) run(target).catch(() => {});
  }, [target, run, initialData]);

  useEffect(() => {
    if (!registerSummary) return;
    if (data) {
      registerSummary({
        ok: data.evaluation.grade === 'A' || data.evaluation.grade === 'B',
        text: `Grade ${data.evaluation.grade} · ${data.evaluation.daysLeft} days left`
      });
    }
  }, [data, registerSummary]);

  if (loading) return <Spinner label="Inspecting SSL/TLS certificate…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const ev = data.evaluation;

  return (
    <div className="space-y-4">
      <Section
        title="Certificate"
        right={
          <div className="flex items-center gap-2">
            <span className={`badge ${gradeColor[ev.grade] || 'badge-warn'}`}>
              Grade {ev.grade} ({ev.score})
            </span>
            <ExportButton data={data} filename={`ssl-${target}.json`} />
          </div>
        }
      >
        <KeyValue
          data={{
            Subject: data.subject?.CN,
            Issuer: data.issuer?.CN,
            'Valid from': data.validFrom,
            'Valid to': data.validTo,
            'Days left': ev.daysLeft,
            Protocol: data.protocol,
            Cipher: data.cipher?.name,
            'Wildcard cert': data.isWildcard ? 'yes' : 'no',
            Serial: data.serialNumber,
            Fingerprint: data.fingerprint256
          }}
        />
      </Section>

      {ev.issues.length > 0 && (
        <Section title={`Issues (${ev.issues.length})`}>
          <ul className="space-y-1 text-sm">
            {ev.issues.map((i, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="badge badge-err">!</span>
                <span className="text-slate-200">{i}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Subject Alt Names (${data.subjectAltNames.length})`}>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {data.subjectAltNames.slice(0, 100).map((s, i) => (
            <span key={i} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
              <Copyable value={s} label="SAN" />
            </span>
          ))}
          {data.subjectAltNames.length === 0 && (
            <p className="text-sm text-slate-500">None</p>
          )}
        </div>
      </Section>
    </div>
  );
}
