import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { apiUrl } from '../utils/api';
import { clearLocalStoragePreservingPreferences } from '../utils/clearLocalStoragePreservingPreferences';

/**
 * Admin SPA routes: require local session keys and a valid server-side token version.
 * Login is only possible via login.jsx (password or Google); this blocks direct URL access.
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState('checking'); // checking | ok | redirect

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const email = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
      const tokenVersion = typeof localStorage !== 'undefined' ? localStorage.getItem('tokenVersion') : null;

      if (!email || tokenVersion === null || tokenVersion === undefined) {
        if (!cancelled) setStatus('redirect');
        return;
      }

      try {
        const response = await fetch(apiUrl('/api/verify-session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, tokenVersion }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status === 'invalid') {
          clearLocalStoragePreservingPreferences();
          if (!cancelled) setStatus('redirect');
          return;
        }
        if (!cancelled) setStatus('ok');
      } catch {
        if (!cancelled) setStatus('redirect');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (status === 'checking') {
    return (
      <div
        style={{
          minHeight: '40vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary, #666)',
          fontSize: '0.95rem',
        }}
      >
        Verifying session…
      </div>
    );
  }

  if (status === 'redirect') {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
}
