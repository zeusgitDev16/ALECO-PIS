import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import AddCrew from './personnels/AddCrew';
import AddLinemen from './personnels/AddLinemen';
import '../CSS/PersonnelManagement.css';

const PersonnelManagement = () => {
    // --- 1. VIEW & DATA STATE ---
    const [activeTab, setActiveTab] = useState('crews'); // 'crews' or 'pool'
    const [crews, setCrews] = useState([]);
    const [linemenPool, setLinemenPool] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // --- 2. MODAL STATE ---
    const [isCrewModalOpen, setIsCrewModalOpen] = useState(false);
    const [isLinemenModalOpen, setIsLinemenModalOpen] = useState(false);
    const [editingCrew, setEditingCrew] = useState(null);
    const [editingLineman, setEditingLineman] = useState(null);

    // --- 3. DATABASE FETCHING ---
    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const [crewRes, poolRes] = await Promise.all([
                fetch('http://localhost:5000/api/tickets/crews/list'), // Fixed: Pointing back to ticket.js routes
                fetch('http://localhost:5000/api/tickets/pool/list')   // We will build this next
            ]);

            const crewData = await crewRes.json();
            const poolData = await poolRes.json();

            setCrews(Array.isArray(crewData) ? crewData : []);
            setLinemenPool(Array.isArray(poolData) ? poolData : []);
        } catch (error) {
            console.error("ALECO Data Fetch Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- 4. SAVE HANDLERS ---
    const handleSaveCrew = async (crewData) => {
        console.log("Saving Crew to DB:", crewData);
        setIsCrewModalOpen(false);
        fetchAllData(); 
    };

    const handleSaveLineman = async (linemanData) => {
        console.log("Saving Lineman to DB:", linemanData);
        setIsLinemenModalOpen(false);
        fetchAllData(); 
    };

    // --- 5. RENDER HELPERS ---
    const filteredPool = linemenPool.filter(l => 
        l.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredCrews = crews.filter(c => 
        c.crew_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminLayout activePage="personnel">
            <div className="personnel-dashboard">
                
                {/* --- HEADER & TABS --- */}
                <div className="dashboard-header-flex">
                    <div className="header-text-group">
                        <h2 className="header-title">Personnel Management</h2>
                        <p className="header-subtitle">Assemble crews and manage the linemen pool.</p>
                    </div>
                    
                    <div className="tab-navigation">
                        <button 
                            className={`tab-btn ${activeTab === 'crews' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('crews')}
                        >
                            Active Crews
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'pool' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('pool')}
                        >
                            Linemen Pool
                        </button>
                    </div>
                </div>

                {/* --- MAIN CONTENT WIDGET --- */}
                <div className="dashboard-widget main-content-card">
                    <div className="widget-header-row">
                        <button 
                            className="btn-add-purple" 
                            onClick={() => {
                                if (activeTab === 'crews') {
                                    setEditingCrew(null);
                                    setIsCrewModalOpen(true);
                                } else {
                                    setEditingLineman(null);
                                    setIsLinemenModalOpen(true);
                                }
                            }}
                        >
                            {activeTab === 'crews' ? '+ Assemble New Crew' : '+ Register Lineman'}
                        </button>
                        <div className="search-container-mini">
                            <input 
                                type="text" 
                                className="table-search-input-compact" 
                                placeholder={`Search ${activeTab}...`} 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* --- DYNAMIC TABLES --- */}
                    <div className="users-table-container">
                        {isLoading ? (
                            <p style={{fontSize: '0.7rem', color: '#888'}}>Loading database records...</p>
                        ) : activeTab === 'crews' ? (
                            <table className="users-table">
                                <thead>
                                    <tr>
                                        <th>Unit Designation</th>
                                        <th>Lead Lineman</th>
                                        <th>Composition</th>
                                        <th>Hotline</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCrews.map(crew => (
                                        <tr key={crew.id}>
                                            <td className="user-email">{crew.crew_name}</td>
                                            <td><span className="lead-badge">{crew.lead_lineman_name || 'Unassigned'}</span></td>
                                            <td>{crew.members?.length || 0} Members</td>
                                            <td className="user-code">{crew.phone_number}</td>
                                            <td><span className={`role-badge ${crew.status?.toLowerCase() || 'active'}`}>{crew.status || 'Active'}</span></td>
                                            <td>
                                                <button className="action-btn-toggle" onClick={() => {
                                                    setEditingCrew(crew); 
                                                    setIsCrewModalOpen(true);
                                                }}>Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredCrews.length === 0 && (
                                        <tr><td colSpan="6" style={{textAlign: 'center', padding: '15px'}}>No crews found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="users-table">
                                <thead>
                                    <tr>
                                        <th>Full Name</th>
                                        <th>Designation</th>
                                        <th>Personal Contact</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPool.map(man => (
                                        <tr key={man.id}>
                                            <td className="user-email">{man.full_name}</td>
                                            <td>{man.designation}</td>
                                            <td className="user-code">{man.contact_no}</td>
                                            <td><span className="status-dot active">● Active</span></td>
                                            <td>
                                                <button className="action-btn-toggle" onClick={() => {
                                                    setEditingLineman(man);
                                                    setIsLinemenModalOpen(true);
                                                }}>Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredPool.length === 0 && (
                                        <tr><td colSpan="5" style={{textAlign: 'center', padding: '15px'}}>No personnel found in the database.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* --- THE IMPORTED MODALS (No redundant inline code!) --- */}
            <AddCrew 
                isOpen={isCrewModalOpen} 
                onClose={() => setIsCrewModalOpen(false)} 
                onSave={handleSaveCrew}
                linemenPool={linemenPool}
                initialData={editingCrew}
            />

            <AddLinemen 
                isOpen={isLinemenModalOpen} 
                onClose={() => setIsLinemenModalOpen(false)} 
                onSave={handleSaveLineman}
                initialData={editingLineman}
            />

        </AdminLayout>
    );
};

export default PersonnelManagement;