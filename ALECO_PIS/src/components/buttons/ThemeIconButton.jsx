import React from 'react';
import '../../CSS/ThemeIconButton.css';

/**
 * Dashboard-only theme toggle. Matches icon-btn style (notifications, inbox).
 * Single button: shows sun in dark mode (click → light), moon in light mode (click → dark).
 * Smooth transition between icons with glow.
 */
const ThemeIconButton = ({ theme, toggleTheme }) => {
  const isDark = theme === 'dark';
  // Sun = in dark mode, click to go light. Moon = in light mode, click to go dark.
  const showSun = isDark;
  const showMoon = !isDark;

  return (
    <button
      className="icon-btn theme-icon-btn"
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="theme-icon-wrapper">
        {/* Sun: click to turn on light mode */}
        <svg
          className={`theme-icon theme-icon-sun ${showSun ? 'active' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        {/* Moon: click to turn on dark mode */}
        <svg
          className={`theme-icon theme-icon-moon ${showMoon ? 'active' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>
    </button>
  );
};

export default ThemeIconButton;
