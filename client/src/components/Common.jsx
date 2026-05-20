import { useState } from 'react';
import { useToast } from '../hooks/useToast.jsx';

export function Spinner({ label }) {
  return (
    <div className="flex items-center gap-2 text-slate-400 text-sm">
      <span className="spinner" />
      <span>{label || 'Loading…'}</span>
    </div>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div className="card border-rose-700/40 bg-rose-950/20">
      <div className="flex items-center gap-2 mb-1">
        <span className="badge badge-err">Error</span>
      </div>
      <p className="text-sm text-rose-200">{message}</p>
    </div>
  );
}

export function Copyable({ value, label }) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);
  if (value === undefined || value === null || value === '') return <span className="text-slate-500">—</span>;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      push(`${label || 'Value'} copied`, 'success', 1500);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      push('Clipboard not available', 'error');
    }
  };
  return (
    <button
      onClick={copy}
      title="Copy"
      className="text-left max-w-full truncate hover:text-accent transition-colors group inline-flex items-center gap-1"
    >
      <span className="truncate">{text}</span>
      <span className="text-[10px] text-slate-500 group-hover:text-accent">
        {copied ? '✓' : '⧉'}
      </span>
    </button>
  );
}

export function ExportButton({ data, filename }) {
  const { push } = useToast();
  if (!data) return null;
  const onClick = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'recon-export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    push('Export downloaded', 'success', 1500);
  };
  return (
    <button onClick={onClick} className="btn">
      <span>↓</span> Export JSON
    </button>
  );
}

export function Section({ title, children, right }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export function KeyValue({ data }) {
  const entries = Object.entries(data || {});
  if (!entries.length) return <p className="text-sm text-slate-500">No data.</p>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-4 gap-y-1.5 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <div className="text-slate-400 truncate">{k}</div>
          <div className="text-slate-200 break-all">
            <Copyable value={v} label={k} />
          </div>
        </div>
      ))}
    </div>
  );
}
