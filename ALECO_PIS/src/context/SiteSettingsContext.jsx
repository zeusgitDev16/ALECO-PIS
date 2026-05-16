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
    loading,
    refreshSettings: fetchSettings,
  };

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
