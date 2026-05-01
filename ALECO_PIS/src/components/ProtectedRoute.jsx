import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import API from '../api/axiosConfig.js';
import { clearLocalStoragePreservingPreferences } from '../utils/clearLocalStoragePreservingPreferences.js';

/**
 * Admin routes: server-validated session check prevents browser back/forward bypass.
 * - Verifies tokenVersion with /api/verify-session on mount and after back/forward navigation.
 * - Clears session and redirects if server reports invalid session.
 * - Real API security remains on the server (session + RBAC).
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);

  const email = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
  const tokenVersion = typeof localStorage !== 'undefined' ? localStorage.getItem('tokenVersion') : null;

  // Fast-fail: if no localStorage keys, redirect immediately
  if (!email || tokenVersion === null || tokenVersion === undefined) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  useEffect(() => {
    let cancelled = false;

    const verifySession = async () => {
      try {
        const response = await API.post('/api/verify-session', {
          email,
          tokenVersion: Number(tokenVersion),
        });

        if (cancelled) return;

        if (response.data?.status === 'valid') {
          setIsValid(true);
        } else {
          // Server says session is invalid - clear and redirect
          clearLocalStoragePreservingPreferences();
          setIsValid(false);
        }
      } catch (error) {
        if (cancelled) return;
        // Network error or server error - treat as invalid for security
        console.error('[ProtectedRoute] Session verification failed:', error.message);
        clearLocalStoragePreservingPreferences();
        setIsValid(false);
      } finally {
        if (!cancelled) {
          setIsVerifying(false);
        }
      }
    };

    verifySession();

    return () => {
      cancelled = true;
    };
  }, [email, tokenVersion]);

  // Handle browser back/forward navigation (pageshow event)
  useEffect(() => {
    const handlePageShow = (event) => {
      // event.persisted is true when page is loaded from bfcache (back/forward)
      if (event.persisted) {
        // Re-verify session when coming from back/forward
        setIsVerifying(true);
        setIsValid(false);
        // Trigger verification by calling the API again
        API.post('/api/verify-session', {
          email: localStorage.getItem('userEmail'),
          tokenVersion: Number(localStorage.getItem('tokenVersion')),
        }).then((response) => {
          if (response.data?.status === 'valid') {
            setIsValid(true);
          } else {
            clearLocalStoragePreservingPreferences();
            setIsValid(false);
            // Force navigation to home
            window.location.assign('/');
          }
        }).catch((error) => {
          console.error('[ProtectedRoute] Pageshow verification failed:', error.message);
          clearLocalStoragePreservingPreferences();
          setIsValid(false);
          window.location.assign('/');
        }).finally(() => {
          setIsVerifying(false);
        });
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  if (isVerifying) {
    // Show loading state while verifying - prevents flash of protected content
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1a1a2e'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTop: '3px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isValid) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
}
