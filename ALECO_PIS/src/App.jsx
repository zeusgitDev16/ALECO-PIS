import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { apiUrl } from './utils/api';
import { clearLocalStoragePreservingPreferences } from './utils/clearLocalStoragePreservingPreferences';
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import AdminLayout from './components/AdminLayout.jsx';
import InterruptionList from './InterruptionList.jsx'
import LandingPage from './components/headers/landingPage.jsx';
import './CSS/BodyLandPage.css';
import CookieBanner from './components/CookieBanner.jsx';
import DarkLightButton from './components/buttons/darkLightButton.jsx'; 
import ReportaProblem from './ReportaProblem.jsx';
import AdminDashboard from './Dashboard.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import About from './About.jsx';
import PrivacyNotice from './PrivacyNotice.jsx';
import AdminUsers from './components/Users.jsx';
import AdminTickets from './components/Tickets.jsx';
import AdminInterruptions from './components/Interruptions.jsx';
import AdminHistory from './components/History.jsx';
import AdminBackup from './components/Backup.jsx';
import ProfilePage from './components/profile/ProfilePage.jsx';
import PersonnelManagement from './components/PersonnelManagement.jsx';
import B2BMail from './components/B2BMail.jsx';
import ServiceMemos from './components/ServiceMemos.jsx';



// --- UPDATED HELPER COMPONENT ---
const NavigationWrapper = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  // 1. SESSION SECURITY CHECK
  useEffect(() => {
    const verifySession = async () => {
      const email = localStorage.getItem('userEmail');
      const currentTokenVersion = localStorage.getItem('tokenVersion');

      // If no email is stored, they aren't logged in, so we skip the check
      if (!email) return;

      try {
        const response = await fetch(apiUrl('/api/verify-session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, tokenVersion: currentTokenVersion })
        });

        const data = await response.json();

        // If the server says 'invalid', it means a "Logout from all devices" was triggered elsewhere
        if (!response.ok || data.status === 'invalid') {
          console.log("--- [SECURITY] Session stale. Clearing local data. ---");
          clearLocalStoragePreservingPreferences();
          navigate('/'); // Kick to landing page
        }
      } catch (error) {
        console.error("Session verification failed:", error);
      }
    };

    verifySession();
  }, [location.pathname, navigate]); // Runs on every navigation change

  const isAdminPage = location.pathname.startsWith('/admin-');
  const isPublicHome = location.pathname === '/';

  /* Public home only: smooth scroll + scroll-padding for fixed header */
  useEffect(() => {
    document.documentElement.classList.toggle('public-home-smooth-scroll', isPublicHome);
    return () => document.documentElement.classList.remove('public-home-smooth-scroll');
  }, [isPublicHome]);

  /* Report route marker: replaces expensive :has(#report) CSS gating */
  useEffect(() => {
    document.documentElement.classList.toggle('has-report-route', isPublicHome);
    return () => document.documentElement.classList.remove('has-report-route');
  }, [isPublicHome]);

  /* Deep link e.g. /#report — scroll after content is mounted */
  useEffect(() => {
    if (!isPublicHome || !location.hash) return;
    const id = location.hash.slice(1);
    if (!id) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    return () => window.clearTimeout(t);
  }, [isPublicHome, location.pathname, location.hash]);

  /* Dashboard: no document scroll — only sidebar nav + main content panes scroll */
  useEffect(() => {
    const lock = 'admin-app-scroll-lock';
    if (isAdminPage) {
      document.documentElement.classList.add(lock);
      document.body.classList.add(lock);
    } else {
      document.documentElement.classList.remove(lock);
      document.body.classList.remove(lock);
    }
    return () => {
      document.documentElement.classList.remove(lock);
      document.body.classList.remove(lock);
    };
  }, [isAdminPage]);

  return (
    <>
      {/* Public only: fixed Albay strip + navbar. Admin strip lives inside AdminLayout (scroll-locked shell). */}
      {!isAdminPage && (
        <div className="fix-container-nav">
          <LandingPage />
          <Navbar />
        </div>
      )}

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
        <Route path="/admin-backup" element={<AdminBackup />} />

        {/* PROFILE ROUTE */}
        <Route path="/admin-profile" element={ 
          <AdminLayout activePage="profile"> 
            <ProfilePage /> 
          </AdminLayout> 
        } />

        {/* PERSONNEL MANAGEMENT ROUTE */}
        <Route path="/admin-personnel" element={
          <PersonnelManagement />
        } />

        {/* B2B MAIL ROUTE */}
        <Route path="/admin-b2b-mail" element={
          <B2BMail />
        } />
      </Routes>

      <CookieBanner />
      {/* Theme toggle: floating on landing page only; inline in dashboard (SearchBarGlobal) */}
      {!isAdminPage && <DarkLightButton theme={theme} toggleTheme={toggleTheme} />}
    </>
  );
};

// --- YOUR ORIGINAL FUNCTION ---
function App() {
  return (
    <ThemeProvider>
      <Router>
        <NavigationWrapper />
      </Router>
    </ThemeProvider>
  );
}

export default App;
