import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import AdminLayout from './components/AdminLayout.jsx';
import InterruptionList from './InterruptionList.jsx'
import PublicInterruptionPosterPage from './components/interruptions/PublicInterruptionPosterPage.jsx';
import PrintInterruptionPosterPage from './components/interruptions/PrintInterruptionPosterPage.jsx';
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
import ProtectedRoute from './components/ProtectedRoute.jsx';



// --- UPDATED HELPER COMPONENT ---
const NavigationWrapper = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  // Session checks for admin routes live in ProtectedRoute (+ optional API 401 handling).
  // Avoid verify-session on every pathname change here — it caused false logouts on navigation.

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

        <Route path="/poster/interruption/:id" element={<PublicInterruptionPosterPage />} />
        <Route path="/print-interruption/:id" element={<PrintInterruptionPosterPage />} />

        {/* ADMIN ROUTES — session required (password or Google via login.jsx only) */}
        <Route path="/admin-dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin-users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin-tickets" element={<ProtectedRoute><AdminTickets /></ProtectedRoute>} />
        <Route path="/admin-interruptions" element={<ProtectedRoute><AdminInterruptions /></ProtectedRoute>} />
        <Route path="/admin-history" element={<ProtectedRoute><AdminHistory /></ProtectedRoute>} />
        <Route path="/admin-backup" element={<ProtectedRoute><AdminBackup /></ProtectedRoute>} />

        {/* PROFILE ROUTE */}
        <Route path="/admin-profile" element={ 
          <ProtectedRoute>
            <AdminLayout activePage="profile"> 
              <ProfilePage /> 
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* PERSONNEL MANAGEMENT ROUTE */}
        <Route path="/admin-personnel" element={
          <ProtectedRoute><PersonnelManagement /></ProtectedRoute>
        } />

        {/* B2B MAIL ROUTE */}
        <Route path="/admin-b2b-mail" element={
          <ProtectedRoute><B2BMail /></ProtectedRoute>
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
