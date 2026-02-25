import React from 'react';
import './CSS/BodyLandPage.css';
import './CSS/PrivacyNotice.css';

const PrivacyNotice = () => {
    return (
        <div id="privacy" className="interruption-list-container">
            <div className="privacy-header-section">
                <h2 className="section-title">Privacy Notice</h2>
            </div>
            
            <div className="privacy-card">
                <p className="privacy-text">
                    We, at the Albay Electric Cooperative Inc. (ALECO), respect your privacy and will keep secure and confidential the personal data which you shall provide in our Service Application Form. We shall collect, use, and store your Personal Data and dispose of it in accordance with our policies and applicable laws, and regulations. We may disclose your Personal Data to authorized subsidiaries, affiliates, service providers, government agencies and third-parties.
                </p>
                <div className="privacy-btn-wrapper">
                    <button type="button" className="privacy-btn-agree">Agree</button>
                </div>
            </div>
        </div>
    );
};

export default PrivacyNotice;