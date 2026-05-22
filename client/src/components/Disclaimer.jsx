import { useEffect, useState } from 'react';

const STORAGE_KEY = 'recon-tool:disclaimer-accepted';

export default function Disclaimer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) setOpen(true);
  }, []);

  if (!open) return null;

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur p-4">
      <div className="card max-w-lg w-full border-amber-700/40">
        <div className="flex items-center gap-2 mb-3">
          <span className="badge badge-warn">Legal disclaimer</span>
        </div>
        <h2 className="text-lg font-semibold mb-3">Voordat je begint</h2>
        <p className="text-sm text-slate-300 mb-3 leading-relaxed">
          Deze tool is bedoeld voor educatieve doeleinden en geautoriseerd security onderzoek.
          Gebruik alleen op systemen waarvoor je expliciete toestemming hebt. Ongeautoriseerde
          toegang of port scanning is in veel rechtsgebieden strafbaar.
        </p>
        <p className="text-xs text-slate-500 mb-3">
          Door op &laquo;Ik begrijp het en ga akkoord&raquo; te klikken bevestig je dat je
          verantwoordelijk omgaat met deze tool en dat de eigenaar van deze app of de auteur
          van deze software niet aansprakelijk is voor onrechtmatig gebruik.
        </p>
        <p className="text-xs text-amber-300/80 mb-4 leading-relaxed">
          Let op: dit is een &laquo;vibe-coded&raquo; project &mdash; snel en grotendeels
          met AI-assistentie gebouwd. Controleer de code zelf voordat je er in een
          productieomgeving op vertrouwt.
        </p>
        <button onClick={accept} className="btn btn-primary w-full justify-center py-2">
          Ik begrijp het en ga akkoord
        </button>
      </div>
    </div>
  );
}
