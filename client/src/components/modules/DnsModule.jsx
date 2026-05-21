import { useEffect } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { Spinner, ErrorBox, ExportButton, Section, Copyable } from '../Common.jsx';

export default function DnsModule({ target, registerSummary, initialData = null }) {
  const { data, loading, error, run } = useApi('dns', initialData);

  useEffect(() => {
    if (target && !initialData) run(target).catch(() => {});
  }, [target, run, initialData]);

  useEffect(() => {
    if (!registerSummary) return;
    if (data) {
      const a = data.records.A?.records?.length || 0;
      const mx = data.records.MX?.records?.length || 0;
      registerSummary({
        ok: true,
        text: `${a} A · ${mx} MX · SPF ${data.emailSecurity.spf ? '✓' : '✗'} · DMARC ${data.emailSecurity.dmarc ? '✓' : '✗'}`
      });
    }
  }, [data, registerSummary]);

  if (loading) return <Spinner label="Resolving DNS records…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Section
        title="Email security"
        right={<ExportButton data={data} filename={`dns-${target}.json`} />}
      >
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`badge ${data.emailSecurity.spf ? 'badge-ok' : 'badge-err'}`}>
            SPF {data.emailSecurity.spf ? '✓' : '✗'}
          </span>
          <span className={`badge ${data.emailSecurity.dmarc ? 'badge-ok' : 'badge-err'}`}>
            DMARC {data.emailSecurity.dmarc ? '✓' : '✗'}
          </span>
          <span className={`badge ${data.emailSecurity.dkim ? 'badge-ok' : 'badge-warn'}`}>
            DKIM {data.emailSecurity.dkim ? '✓' : '?'}
          </span>
        </div>
        {data.dmarcRecord && data.dmarcRecord.length > 0 && (
          <p className="text-xs text-slate-400 mt-2 break-all">
            <span className="text-slate-500">_dmarc TXT:</span> {data.dmarcRecord.join(' ')}
          </p>
        )}
      </Section>

      {Object.entries(data.records).map(([type, info]) => (
        <Section key={type} title={`${type} records (${info.records.length})`}>
          {info.error && info.records.length === 0 && (
            <p className="text-xs text-slate-500">No records ({info.error})</p>
          )}
          {info.records.length > 0 && (
            <div className="space-y-1 text-sm">
              {info.records.map((r, i) => (
                <div key={i} className="flex flex-wrap gap-2 items-center break-all">
                  {type === 'MX' ? (
                    <>
                      <span className="badge badge-info">prio {r.priority}</span>
                      <Copyable value={r.exchange} label="MX" />
                    </>
                  ) : type === 'SOA' ? (
                    <Copyable value={JSON.stringify(r)} label="SOA" />
                  ) : (
                    <Copyable value={r.value} label={type} />
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      ))}
    </div>
  );
}
