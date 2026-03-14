import React, { useState } from 'react';
import AdminSidebar from './Sidebar';
import SearchBarGlobal from './searchBars/SearchBarGlobal';
import '../CSS/Dashboard.css';

const AdminLayout = ({ children, activePage }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="admin-dashboard-container">
      <AdminSidebar 
        activePage={activePage} 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar} 
      />
      
      <div className="admin-main-wrapper">
        <SearchBarGlobal toggleSidebar={toggleSidebar} />
        
        {/* ✅ NO SCROLL HERE - Just a container */}
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
