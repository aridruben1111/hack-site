export default function Dashboard({ target, summaries }) {
  const entries = Object.entries(summaries);
  if (!target || entries.length === 0) return null;

  return (
    <div className="card mb-4">
      <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3">
        Scan dashboard — <span className="text-accent">{target}</span>
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {entries.map(([key, s]) => (
          <div
            key={key}
            className={`p-3 rounded border ${
              s.ok === true
                ? 'border-emerald-700/40 bg-emerald-950/20'
                : s.ok === false
                ? 'border-rose-700/40 bg-rose-950/20'
                : 'border-amber-700/40 bg-amber-950/20'
            }`}
          >
            <div className="text-xs uppercase tracking-wider text-slate-400">{key}</div>
            <div className="text-sm text-slate-100 mt-1 truncate" title={s.text}>{s.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
