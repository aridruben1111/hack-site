import { useEffect, useState } from 'react';
import { useToast } from '../hooks/useToast.jsx';
import { getEntries, subscribe } from '../lib/scanHistory';

const THEME_KEY = 'recon-tool:theme';

export default function Header({ target, onOpenHistory }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return localStorage.getItem(THEME_KEY) || 'dark';
  });
  const [historyCount, setHistoryCount] = useState(getEntries().length);
  const { push } = useToast();

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => subscribe(() => setHistoryCount(getEntries().length)), []);

  const share = async () => {
    const url = `${window.location.origin}/?target=${encodeURIComponent(target || '')}`;
    try {
      await navigator.clipboard.writeText(url);
      push('Share link copied to clipboard', 'success');
    } catch (e) {
      push('Could not copy share link', 'error');
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-slate-950 font-bold">
            R
          </div>
          <div>
            <div className="font-semibold tracking-tight">ReconTool</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
              OSINT reconnaissance
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenHistory} className="btn" title="Scan history">
            History
            {historyCount > 0 && (
              <span className="ml-1 px-1.5 rounded-full bg-accent text-slate-950 text-[10px] font-bold">
                {historyCount}
              </span>
            )}
          </button>
          {target && (
            <button onClick={share} className="btn" title="Copy share link">
              <span>⤴</span> Share
            </button>
          )}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn"
            title="Toggle theme"
          >
            {theme === 'dark' ? '☼' : '☾'}
          </button>
        </div>
      </div>
    </header>
  );
}
