import React from 'react';
import '../../CSS/Navbar.css';
import '../../CSS/LandPageHeader.css';
import { useSiteSettings } from '../../context/SiteSettingsContext';

const LandingPage = () => {
    const { settings } = useSiteSettings();
    const bannerTitle = settings?.public_banner_title || 'Albay Electric Cooperative, INC';

    return (
        <div className = "landing-page-container">
        <header className = "landing-page-header">
            <h4>{bannerTitle}</h4>
        </header>
        </div>
    );
}


export default LandingPage;