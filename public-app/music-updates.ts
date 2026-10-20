// Same-origin tabs refresh immediately; other devices use conditional revalidation.
const key = 'pbb:music-publication';
export function announceMusicPublication() {
  try { localStorage.setItem(key, crypto.randomUUID()); } catch { /* Polling remains available. */ }
  window.dispatchEvent(new Event(key));
}
export function watchMusicPublication(refresh: () => void) {
  const visible = () => { if (document.visibilityState === 'visible') refresh(); };
  const storage = (event: StorageEvent) => { if (event.key === key) refresh(); };
  window.addEventListener(key, refresh);
  window.addEventListener('storage', storage);
  window.addEventListener('focus', visible);
  document.addEventListener('visibilitychange', visible);
  const interval = setInterval(visible, 2000);
  return () => {
    clearInterval(interval);
    window.removeEventListener(key, refresh);
    window.removeEventListener('storage', storage);
    window.removeEventListener('focus', visible);
    document.removeEventListener('visibilitychange', visible);
  };
}
