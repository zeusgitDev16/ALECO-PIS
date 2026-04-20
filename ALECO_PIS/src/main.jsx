import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import App from './App.jsx'
import './index.css';
import { LoadingProvider } from './context/LoadingContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Use the ID from your .env file
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <StrictMode>
      <LoadingProvider>
        <App />
        <ToastContainer position="top-right" autoClose={4000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover theme="colored" />
      </LoadingProvider>
    </StrictMode>
  </GoogleOAuthProvider>,
)