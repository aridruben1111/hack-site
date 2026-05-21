import { useEffect, useState } from 'react';
import { getEntries, removeEntry, clearHistory, subscribe } from '../lib/scanHistory';
import { useToast } from '../hooks/useToast.jsx';

const MODULE_LABELS = {
  dns: 'DNS',
  whois: 'WHOIS',
  ip: 'IP',
  ssl: 'SSL/TLS',
  headers: 'Headers',
  tech: 'Tech',
  subdomains: 'Subdomains',
  portscan: 'Port scan'
};

function describe(entry) {
  const d = entry.data || {};
  switch (entry.module) {
    case 'dns':
      return `${d.records?.A?.records?.length || 0} A · SPF ${d.emailSecurity?.spf ? '✓' : '✗'}`;
    case 'whois':
      return d.summary?.registrar || 'completed';
    case 'ip':
      return [d.ip, d.geo?.country].filter(Boolean).join(' · ') || 'completed';
    case 'ssl':
      return d.evaluation ? `grade ${d.evaluation.grade}` : 'completed';
    case 'headers':
      return d.security ? `grade ${d.security.grade}` : 'completed';
    case 'tech':
      return `${d.detected?.length ?? 0} technologies`;
    case 'subdomains':
      return `${d.total ?? '?'} subdomains`;
    case 'portscan':
      return `${d.openCount ?? '?'} open / ${d.scanned ?? '?'} scanned`;
    default:
      return 'completed';
  }
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function HistoryPanel({ onOpen, onClose }) {
  const [entries, setEntries] = useState(getEntries());
  const { push } = useToast();

  useEffect(() => subscribe(() => setEntries(getEntries())), []);

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recon-history.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    push('History exported', 'success', 1500);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider">
            Scan history ({entries.length})
          </h2>
          <button onClick={onClose} className="btn" title="Close">✕</button>
        </div>

        {entries.length > 0 && (
          <div className="flex gap-2 px-4 py-2 border-b border-slate-800">
            <button onClick={exportAll} className="btn">↓ Export all</button>
            <button
              onClick={() => {
                clearHistory();
                push('History cleared', 'success', 1500);
              }}
              className="btn hover:border-rose-600 hover:text-rose-400"
            >
              Clear all
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {entries.length === 0 && (
            <p className="text-sm text-slate-500 p-4 text-center">
              No completed scans yet. Results are saved here automatically as you scan.
            </p>
          )}
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="border border-slate-800 rounded p-2.5 hover:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="badge badge-info">{MODULE_LABELS[entry.module] || entry.module}</span>
                <span className="text-[10px] text-slate-500">{timeAgo(entry.ts)}</span>
              </div>
              <div className="mt-1 text-sm text-slate-200 truncate" title={entry.target}>
                {entry.target}
              </div>
              <div className="text-xs text-slate-500 truncate">{describe(entry)}</div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onOpen(entry)}
                  className="btn btn-primary !py-1"
                >
                  Open result
                </button>
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="btn !py-1 hover:border-rose-600 hover:text-rose-400"
                  title="Delete entry"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
