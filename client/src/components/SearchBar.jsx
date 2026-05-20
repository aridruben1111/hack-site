import { useEffect, useState } from 'react';

const HISTORY_KEY = 'recon-tool:history';

export default function SearchBar({ onSubmit, current }) {
  const [value, setValue] = useState(current || '');
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (current) setValue(current);
  }, [current]);

  const submit = (e) => {
    e.preventDefault();
    const target = value.trim().toLowerCase();
    if (!target) return;
    const next = [target, ...history.filter((h) => h !== target)].slice(0, 12);
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch (_) {}
    onSubmit(target);
    setOpen(false);
  };

  return (
    <form onSubmit={submit} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter domain or IP (e.g. example.com or 1.1.1.1)"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-3 text-base focus:outline-none focus:border-accent"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">⌕</span>
          {open && history.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 card max-h-64 overflow-y-auto z-10">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 py-1">
                Recent scans
              </div>
              {history.map((h) => (
                <button
                  type="button"
                  key={h}
                  onMouseDown={() => {
                    setValue(h);
                    onSubmit(h);
                    setOpen(false);
                  }}
                  className="block w-full text-left text-sm px-2 py-1.5 hover:bg-slate-800 rounded"
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="btn btn-primary px-5">
          Scan
        </button>
      </div>
    </form>
  );
}
