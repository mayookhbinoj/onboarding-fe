import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

// Theme → logo file mapping (each theme has its own dedicated logo)
const THEME_LOGOS = {
  default: '/beatx-logo-default.png',
  ocean: '/beatx-logo-ocean.png',
  emerald: '/beatx-logo-emerald.png',
  forest: '/beatx-logo-forest.png',
  cherry: '/beatx-logo-cherry.png',
  rose: '/beatx-logo-rose.png',
  amber: '/beatx-logo-amber.png',
  sunset: '/beatx-logo-sunset.png',
  violet: '/beatx-logo-violet.png',
  indigo: '/beatx-logo-indigo.png',
  slate: '/beatx-logo-slate.png',
  midnight: '/beatx-logo-midnight.png',
};

// Preload all logos on module load so switching is instant
const allLogos = new Set(Object.values(THEME_LOGOS));
allLogos.forEach(src => { const img = new Image(); img.src = src; });

export function BeatXLogo({ className = 'h-10', style = {} }) {
  const { theme } = useTheme();
  const src = THEME_LOGOS[theme] || '/beatx-logo-dark.png';

  return (
    <img 
      src={src}
      alt="BeatX" 
      className={`object-contain ${className}`}
      style={{ ...style, maxHeight: '40px', width: 'auto' }}
      data-testid="beatx-logo"
    />
  );
}
