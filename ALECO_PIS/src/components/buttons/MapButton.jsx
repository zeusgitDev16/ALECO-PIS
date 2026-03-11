import React from 'react';
import '../../CSS/MapButton.css';

const MapButton = ({ onClick }) => {
    return (
        <button className="map-trigger-btn" onClick={onClick}>
            🗺️ Coverage Map
        </button>
    );
};

export default MapButton;