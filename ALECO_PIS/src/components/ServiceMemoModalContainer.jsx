import React from 'react';
import ServiceMemos from './ServiceMemos';
import '../CSS/ServiceMemos.css';
import '../CSS/TicketDetailPane.css';

const ServiceMemoModalContainer = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="ticket-modal-overlay" onClick={onClose}>
            <div className="service-memo-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Fixed Header — title + close button, never scrolls */}
                <div className="service-memo-modal-top-header">
                    <div className="header-text-group">
                        <h2 className="header-title">Service Memos</h2>
                        <p className="header-subtitle">Documentation for resolved tickets</p>
                    </div>
                    <button className="service-memo-close-btn" onClick={onClose} aria-label="Close">
                        &times;
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="service-memo-modal-content">
                    <ServiceMemos />
                </div>
            </div>
        </div>
    );
};

export default ServiceMemoModalContainer;
