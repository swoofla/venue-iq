import { useEffect } from 'react';

/**
 * Applies the user's OS color scheme to <html> by toggling the `.dark` class
 * Tailwind's `darkMode: ["class"]` reads. Listens for system changes live.
 * No toggle, no persistence — purely follows `prefers-color-scheme`.
 */
export default function useSystemTheme() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (isDark) => {
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    };
    apply(mql.matches);
    const onChange = (e) => apply(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);
}