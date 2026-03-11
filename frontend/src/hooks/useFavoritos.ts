import { useState, useCallback } from 'react';

const KEY = 'erp-favoritos';

export function useFavoritos() {
  const [favoritos, setFavoritos] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  });

  const toggle = useCallback((path: string) => {
    setFavoritos(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFav = useCallback((path: string) => favoritos.includes(path), [favoritos]);

  return { favoritos, toggle, isFav };
}
