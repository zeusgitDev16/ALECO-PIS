import React, { useState, useEffect } from 'react';
import './CSS/BodyLandPage.css';
import alecoPiks1 from './assets/aleco-piks1.jpg';
import alecoPiks2 from './assets/aleco-piks2.jpg';
import alecoPiks3 from './assets/aleco-piks3.jpg';
import alecoPiks4 from './assets/aleco-piks4.jpg';

const About = () => {
    const images = [alecoPiks1, alecoPiks2, alecoPiks3, alecoPiks4];
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
        }, 3000); // Change image every 3 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div id="about" className="interruption-list-container">
            <h2 className="section-title">About ALECO</h2>
            <div className="about-content-container">
            <div className="report-main-card about-text-section" style={{ color: 'var(--text-main)' }}>
                <h3 className="about-aleco">Albay Electric Cooperative, Inc. (ALECO)</h3>
                <p>Welcome to Albay Electric Cooperative, Inc. (ALECO), the driving force behind reliable and efficient electricity distribution in the captivating province of Albay. Established with a commitment to empower communities through electrification, ALECO is a member-owned electric cooperative that proudly serves three cities and fifteen municipalities across the region.</p>
                <p>We envision a future where every household and business in Albay enjoys uninterrupted access to sustainable, affordable, and high-quality electrical services. By fostering innovation and community collaboration, we strive to be at the forefront of the energy sector, contributing to the growth and prosperity of the province.</p>
                <p>Our footprint spans across Albay, reaching into the heart of urban centers and the farthest corners of rural landscapes. ALECO's influence extends through nine electrification districts, ensuring that electricity is not just a utility but a catalyst for progress and development.</p>
            </div>
            <div className="about-image-wrapper">
                <div className="about-slider-track" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                    {images.map((image, index) => (
                        <img 
                            key={index} 
                            src={image} 
                            alt="ALECO Infrastructure" 
                            className="about-image" 
                        />
                    ))}
                </div>
            </div>
            </div>
        </div>
    );
};

export default About;