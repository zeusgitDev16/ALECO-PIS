import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import InterruptionList from './InterruptionList.jsx'
import LandingPage from './components/headers/landingPage.jsx';
import './CSS/BodyLandPage.css';
import CookieBanner from './components/CookieBanner.jsx';
import DarkLightButton from './components/buttons/darkLightButton.jsx'; 
import ReportaProblem from './ReportaProblem.jsx';
import AdminDashboard from './Dashboard.jsx';
import About from './About.jsx';
import PrivacyNotice from './PrivacyNotice.jsx';
import AdminUsers from './components/Users.jsx';
import AdminTickets from './components/Tickets.jsx';
import AdminInterruptions from './components/Interruptions.jsx';
import AdminHistory from './components/History.jsx';

// --- UPDATED HELPER COMPONENT ---
const NavigationWrapper = ({ theme, toggleTheme }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 1. SESSION SECURITY CHECK
  useEffect(() => {
    const verifySession = async () => {
      const email = localStorage.getItem('userEmail');
      const currentTokenVersion = localStorage.getItem('tokenVersion');

      // If no email is stored, they aren't logged in, so we skip the check
      if (!email) return;

      try {
        const response = await fetch('http://localhost:5000/api/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, tokenVersion: currentTokenVersion })
        });

        const data = await response.json();

        // If the server says 'invalid', it means a "Logout from all devices" was triggered elsewhere
        if (!response.ok || data.status === 'invalid') {
          console.log("--- [SECURITY] Session stale. Clearing local data. ---");
          localStorage.clear();
          navigate('/'); // Kick to landing page
        }
      } catch (error) {
        console.error("Session verification failed:", error);
      }
    };

    verifySession();
  }, [location.pathname, navigate]); // Runs on every navigation change

  // This checks if we are currently looking at the admin dashboard
  const isAdminPage = location.pathname.startsWith('/admin-');

  return (
    <>
      <div className="fix-container-nav" style={{ position: 'sticky', top: 0, zIndex: 1100, backgroundColor: 'var(--bg-body)' }}>
        {/* LandingPage stays on every screen per your request */}
        <LandingPage />
        
        {/* Navbar only shows if we are NOT on the admin page */}
        {!isAdminPage && <Navbar />}
      </div>

      <Routes>
        {/* HOME ROUTE */}
        <Route path="/" element={
          <div className="body-padding">
            <InterruptionList />
            <ReportaProblem />
            <About />
            <PrivacyNotice />
            <Footer />
          </div>
        } />

        {/* ADMIN ROUTES */}
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/admin-users" element={<AdminUsers />} />
        <Route path="/admin-tickets" element={<AdminTickets />} />
        <Route path="/admin-interruptions" element={<AdminInterruptions />} />
        <Route path="/admin-history" element={<AdminHistory />} />
      </Routes>

      <CookieBanner />
      <DarkLightButton theme={theme} toggleTheme={toggleTheme} />
    </>
  );
};

// --- YOUR ORIGINAL FUNCTION ---
function App() {
  const [theme, setTheme] = useState(
    localStorage.getItem('app-theme') || 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <Router>
      <NavigationWrapper theme={theme} toggleTheme={toggleTheme} />
    </Router>
  );
}

export default App;
