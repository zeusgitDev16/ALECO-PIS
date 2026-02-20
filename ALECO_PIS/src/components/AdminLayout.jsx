import React from 'react';
import AdminSidebar from './Sidebar';
import SearchBarGlobal from './searchBars/SearchBarGlobal';
import '../CSS/Dashboard.css';

const AdminLayout = ({ children, activePage }) => {
  return (
    <div className="admin-dashboard-container">
      <AdminSidebar activePage={activePage} />
      
      <div className="admin-main-wrapper">
        <SearchBarGlobal />
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;