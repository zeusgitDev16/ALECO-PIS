import React, { useState } from 'react';
import AdminSidebar from './Sidebar';
import SearchBarGlobal from './searchBars/SearchBarGlobal';
import LandingPage from './headers/landingPage';
import '../CSS/Dashboard.css';

const AdminLayout = ({ children, activePage }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="admin-shell-root">
      <div className="admin-landing-inline" aria-hidden="false">
        <LandingPage />
      </div>
      <div className="admin-dashboard-container">
        <AdminSidebar
          activePage={activePage}
          isOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
        />

        <div className="admin-main-wrapper">
          <SearchBarGlobal toggleSidebar={toggleSidebar} />

          <div className="admin-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
