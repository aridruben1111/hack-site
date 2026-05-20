import { useEffect, useState } from 'react';

export default function FaviconPreview({ target }) {
  const [favicon, setFavicon] = useState(null);

  useEffect(() => {
    setFavicon(null);
    if (!target) return;
    fetch(`/api/favicon?target=${encodeURIComponent(target)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setFavicon(data))
      .catch(() => {});
  }, [target]);

  if (!favicon) return null;
  return (
    <img
      src={favicon.dataUri}
      alt="favicon"
      className="w-5 h-5 rounded-sm"
      title={`Favicon for ${target}`}
    />
  );
}
