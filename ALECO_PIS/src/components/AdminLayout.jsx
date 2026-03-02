import React, { useState } from 'react'; // Added useState import
import AdminSidebar from './Sidebar';
import SearchBarGlobal from './searchBars/SearchBarGlobal';
import '../CSS/Dashboard.css';

const AdminLayout = ({ children, activePage }) => {
  // 1. State for the sliding mobile sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // 2. Toggle function
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="admin-dashboard-container">
      {/* 3. Pass the state and toggle function down to the Sidebar */}
      <AdminSidebar 
        activePage={activePage} 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar} 
      />
      
      <div className="admin-main-wrapper">
        {/* 4. Pass ONLY the toggle function down to the Search Bar / Header */}
        <SearchBarGlobal toggleSidebar={toggleSidebar} />
        
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;