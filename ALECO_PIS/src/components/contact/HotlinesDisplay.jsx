import React, { useState, useEffect } from 'react';
import { apiUrl } from '../../utils/api';
import { formatPhoneDisplay, toDisplayFormat } from '../../utils/phoneUtils';
import '../../CSS/HotlinesDisplay.css';

/**
 * Convert phone to tel: href format (+63 for Philippines)
 */
const toTelHref = (phone) => {
    if (!phone || typeof phone !== 'string') return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length >= 11) return `tel:+${digits}`;
    if (digits.startsWith('0') && digits.length >= 10) return `tel:+63${digits.substring(1)}`;
    if (digits.startsWith('9') && digits.length === 10) return `tel:+63${digits}`;
    return digits ? `tel:+63${digits}` : '';
};

const HotlinesDisplay = () => {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchContacts = async () => {
            try {
                const res = await fetch(apiUrl('/api/contact-numbers'));
                const json = await res.json();
                if (json.success && Array.isArray(json.data)) {
                    setContacts(json.data);
                }
            } catch (err) {
                console.error('HotlinesDisplay fetch error:', err);
                setError('Could not load contact numbers');
            } finally {
                setLoading(false);
            }
        };
        fetchContacts();
    }, []);

    if (loading) {
        return (
            <div className="hotlines-display hotlines-loading">
                <span className="hotlines-loading-text">Loading contact numbers...</span>
            </div>
        );
    }

    if (error || contacts.length === 0) {
        return null;
    }

    return (
        <div className="hotlines-display">
            <p className="hotlines-intro">Need immediate help? Contact us:</p>
            <ul className="hotlines-list">
                {contacts.map((c, i) => (
                    <li key={i} className="hotlines-item">
                        <span className="hotlines-label">{c.label}</span>
                        <a
                            href={toTelHref(c.phone_number)}
                            className="hotlines-phone"
                            rel="noopener noreferrer"
                        >
                            {formatPhoneDisplay(c.phone_number) || toDisplayFormat(c.phone_number) || c.phone_number}
                        </a>
                        {c.description && (
                            <span className="hotlines-desc">{c.description}</span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default HotlinesDisplay;
