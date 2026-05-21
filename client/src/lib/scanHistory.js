// localStorage-backed history of completed scan results.
// Each entry stores the full module response so a past scan can be
// reopened and viewed without re-running it.

const KEY = 'recon-tool:scan-history';
const MAX_ENTRIES = 50;
const CHANGE_EVENT = 'recon-history-change';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function write(entries) {
  // Trim to MAX_ENTRIES; on quota errors, drop the oldest half and retry.
  let list = entries.slice(0, MAX_ENTRIES);
  while (list.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      break;
    } catch (_) {
      list = list.slice(0, Math.floor(list.length / 2));
    }
  }
  if (!list.length) {
    try {
      localStorage.removeItem(KEY);
    } catch (_) {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getEntries() {
  return read();
}

// Records a completed scan. Keeps only the latest result per module+target.
export function addEntry({ module, target, data }) {
  if (!module || !target) return;
  const entries = read().filter(
    (e) => !(e.module === module && e.target === target)
  );
  entries.unshift({
    id: `${module}:${target}:${Date.now()}`,
    module,
    target,
    data,
    ts: Date.now()
  });
  write(entries);
}

export function removeEntry(id) {
  write(read().filter((e) => e.id !== id));
}

export function clearHistory() {
  write([]);
}

export function subscribe(callback) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}
