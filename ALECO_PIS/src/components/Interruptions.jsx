import React, { useState, useEffect } from 'react';
import { apiUrl } from '../utils/api';
import AdminLayout from './AdminLayout';
import '../CSS/AdminPageLayout.css';
import '../CSS/Buttons.css';

const AdminInterruptions = () => {
  const [interruptions, setInterruptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/interruptions'))
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setInterruptions(data.data);
        }
      })
      .catch(() => setInterruptions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout activePage="interruptions">
      <div className="admin-page-container">
        <div className="dashboard-header-flex">
          <div className="header-text-group">
            <h2 className="header-title">Power Interruptions</h2>
            <p className="header-subtitle">Manage scheduled and unscheduled power interruptions.</p>
          </div>
          <button className="btn-add-purple" disabled>+ Create New Post (Coming Soon)</button>
        </div>

        <div className="main-content-card">
          {loading ? (
            <p className="widget-text">Loading...</p>
          ) : interruptions.length === 0 ? (
            <div className="placeholder-content">
              <h3>Recent Interruptions</h3>
              <p className="widget-text">No scheduled interruptions. Full CRUD coming soon.</p>
            </div>
          ) : (
            <ul>
              {interruptions.map((i, idx) => (
                <li key={idx}>{JSON.stringify(i)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminInterruptions;