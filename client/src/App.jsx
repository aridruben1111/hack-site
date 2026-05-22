import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import SearchBar from './components/SearchBar.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import Dashboard from './components/Dashboard.jsx';
import FaviconPreview from './components/FaviconPreview.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import DnsModule from './components/modules/DnsModule.jsx';
import WhoisModule from './components/modules/WhoisModule.jsx';
import IpModule from './components/modules/IpModule.jsx';
import PortScanModule from './components/modules/PortScanModule.jsx';
import SslModule from './components/modules/SslModule.jsx';
import HeadersModule from './components/modules/HeadersModule.jsx';
import TechModule from './components/modules/TechModule.jsx';
import SubdomainsModule from './components/modules/SubdomainsModule.jsx';

const MODULES = [
  { id: 'dns', label: 'DNS', component: DnsModule, hint: 'A · MX · TXT · SPF · DMARC' },
  { id: 'whois', label: 'WHOIS', component: WhoisModule, hint: 'Registrar · dates' },
  { id: 'ip', label: 'IP', component: IpModule, hint: 'Geolocation · ASN' },
  { id: 'ssl', label: 'SSL/TLS', component: SslModule, hint: 'Cert · grade' },
  { id: 'headers', label: 'Headers', component: HeadersModule, hint: 'Security headers' },
  { id: 'tech', label: 'Tech', component: TechModule, hint: 'CMS · frameworks' },
  { id: 'subdomains', label: 'Subdomains', component: SubdomainsModule, hint: 'crt.sh' },
  { id: 'portscan', label: 'Port scan', component: PortScanModule, hint: 'Top 20 ports', warn: true }
];

function AppShell() {
  const [target, setTarget] = useState('');
  const [activeTab, setActiveTab] = useState('dns');
  const [summaries, setSummaries] = useState({});
  const [historyOpen, setHistoryOpen] = useState(false);
  // When set, the active module renders this saved result instead of fetching.
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('target');
    if (t) setTarget(t.toLowerCase());
  }, []);

  const handleSubmit = useCallback((next) => {
    setSummaries({});
    setViewing(null);
    setTarget(next);
    const params = new URLSearchParams(window.location.search);
    params.set('target', next);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, []);

  const selectTab = useCallback((id) => {
    setViewing(null);
    setActiveTab(id);
  }, []);

  const openHistoryEntry = useCallback((entry) => {
    setHistoryOpen(false);
    setSummaries({});
    setViewing(entry);
    setActiveTab(entry.module);
    setTarget(entry.target);
  }, []);

  const register = useMemo(() => {
    const map = {};
    for (const m of MODULES) {
      map[m.id] = (s) => setSummaries((prev) => ({ ...prev, [m.label]: s }));
    }
    return map;
  }, []);

  const activeModule = MODULES.find((m) => m.id === activeTab);
  const Active = activeModule?.component;

  return (
    <div className="min-h-screen">
      <Disclaimer />
      <Header target={target} onOpenHistory={() => setHistoryOpen(true)} />

      {historyOpen && (
        <HistoryPanel onOpen={openHistoryEntry} onClose={() => setHistoryOpen(false)} />
      )}

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="card relative z-20">
          <div className="flex items-center gap-2 mb-3">
            {target && <FaviconPreview target={target} />}
            <h1 className="text-base font-semibold">
              {target ? (
                <>Scanning <span className="text-accent">{target}</span></>
              ) : (
                'Enter a target to start'
              )}
            </h1>
          </div>
          <SearchBar onSubmit={handleSubmit} current={target} />
          <p className="text-xs text-slate-500 mt-2">
            Tip: use <span className="kbd">example.com</span> or an IP like{' '}
            <span className="kbd">1.1.1.1</span>. Only scan systems you are authorized to test.
          </p>
        </div>

        {target && !viewing && <Dashboard target={target} summaries={summaries} />}

        {target && (
          <div className="card !p-0 overflow-hidden">
            <div className="border-b border-slate-800 px-2 overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                {MODULES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => selectTab(m.id)}
                    className={`tab ${activeTab === m.id ? 'active' : ''}`}
                    title={m.hint}
                  >
                    {m.label}
                    {m.warn && <span className="ml-1 text-amber-400">⚠</span>}
                  </button>
                ))}
              </div>
            </div>

            {viewing && (
              <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-950/20 border-b border-amber-800/40 text-xs">
                <span className="text-amber-200">
                  Saved result · {activeModule?.label} · {new Date(viewing.ts).toLocaleString()}
                </span>
                <button onClick={() => setViewing(null)} className="btn !py-1">
                  Run live scan
                </button>
              </div>
            )}

            <div className="p-4">
              {Active && (
                <Active
                  key={viewing ? `view-${viewing.id}` : `${activeTab}-${target}`}
                  target={target}
                  registerSummary={viewing ? undefined : register[activeTab]}
                  initialData={viewing ? viewing.data : null}
                />
              )}
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-slate-600 py-6">
          ReconTool — for authorized security research only.
          <br />
          Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.
          <br />
          Vibe-coded project — built rapidly with AI assistance, use at your own risk.
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
