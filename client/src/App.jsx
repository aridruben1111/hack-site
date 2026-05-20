import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import SearchBar from './components/SearchBar.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import Dashboard from './components/Dashboard.jsx';
import FaviconPreview from './components/FaviconPreview.jsx';
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('target');
    if (t) setTarget(t.toLowerCase());
  }, []);

  const handleSubmit = useCallback((next) => {
    setSummaries({});
    setTarget(next);
    const params = new URLSearchParams(window.location.search);
    params.set('target', next);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, []);

  const register = useMemo(() => {
    const map = {};
    for (const m of MODULES) {
      map[m.id] = (s) => setSummaries((prev) => ({ ...prev, [m.label]: s }));
    }
    return map;
  }, []);

  const Active = MODULES.find((m) => m.id === activeTab)?.component;

  return (
    <div className="min-h-screen">
      <Disclaimer />
      <Header target={target} />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="card">
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

        {target && <Dashboard target={target} summaries={summaries} />}

        {target && (
          <div className="card !p-0 overflow-hidden">
            <div className="border-b border-slate-800 px-2 overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                {MODULES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveTab(m.id)}
                    className={`tab ${activeTab === m.id ? 'active' : ''}`}
                    title={m.hint}
                  >
                    {m.label}
                    {m.warn && <span className="ml-1 text-amber-400">⚠</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              {Active && (
                <Active key={`${activeTab}-${target}`} target={target} registerSummary={register[activeTab]} />
              )}
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-slate-600 py-6">
          ReconTool — for authorized security research only.
          <br />
          Gebruik deze tool alleen op systemen waarvoor je toestemming hebt.
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
