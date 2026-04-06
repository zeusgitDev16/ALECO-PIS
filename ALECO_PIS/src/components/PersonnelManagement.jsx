import React, { useState, useEffect } from 'react';
import { apiUrl } from '../utils/api';
import AdminLayout from './AdminLayout';
import AddCrew from './personnels/AddCrew';
import AddLinemen from './personnels/AddLinemen';
import PersonnelLayoutPicker from './personnels/PersonnelLayoutPicker';
import CrewGrid from './personnels/CrewGrid';
import CrewTableView from './personnels/CrewTableView';
import CrewKanbanView from './personnels/CrewKanbanView';
import LinemanGrid from './personnels/LinemanGrid';
import LinemanTableView from './personnels/LinemanTableView';
import LinemanKanbanView from './personnels/LinemanKanbanView';
import '../CSS/AdminPageLayout.css';
import '../CSS/PersonnelManagement.css';
import '../CSS/PersonnelLayoutPicker.css';

const PersonnelManagement = () => {
    // --- 1. VIEW & DATA STATE ---
    const [activeTab, setActiveTab] = useState('crews'); // 'crews' or 'pool'
    const [viewMode, setViewMode] = useState('compact'); // 'card' | 'compact' | 'workflow' (must match PersonnelLayoutPicker ids)
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
            // FIXED: Removed the stray '/tickets' from the URLs
            const [crewRes, poolRes] = await Promise.all([
                fetch(apiUrl('/api/crews/list')), 
                fetch(apiUrl('/api/pool/list'))   
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
        setIsLoading(true);
        const isEdit = !!crewData.id;
        
        // FIXED: Removed the stray '/tickets' from the URLs
        const url = isEdit 
            ? apiUrl(`/api/crews/update/${crewData.id}`)
            : apiUrl('/api/crews/add');
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(crewData) 
            });
            
            if (res.ok) {
                setIsCrewModalOpen(false);
                fetchAllData(); 
            } else {
                const errorData = await res.json();
                alert(`Failed to save crew: ${errorData.message}`);
            }
        } catch (error) { 
            console.error("Save Crew Error:", error); 
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveLineman = async (linemanData) => {
        setIsLoading(true);
        const isEdit = !!linemanData.id;
        
        // FIXED: Removed the stray '/tickets' from the URLs
        const url = isEdit 
            ? apiUrl(`/api/pool/update/${linemanData.id}`)
            : apiUrl('/api/pool/add');
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(linemanData) 
            });
            
            if (res.ok) {
                setIsLinemenModalOpen(false);
                fetchAllData(); 
            } else {
                const errorData = await res.json();
                alert(`Failed to save lineman: ${errorData.message}`);
            }
        } catch (error) { 
            console.error("Save Lineman Error:", error); 
        } finally {
            setIsLoading(false);
        }
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
            <div className="admin-page-container personnel-management-container">
                
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

                    {/* --- LAYOUT PICKER (Lego Brick) --- */}
                    <PersonnelLayoutPicker
                        activeLayout={viewMode}
                        onLayoutChange={setViewMode}
                    />

                    {/* --- DYNAMIC VIEWS (Lego Bricks) --- */}
                    {activeTab === 'crews' && (
                        <>
                            {viewMode === 'card' && (
                                <CrewGrid
                                    crews={filteredCrews}
                                    isLoading={isLoading}
                                    onEditCrew={(crew) => { setEditingCrew(crew); setIsCrewModalOpen(true); }}
                                />
                            )}
                            {viewMode === 'compact' && (
                                <CrewTableView
                                    crews={filteredCrews}
                                    isLoading={isLoading}
                                    onEditCrew={(crew) => { setEditingCrew(crew); setIsCrewModalOpen(true); }}
                                />
                            )}
                            {viewMode === 'workflow' && (
                                <CrewKanbanView
                                    crews={filteredCrews}
                                    isLoading={isLoading}
                                    onEditCrew={(crew) => { setEditingCrew(crew); setIsCrewModalOpen(true); }}
                                />
                            )}
                        </>
                    )}
                    {activeTab === 'pool' && (
                        <>
                            {viewMode === 'card' && (
                                <LinemanGrid
                                    linemen={filteredPool}
                                    isLoading={isLoading}
                                    onEditLineman={(man) => { setEditingLineman(man); setIsLinemenModalOpen(true); }}
                                />
                            )}
                            {viewMode === 'compact' && (
                                <LinemanTableView
                                    linemen={filteredPool}
                                    isLoading={isLoading}
                                    onEditLineman={(man) => { setEditingLineman(man); setIsLinemenModalOpen(true); }}
                                />
                            )}
                            {viewMode === 'workflow' && (
                                <LinemanKanbanView
                                    linemen={filteredPool}
                                    isLoading={isLoading}
                                    onEditLineman={(man) => { setEditingLineman(man); setIsLinemenModalOpen(true); }}
                                />
                            )}
                        </>
                    )}
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