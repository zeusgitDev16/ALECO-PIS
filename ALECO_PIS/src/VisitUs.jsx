import React from 'react';
import './CSS/BodyLandPage.css'; // Reusing existing styles

const VisitUs = () => {
    return (
        <div id="visit-us" className="interruption-list-container">
            <h2 className="section-title">Visit Us</h2>
            <div className="report-main-card" style={{ color: 'var(--text-main)' }}>
                <p><strong>Main Office:</strong> Albay Electric Cooperative, Inc.</p>
                <p><strong>Address:</strong> W447+74Q, Justiniano R. Seva St, Daraga, 4501 Albay</p>
                <p><strong>Hours:</strong> Monday - Friday: 8:00 AM - 5:00 PM</p>
                <p><strong>Website:</strong> <a href="https://web.alecoinc.com.ph/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>https://web.alecoinc.com.ph/</a></p>
            </div>
        </div>
    );
};

export default VisitUs;