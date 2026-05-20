import React, { useState, useEffect } from 'react';
import './CSS/BodyLandPage.css';
import './CSS/PrivacyNotice.css';
import { useSiteSettings } from './context/SiteSettingsContext';

const PrivacyNotice = () => {
    const { settings } = useSiteSettings();
    const privacyTitle = settings?.public_privacy_title || 'Privacy Notice';
    const privacyContent = settings?.public_privacy_content || 'We, at the Albay Electric Cooperative Inc. (ALECO), respect your privacy and will keep secure and confidential the personal data which you shall provide in our Service Application Form. We shall collect, use, and store your Personal Data and dispose of it in accordance with our policies and applicable laws, and regulations. We may disclose your Personal Data to authorized subsidiaries, affiliates, service providers, government agencies and third-parties.';

    const [hasConsented, setHasConsented] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('aleco_privacy_consent');
        if (consent === 'true') {
            setHasConsented(true);
        }
    }, []);

    const handleAgree = () => {
        localStorage.setItem('aleco_privacy_consent', 'true');
        setIsFadingOut(true);
        setTimeout(() => {
            setHasConsented(true);
        }, 600);
    };

    return (
        <div id="privacy" className="interruption-list-container">
            <h2 className="section-title">{privacyTitle}</h2>

            <div className="privacy-card">
                <p className="privacy-text">
                    {privacyContent}
                </p>
                {!hasConsented && (
                    <div className="privacy-btn-wrapper">
                        <button type="button" className={`privacy-btn-agree ${isFadingOut ? 'fading-out' : ''}`} onClick={handleAgree}>Agree</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrivacyNotice;
