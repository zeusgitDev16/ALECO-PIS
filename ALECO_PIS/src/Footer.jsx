import React from 'react';
import { useSiteSettings } from './context/SiteSettingsContext';

function Footer (){
    const { settings } = useSiteSettings();
    const footerCopyright = settings?.public_footer_copyright || "ALECO's Power Information System, all rights reserved.";

    return (
       <footer className="footer-container">
  <p className="footer-text">
    &copy; {new Date().getFullYear()} {footerCopyright}
  </p>
</footer>
    );

}

export default Footer