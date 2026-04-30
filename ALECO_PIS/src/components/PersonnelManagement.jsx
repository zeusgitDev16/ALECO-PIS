import React, { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../utils/api';
import { authFetch } from '../utils/authFetch';
import { authMutation } from '../utils/authMutation';
import { REALTIME_MODULES } from '../constants/realtimeModules';
import { matchesRealtimeModule } from '../utils/realtimeModules';
import { useMatchMedia } from '../hooks/useMatchMedia';
import AdminLayout from './AdminLayout';
import AddCrew from './personnels/AddCrew';
import AddLinemen from './personnels/AddLinemen';
import CrewGrid from './personnels/CrewGrid';
import LinemanGrid from './personnels/LinemanGrid';
import PersonnelDetailModal from './personnels/PersonnelDetailModal';
import PersonnelCardActionModal from './personnels/PersonnelCardActionModal';
import '../CSS/AdminPageLayout.css';
import '../CSS/PersonnelManagement.css';
import '../CSS/InterruptionsAdmin.css';
import '../CSS/PersonnelGrid.css';
import '../CSS/PersonnelUIScale.css';
import '../CSS/InterruptionUIScale.css';
import '../CSS/InterruptionModalUIScale.css';
import '../CSS/PersonnelModalUIScale.css';

const PersonnelManagement = () => {
    const [activeTab, setActiveTab] = useState('crews');
    const [crews, setCrews] = useState([]);
    const [linemenPool, setLinemenPool] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isCrewModalOpen, setIsCrewModalOpen] = useState(false);
    const [isLinemenModalOpen, setIsLinemenModalOpen] = useState(false);
    const [editingCrew, setEditingCrew] = useState(null);
    const [editingLineman, setEditingLineman] = useState(null);

    const [detailContext, setDetailContext] = useState(null);
    const [actionContext, setActionContext] = useState(null);
    const isMobile = useMatchMedia('(max-width: 767px)');

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [crewRes, poolRes] = await Promise.all([
                authFetch(apiUrl('/api/crews/list')),
                authFetch(apiUrl('/api/pool/list')),
            ]);

            const crewData = await crewRes.json();
            const poolData = await poolRes.json();

            setCrews(Array.isArray(crewData) ? crewData : []);
            setLinemenPool(Array.isArray(poolData) ? poolData : []);
        } catch (error) {
            console.error('ALECO Data Fetch Error:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    useEffect(() => {
        const onRealtimeChange = (ev) => {
            if (matchesRealtimeModule(ev?.detail?.module, REALTIME_MODULES.PERSONNEL, REALTIME_MODULES.SYSTEM)) {
                fetchAllData();
            }
        };
        window.addEventListener('aleco:realtime-change', onRealtimeChange);
        return () => window.removeEventListener('aleco:realtime-change', onRealtimeChange);
    }, [fetchAllData]);

    const handleDeleteCrew = async (crew) => {
        if (!window.confirm(`Delete crew "${crew.crew_name}"? This cannot be undone.`)) return;
        setIsLoading(true);
        try {
            const result = await authMutation(apiUrl(`/api/crews/delete/${crew.id}`), {
                method: 'DELETE',
                body: {
                    actor_email: localStorage.getItem('userEmail') || '',
                    actor_name: localStorage.getItem('userName') || '',
                },
                emitRealtime: { module: REALTIME_MODULES.PERSONNEL },
            });
            const data = result.data || {};
            if (result.ok) {
                setDetailContext(null);
                setActionContext(null);
                await fetchAllData();
            } else {
                alert(data.message || 'Failed to delete crew.');
            }
        } catch (error) {
            console.error('Delete crew error:', error);
            alert('Failed to delete crew.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteLineman = async (man) => {
        if (!window.confirm(`Remove "${man.full_name}" from the linemen pool? This cannot be undone.`)) return;
        setIsLoading(true);
        try {
            const result = await authMutation(apiUrl(`/api/pool/delete/${man.id}`), {
                method: 'DELETE',
                body: {
                    actor_email: localStorage.getItem('userEmail') || '',
                    actor_name: localStorage.getItem('userName') || '',
                },
                emitRealtime: { module: REALTIME_MODULES.PERSONNEL },
            });
            const data = result.data || {};
            if (result.ok) {
                setDetailContext(null);
                setActionContext(null);
                await fetchAllData();
            } else {
                alert(data.message || 'Failed to delete lineman.');
            }
        } catch (error) {
            console.error('Delete lineman error:', error);
            alert('Failed to delete lineman.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveCrew = async (crewData) => {
        setIsLoading(true);
        const isEdit = !!crewData.id;

        const url = isEdit 
            ? apiUrl(`/api/crews/update/${crewData.id}`)
            : apiUrl('/api/crews/add');
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const result = await authMutation(url, {
                method,
                body: {
                    ...crewData,
                    actor_email: localStorage.getItem('userEmail') || '',
                    actor_name: localStorage.getItem('userName') || '',
                },
                emitRealtime: { module: REALTIME_MODULES.PERSONNEL },
            });
            
            if (result.ok) {
                if (isEdit) {
                    const updatedCrew = {
                        ...crewData,
                        lead_lineman: crewData.lead_id || null,
                        phone_number: crewData.phone_number,
                    };
                    setCrews((prev) =>
                        prev.map((c) => (String(c.id) === String(crewData.id) ? { ...c, ...updatedCrew } : c))
                    );
                }
                setEditingCrew(null);
                setIsCrewModalOpen(false);
                await fetchAllData();
            } else {
                const errorData = result.data || {};
                alert(`Failed to save crew: ${errorData.message}`);
            }
        } catch (error) { 
            console.error('Save Crew Error:', error); 
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveLineman = async (linemanData) => {
        setIsLoading(true);
        const isEdit = !!linemanData.id;
        
        const url = isEdit 
            ? apiUrl(`/api/pool/update/${linemanData.id}`)
            : apiUrl('/api/pool/add');
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const result = await authMutation(url, {
                method,
                body: {
                    ...linemanData,
                    actor_email: localStorage.getItem('userEmail') || '',
                    actor_name: localStorage.getItem('userName') || '',
                },
                emitRealtime: { module: REALTIME_MODULES.PERSONNEL },
            });
            
            if (result.ok) {
                if (isEdit) {
                    const updatedLineman = {
                        ...linemanData,
                        contact_no: linemanData.contact_no,
                    };
                    setLinemenPool((prev) =>
                        prev.map((m) => (String(m.id) === String(linemanData.id) ? { ...m, ...updatedLineman } : m))
                    );
                }
                setEditingLineman(null);
                setIsLinemenModalOpen(false);
                await fetchAllData();
            } else {
                const errorData = result.data || {};
                alert(`Failed to save lineman: ${errorData.message}`);
            }
        } catch (error) { 
            console.error('Save Lineman Error:', error); 
        } finally {
            setIsLoading(false);
        }
    };

    const filteredPool = linemenPool.filter(l => 
        l.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredCrews = crews.filter(c => 
        c.crew_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        if (!detailContext) return;
        if (detailContext.variant === 'lineman') {
            const latest = linemenPool.find((m) => String(m.id) === String(detailContext.data?.id));
            if (latest && latest !== detailContext.data) {
                setDetailContext({ variant: 'lineman', data: latest });
            }
            return;
        }
        if (detailContext.variant === 'crew') {
            const latest = crews.find((c) => String(c.id) === String(detailContext.data?.id));
            if (latest && latest !== detailContext.data) {
                setDetailContext({ variant: 'crew', data: latest });
            }
        }
    }, [detailContext, linemenPool, crews]);

    useEffect(() => {
        if (!actionContext) return;
        if (actionContext.variant === 'lineman') {
            const latest = linemenPool.find((m) => String(m.id) === String(actionContext.data?.id));
            if (latest && latest !== actionContext.data) {
                setActionContext({ variant: 'lineman', data: latest });
            }
            return;
        }
        if (actionContext.variant === 'crew') {
            const latest = crews.find((c) => String(c.id) === String(actionContext.data?.id));
            if (latest && latest !== actionContext.data) {
                setActionContext({ variant: 'crew', data: latest });
            }
        }
    }, [actionContext, linemenPool, crews]);

    const openEditFromDetail = (row) => {
        const v = detailContext?.variant;
        setDetailContext(null);
        if (v === 'crew') {
            setEditingCrew(row);
            setIsCrewModalOpen(true);
        } else if (v === 'lineman') {
            setEditingLineman(row);
            setIsLinemenModalOpen(true);
        }
    };

    return (
        <AdminLayout activePage="personnel">
            <div className="admin-page-container personnel-management-container interruptions-page-container">
                
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

                <div className="dashboard-widget main-content-card">
                    <div className="widget-header-row">
                        <button 
                            className="btn-add-purple btn-advisory-scale" 
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
                            <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input 
                                type="text" 
                                className="table-search-input-compact" 
                                placeholder={`Search ${activeTab}...`} 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {activeTab === 'crews' && (
                        <CrewGrid
                            crews={filteredCrews}
                            isLoading={isLoading}
                            saving={isLoading}
                            onViewDetail={(c) => setDetailContext({ variant: 'crew', data: c })}
                            onEditCrew={(crew) => { setEditingCrew(crew); setIsCrewModalOpen(true); }}
                            onDeleteCrew={handleDeleteCrew}
                            onOpenAction={(c) => setActionContext({ variant: 'crew', data: c })}
                            isMobile={isMobile}
                        />
                    )}
                    {activeTab === 'pool' && (
                        <LinemanGrid
                            linemen={filteredPool}
                            isLoading={isLoading}
                            saving={isLoading}
                            onViewDetail={(m) => setDetailContext({ variant: 'lineman', data: m })}
                            onEditLineman={(man) => { setEditingLineman(man); setIsLinemenModalOpen(true); }}
                            onDeleteLineman={handleDeleteLineman}
                            onOpenAction={(m) => setActionContext({ variant: 'lineman', data: m })}
                            isMobile={isMobile}
                        />
                    )}
                </div>

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

                {detailContext && (
                    <PersonnelDetailModal
                        variant={detailContext.variant}
                        crew={detailContext.variant === 'crew' ? detailContext.data : null}
                        lineman={detailContext.variant === 'lineman' ? detailContext.data : null}
                        onClose={() => setDetailContext(null)}
                        onEdit={openEditFromDetail}
                        saving={isLoading}
                    />
                )}

                {actionContext && (
                    <PersonnelCardActionModal
                        variant={actionContext.variant}
                        crew={actionContext.variant === 'crew' ? actionContext.data : null}
                        lineman={actionContext.variant === 'lineman' ? actionContext.data : null}
                        onClose={() => setActionContext(null)}
                        onViewFull={() => {
                            const ctx = actionContext;
                            setActionContext(null);
                            setDetailContext({ variant: ctx.variant, data: ctx.data });
                        }}
                        onEdit={(row) => {
                            const v = actionContext.variant;
                            setActionContext(null);
                            if (v === 'crew') {
                                setEditingCrew(row);
                                setIsCrewModalOpen(true);
                            } else {
                                setEditingLineman(row);
                                setIsLinemenModalOpen(true);
                            }
                        }}
                        onDelete={(row) => {
                            const v = actionContext.variant;
                            setActionContext(null);
                            if (v === 'crew') handleDeleteCrew(row);
                            else handleDeleteLineman(row);
                        }}
                        saving={isLoading}
                    />
                )}
            </div>

        </AdminLayout>
    );
};

export default PersonnelManagement;
