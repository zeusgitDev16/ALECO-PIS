import React from 'react';
import '../../CSS/darkLightButton.css'; // Importing your CSS

const DarkLightButton = ({ theme, toggleTheme }) => {
  return (
    <div className="dl-button-wrapper">
      <div className="container">
        <div className="toggle">
          <input 
            type="checkbox" 
            checked={theme === 'dark'} 
            onChange={toggleTheme} 
          />
          <span className="button"></span>
          
          {/* Dynamic Label: Shows Sun in Light mode, Moon in Dark mode */}
          <span className="label">
            {theme === 'dark' ? '☾' : '☼'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DarkLightButton;