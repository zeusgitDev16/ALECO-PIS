import React, { createContext, useState, useContext, useEffect } from 'react';

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Listen for the "nerves" (Axios) to tell us when to show/hide
        const handleShow = () => setIsLoading(true);
        const handleHide = () => setIsLoading(false);

        document.addEventListener('show-global-loader', handleShow);
        document.addEventListener('hide-global-loader', handleHide);

        return () => {
            document.removeEventListener('show-global-loader', handleShow);
            document.removeEventListener('hide-global-loader', handleHide);
        };
    }, []);

    return (
        <LoadingContext.Provider value={{ isLoading }}>
            {children}
            {isLoading && (
                <div className="global-loader-overlay">
                    <div className="loader-spinner"></div>
                    <p className="loader-text">Connecting to ALECO Servers...</p>
                </div>
            )}
        </LoadingContext.Provider>
    );
};

export const useLoading = () => useContext(LoadingContext);