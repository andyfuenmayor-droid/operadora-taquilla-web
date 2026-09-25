import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface LogoProps {
  className?: string;
  variant?: 'auto' | 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({ className = 'h-9 w-auto', variant = 'auto' }) => {
  const { isLight: themeIsLight } = useTheme();
  const isLight = variant === 'auto' ? themeIsLight : variant === 'light';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 60"
      fill="none"
      className={`${className} transition-all duration-200 select-none`}
    >
      <defs>
        {/* Dark Mode Gradient for M */}
        <linearGradient id="neonMGradientDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00e5ff" />
          <stop offset="50%" stopColor="#00f2a9" />
          <stop offset="100%" stopColor="#00e676" />
        </linearGradient>

        {/* Light Mode Gradient for M: Rich high-contrast cyan to vibrant emerald */}
        <linearGradient id="neonMGradientLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="45%" stopColor="#059669" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        {/* Dark mode neon glow */}
        <filter id="neonGlowDark" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Light mode crisp subtle drop shadow without washed out blur */}
        <filter id="crispShadowLight" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#059669" floodOpacity="0.28" />
        </filter>
      </defs>

      {/* Stylized M Icon */}
      <g transform="translate(6, 6)" filter={isLight ? 'url(#crispShadowLight)' : 'url(#neonGlowDark)'}>
        <path
          d="M8 40V18C8 11.5 13.5 6 20 6C25.5 6 30 10 32 15C34 10 38.5 6 44 6C50.5 6 56 11.5 56 18V40"
          stroke={isLight ? 'url(#neonMGradientLight)' : 'url(#neonMGradientDark)'}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>

      {/* "Multibanca": Deep high-contrast slate navy (#0f172a) in light mode, pure white (#ffffff) in dark mode */}
      <text
        x="76"
        y="27"
        fontFamily="'Plus Jakarta Sans', 'Outfit', sans-serif"
        fontSize="21"
        fontWeight="800"
        fill={isLight ? '#0f172a' : '#ffffff'}
        letterSpacing="-0.02em"
      >
        Multibanca
      </text>

      {/* "Express": Vibrant corporate emerald (#059669) in light mode, electric neon green (#00e676) in dark mode */}
      <text
        x="76"
        y="47"
        fontFamily="'Plus Jakarta Sans', 'Outfit', sans-serif"
        fontSize="19"
        fontWeight="800"
        fill={isLight ? '#059669' : '#00e676'}
        letterSpacing="-0.01em"
      >
        Express
      </text>
    </svg>
  );
};

export default Logo;
