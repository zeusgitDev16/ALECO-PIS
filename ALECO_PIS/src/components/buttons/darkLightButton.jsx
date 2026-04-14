import React from 'react';
import '../../CSS/darkLightButton.css';

/**
 * Landing page / public view only. Fixed bottom-right, floating.
 * Sun/moon icon design with glow, same as ThemeIconButton (dashboard).
 */
const DarkLightButton = ({ theme, toggleTheme }) => {
  const isDark = theme === 'dark';
  const showSun = isDark;
  const showMoon = !isDark;

  return (
    <button
      className="dl-button-wrapper dl-button-floating"
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="dl-icon-wrapper">
        <svg
          className={`dl-icon dl-icon-sun ${showSun ? 'active' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
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
        <svg
          className={`dl-icon dl-icon-moon ${showMoon ? 'active' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
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

export default DarkLightButton;