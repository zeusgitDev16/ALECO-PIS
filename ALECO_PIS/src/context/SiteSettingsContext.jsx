import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { apiUrl } from '../utils/api';

const SiteSettingsContext = createContext();

export const SiteSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/site-settings'));
      const result = await response.json();
      if (result.success) {
        setSettings(result.data || {});
      }
    } catch (error) {
      console.error('[SiteSettingsContext] fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const value = {
    settings,
    siteLogoUrl: settings.site_logo_url || null,
    siteFaviconUrl: settings.site_favicon_url || null,
    loading,
    refreshSettings: fetchSettings,
  };

  // Dynamically update branding icons in <head>
  useEffect(() => {
    const faviconUrl = settings.site_favicon_url || '/vite.svg';
    
    // 1. Update standard favicon
    const iconLinks = document.querySelectorAll("link[rel*='icon']");
    if (iconLinks.length > 0) {
      iconLinks.forEach(link => link.href = faviconUrl);
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = faviconUrl;
      document.head.appendChild(newLink);
    }

    // 2. Update apple-touch-icon for mobile/iOS
    let appleLink = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = faviconUrl;

  }, [settings.site_favicon_url]);

  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = () => {
  const context = useContext(SiteSettingsContext);
  if (!context) {
    throw new Error('useSiteSettings must be used within a SiteSettingsProvider');
  }
  return context;
};
