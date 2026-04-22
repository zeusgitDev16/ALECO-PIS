import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Admin routes: only users who used the app login (localStorage set in login.jsx) may enter.
 * - Typing /admin-* in the address bar with no session → redirect home.
 * - Sidebar, profile button, and normal React navigation use the same check: if keys exist, it works.
 * Real API security remains on the server (session + RBAC).
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();

  const email = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
  const tokenVersion = typeof localStorage !== 'undefined' ? localStorage.getItem('tokenVersion') : null;

  if (!email || tokenVersion === null || tokenVersion === undefined) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
}
