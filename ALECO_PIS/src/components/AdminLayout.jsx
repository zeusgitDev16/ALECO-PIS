import React, { useEffect, useState } from 'react';
import AdminSidebar from './Sidebar';
import SearchBarGlobal from './searchBars/SearchBarGlobal';
import LandingPage from './headers/landingPage';
import ServiceMemoModalContainer from './ServiceMemoModalContainer';
import { getRealtimeSocket } from '../utils/realtimeSocket.js';
import '../CSS/Dashboard.css';

const AdminLayout = ({ children, activePage }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isServiceMemoModalOpen, setIsServiceMemoModalOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleOpenServiceMemos = () => setIsServiceMemoModalOpen(true);
  const handleCloseServiceMemos = () => setIsServiceMemoModalOpen(false);

  useEffect(() => {
    const socket = getRealtimeSocket();
    const onRealtimeChanged = (payload) => {
      window.dispatchEvent(new CustomEvent('aleco:realtime-change', { detail: payload }));
    };
    socket.on('realtime:entity-changed', onRealtimeChanged);
    return () => {
      socket.off('realtime:entity-changed', onRealtimeChanged);
    };
  }, []);

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
          onOpenServiceMemos={handleOpenServiceMemos}
        />

        <div className="admin-main-wrapper">
          <SearchBarGlobal toggleSidebar={toggleSidebar} />

          <div className="admin-content">
            {children}
          </div>
        </div>
      </div>

      <ServiceMemoModalContainer
        isOpen={isServiceMemoModalOpen}
        onClose={handleCloseServiceMemos}
      />
    </div>
  );
};

export default AdminLayout;
