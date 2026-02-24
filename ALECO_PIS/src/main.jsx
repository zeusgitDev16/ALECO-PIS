import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css';
import { LoadingProvider } from './context/LoadingContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Use the ID from your .env file
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LoadingProvider>
        <App />
      </LoadingProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)