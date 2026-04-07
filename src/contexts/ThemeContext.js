import React, { createContext, useContext, useState, useEffect } from 'react';

const THEMES = {
  default: { name: 'Default Blue', primary: '217 91% 53%', accent: '199 89% 48%', radius: '0.5rem', bg: '0 0% 100%', card: '0 0% 100%', foreground: '222 47% 11%', muted: '210 40% 96%', border: '214 32% 91%', preview: ['#3b82f6','#0ea5e9','#f8fafc'] },
  ocean: { name: 'Ocean Teal', primary: '173 80% 40%', accent: '187 85% 43%', radius: '0.625rem', bg: '180 20% 99%', card: '0 0% 100%', foreground: '200 50% 10%', muted: '180 25% 95%', border: '180 20% 88%', preview: ['#0d9488','#06b6d4','#f0fdfa'] },
  emerald: { name: 'Emerald Green', primary: '160 84% 39%', accent: '142 71% 45%', radius: '0.5rem', bg: '0 0% 100%', card: '0 0% 100%', foreground: '150 40% 10%', muted: '150 30% 96%', border: '150 20% 90%', preview: ['#059669','#22c55e','#f0fdf4'] },
  violet: { name: 'Royal Violet', primary: '263 70% 58%', accent: '280 65% 60%', radius: '0.75rem', bg: '270 10% 99%', card: '0 0% 100%', foreground: '260 40% 12%', muted: '260 20% 96%', border: '260 15% 90%', preview: ['#7c3aed','#a855f7','#faf5ff'] },
  rose: { name: 'Rose Pink', primary: '346 77% 55%', accent: '330 80% 60%', radius: '0.75rem', bg: '350 10% 99%', card: '0 0% 100%', foreground: '340 40% 12%', muted: '340 20% 96%', border: '340 15% 91%', preview: ['#e11d48','#f43f5e','#fff1f2'] },
  amber: { name: 'Warm Amber', primary: '25 95% 53%', accent: '38 92% 50%', radius: '0.5rem', bg: '30 10% 99%', card: '0 0% 100%', foreground: '20 40% 10%', muted: '30 25% 96%', border: '30 15% 90%', preview: ['#ea580c','#f59e0b','#fffbeb'] },
  slate: { name: 'Slate Gray', primary: '215 20% 40%', accent: '215 25% 50%', radius: '0.375rem', bg: '0 0% 100%', card: '210 10% 99%', foreground: '215 30% 12%', muted: '215 15% 95%', border: '215 15% 88%', preview: ['#475569','#64748b','#f8fafc'] },
  midnight: { name: 'Midnight Dark', primary: '217 91% 60%', accent: '199 89% 48%', radius: '0.5rem', bg: '222 47% 8%', card: '222 40% 11%', foreground: '210 40% 96%', muted: '215 20% 15%', border: '215 20% 20%', preview: ['#60a5fa','#0ea5e9','#0f172a'] },
  forest: { name: 'Forest', primary: '142 70% 35%', accent: '160 60% 40%', radius: '0.5rem', bg: '140 10% 99%', card: '0 0% 100%', foreground: '140 40% 10%', muted: '140 20% 95%', border: '140 15% 88%', preview: ['#16a34a','#0d9488','#f0fdf4'] },
  sunset: { name: 'Sunset', primary: '15 90% 55%', accent: '340 75% 55%', radius: '0.625rem', bg: '15 10% 99%', card: '0 0% 100%', foreground: '15 40% 10%', muted: '15 20% 96%', border: '15 15% 90%', preview: ['#f97316','#e11d48','#fff7ed'] },
  indigo: { name: 'Deep Indigo', primary: '239 84% 67%', accent: '250 75% 60%', radius: '0.625rem', bg: '240 10% 99%', card: '0 0% 100%', foreground: '240 40% 10%', muted: '240 20% 96%', border: '240 15% 90%', preview: ['#6366f1','#818cf8','#eef2ff'] },
  cherry: { name: 'Cherry Blossom', primary: '330 81% 60%', accent: '340 75% 65%', radius: '0.75rem', bg: '330 10% 99%', card: '330 5% 100%', foreground: '330 40% 10%', muted: '330 15% 96%', border: '330 10% 91%', preview: ['#ec4899','#f472b6','#fdf2f8'] },
};

const ThemeContext = createContext({ theme: 'default', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('beatx-theme') || 'default');

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem('beatx-theme', t);
  };

  useEffect(() => {
    const t = THEMES[theme] || THEMES.default;
    const root = document.documentElement;
    root.style.setProperty('--primary', t.primary);
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--radius', t.radius);
    root.style.setProperty('--background', t.bg);
    root.style.setProperty('--card', t.card);
    root.style.setProperty('--foreground', t.foreground);
    root.style.setProperty('--muted', t.muted);
    root.style.setProperty('--border', t.border);
    root.style.setProperty('--input', t.border);
    root.style.setProperty('--primary-foreground', theme === 'midnight' ? '222 47% 11%' : '0 0% 100%');
    root.style.setProperty('--card-foreground', t.foreground);
    root.style.setProperty('--popover', t.card);
    root.style.setProperty('--popover-foreground', t.foreground);
    root.style.setProperty('--muted-foreground', theme === 'midnight' ? '215 20% 55%' : '215 16% 47%');
    root.style.setProperty('--secondary', t.muted);
    root.style.setProperty('--secondary-foreground', t.foreground);
    root.style.setProperty('--accent-color', t.accent);
    root.style.setProperty('--accent-foreground', t.foreground);
    root.style.setProperty('--ring', t.primary);
    // Toggle dark body class for midnight theme
    if (theme === 'midnight') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export { THEMES };
