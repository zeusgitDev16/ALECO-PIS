import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async';
import { installFetchSessionHeaders } from './utils/installFetchSessionHeaders.js';

// Build version for deployment verification
console.log('Current Build Version: 1.0.4 - May 27, 2026 23:56');

installFetchSessionHeaders();
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import App from './App.jsx'
import './index.css';
import { LoadingProvider } from './context/LoadingContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Use the ID from your .env file
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <StrictMode>
      <HelmetProvider>
        <SiteSettingsProvider>
          <LoadingProvider>
            <App />
            <ToastContainer position="top-right" autoClose={4000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover theme="colored" />
          </LoadingProvider>
        </SiteSettingsProvider>
      </HelmetProvider>
    </StrictMode>
  </GoogleOAuthProvider>,
)