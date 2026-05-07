import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AdminLayout from './components/AdminLayout';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { 
    FaTicketAlt, FaClock, FaCheckCircle, FaExclamationTriangle, 
    FaMapMarkerAlt, FaChartPie, FaChartLine, FaListUl,
    FaTools, FaExclamationCircle, FaSearch, FaLock, FaBolt, FaCalendarAlt, FaUsers,
    FaFileAlt, FaUserShield, FaUserTie, FaArrowRight
} from 'react-icons/fa';
import axios from 'axios';
import { apiUrl } from './utils/api';
import useTickets from './utils/useTickets';
import { FaEnvelope, FaPaperPlane, FaTimesCircle, FaHourglassHalf } from 'react-icons/fa';
import { authFetch } from './utils/authFetch';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import './CSS/AdminPageLayout.css';
import './CSS/Dashboard.css';

const AdminDashboard = () => {
    /* Mark admin-content as the dashboard scroll host's positioning anchor.
       Cannot rely on :has() in all browsers — this guarantees the rule
       applies and the internal scroll container fills it. */
    useEffect(() => {
        const el = document.querySelector('.admin-content');
        if (!el) return;
        el.classList.add('has-dashboard-scroll');
        return () => el.classList.remove('has-dashboard-scroll');
    }, []);

    const [greeting, setGreeting] = useState('');
    const [userName, setUserName] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [interruptions, setInterruptions] = useState([]);
    const [loadingAdvisories, setLoadingAdvisories] = useState(true);

    const { tickets = [], loading } = useTickets();

    // ── Real data state ──
    const [b2bMessages,    setB2bMessages]    = useState([]);
    const [b2bContacts,    setB2bContacts]    = useState([]);
    const [b2bLoading,     setB2bLoading]     = useState(true);
    const [crews,          setCrews]          = useState([]);
    const [linemen,        setLinemen]        = useState([]);
    const [personnelLoading, setPersonnelLoading] = useState(true);
    const [memos,          setMemos]          = useState([]);
    const [memosLoading,   setMemosLoading]   = useState(true);
    const [users,          setUsers]          = useState([]);
    const [usersLoading,   setUsersLoading]   = useState(true);

    const fetchRealData = useCallback(async () => {
        try {
            const [b2bMsgRes, b2bCtcRes, crewsRes, linemanRes, memosRes, usersRes] = await Promise.allSettled([
                authFetch(apiUrl('/api/b2b-mail/messages')),
                authFetch(apiUrl('/api/b2b-mail/contacts')),
                authFetch(apiUrl('/api/crews/list')),
                authFetch(apiUrl('/api/pool/list')),
                authFetch(apiUrl('/api/service-memos')),
                authFetch(apiUrl('/api/users')),
            ]);

            if (b2bMsgRes.status === 'fulfilled' && b2bMsgRes.value.ok) {
                const d = await b2bMsgRes.value.json();
                setB2bMessages(Array.isArray(d.data) ? d.data : []);
            }
            setB2bLoading(false);

            if (b2bCtcRes.status === 'fulfilled' && b2bCtcRes.value.ok) {
                const d = await b2bCtcRes.value.json();
                setB2bContacts(Array.isArray(d) ? d : (Array.isArray(d.data) ? d.data : []));
            }

            if (crewsRes.status === 'fulfilled' && crewsRes.value.ok) {
                const d = await crewsRes.value.json();
                setCrews(Array.isArray(d) ? d : []);
            }
            if (linemanRes.status === 'fulfilled' && linemanRes.value.ok) {
                const d = await linemanRes.value.json();
                setLinemen(Array.isArray(d) ? d : []);
            }
            setPersonnelLoading(false);

            if (memosRes.status === 'fulfilled' && memosRes.value.ok) {
                const d = await memosRes.value.json();
                setMemos(Array.isArray(d) ? d : (Array.isArray(d.data) ? d.data : []));
            }
            setMemosLoading(false);

            if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
                const d = await usersRes.value.json();
                setUsers(Array.isArray(d) ? d : (Array.isArray(d.users) ? d.users : []));
            }
            setUsersLoading(false);
        } catch (err) {
            console.error('Dashboard: real data fetch error', err);
            setB2bLoading(false);
            setPersonnelLoading(false);
            setMemosLoading(false);
            setUsersLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRealData();
    }, [fetchRealData]);

    useEffect(() => {
        // 1. Calculate greeting based on system time
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 18) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');

        // 2. Fetch the admin's actual name from localStorage
        // System manifest identifies 'userName' and 'userEmail' as primary session keys
        const storedName = localStorage.getItem('userName');
        const storedEmail = localStorage.getItem('userEmail');
        const storedUser = localStorage.getItem('user');

        if (storedName) {
            setUserName(storedName);
        } else if (storedUser) {
            try {
                const userObj = JSON.parse(storedUser);
                setUserName(userObj.name || userObj.username || userObj.email?.split('@')[0] || 'Admin');
            } catch (e) {}
        } else if (storedEmail) {
            setUserName(storedEmail.split('@')[0]);
        }

        // 3. Format date using native Intl (Monday, March 16, 2026)
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        setCurrentDate(new Date().toLocaleDateString('en-US', dateOptions));

        // 4. Fetch real-time Power Advisories
        const fetchAdvisories = async () => {
            try {
                const response = await axios.get(apiUrl('/interruptions'));
                const data = response.data.interruptions || response.data || [];
                setInterruptions(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Dashboard: Error connecting to Power Advisories", err);
            } finally {
                setLoadingAdvisories(false);
            }
        };
        fetchAdvisories();

        const interval = setInterval(fetchAdvisories, 60000); // 60s background refresh
        return () => clearInterval(interval);
    }, []);

    // Dynamic calculations for Power Advisories features
    const interruptionStats = useMemo(() => {
        // Use real data if available, otherwise use placeholders for testing charts/analytics
        const hasData = interruptions.length > 0;
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        const sourceData = hasData ? interruptions : [
            { id: 1, status: 'Ongoing', type: 'Unscheduled', feeder: 'BITANO-1', date_time_start: `${todayStr} 08:30`, cause_category: 'Vegetation', affected_areas: '["Rawis", "Bitano"]' },
            { id: 2, status: 'Ongoing', type: 'Unscheduled', feeder: 'RAWIS-2', date_time_start: `${todayStr} 09:15`, cause_category: 'Equipment Failure', affected_areas: '["Lapu-Lapu"]' },
            { id: 3, status: 'Pending', type: 'Scheduled', feeder: 'POLANGUI-4', date_time_start: `${todayStr} 13:00`, cause_category: 'Maintenance', affected_areas: '["Ubaliw", "Alnay"]' },
            { id: 4, status: 'Restored', type: 'Scheduled', feeder: 'TABACO-1', date_time_start: yesterdayStr, date_time_restored: todayStr, cause_category: 'Maintenance', affected_areas: '["San Roque"]' },
            { id: 5, status: 'Restored', type: 'Unscheduled', feeder: 'LEGAZPI-3', date_time_start: todayStr, date_time_restored: todayStr, cause_category: 'External Factors', affected_areas: '["Albay District"]' }
        ];

        // Active: Current unscheduled interruptions
        const active = sourceData.filter(i => i.status === 'Ongoing' && i.type === 'Unscheduled').length;
        // Upcoming: Scheduled maintenance events
        const upcoming = sourceData.filter(i => i.status === 'Pending' && i.type === 'Scheduled').length;
        const total = hasData ? interruptions.length : 52;
        const cancelled = sourceData.filter(i => i.status === 'Cancelled').length;
        const rescheduled = sourceData.filter(i => i.status === 'Rescheduled').length;
        const scheduledTotal = sourceData.filter(i => i.type === 'Scheduled').length; // Total scheduled advisories
        
        const restored24h = sourceData.filter(i => {
            if (i.status !== 'Restored' || !i.date_time_restored) return false;
            const restoredDate = new Date(i.date_time_restored.replace(' ', 'T'));
            const now = new Date();
            return (now - restoredDate) < (24 * 60 * 60 * 1000);
        }).length;

        // Derive analytics data
        const feederMap = {};
        const areaMap = {};
        const causeMap = {};
        const typeMap = { Scheduled: 0, Unscheduled: 0 };
        
        // Setup real trend map for the last 7 days
        const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const trendMap = {};
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-CA'); // YYYY-MM-DD format
            trendMap[dateStr] = { name: daysShort[d.getDay()], count: 0 };
        }

        sourceData.forEach(i => {
            // 1. Feeder Health Logic
            if (i.feeder) {
                if (!feederMap[i.feeder] || i.status === 'Ongoing') {
                    feederMap[i.feeder] = {
                        name: i.feeder,
                        status: i.status === 'Ongoing' ? 'Critical' : 'Scheduled',
                        load: i.status === 'Ongoing' ? '100%' : '40%',
                        color: i.status === 'Ongoing' ? 'var(--accent-danger)' : 'var(--accent-warning)'
                    };
                }
            }

            // 2. Top Impacted Areas Logic
            let areas = [];
            try {
                areas = typeof i.affected_areas === 'string' ? JSON.parse(i.affected_areas) : i.affected_areas;
            } catch(e) {}
            if (Array.isArray(areas)) {
                areas.forEach(a => {
                    areaMap[a] = (areaMap[a] || 0) + 1;
                });
            }

            // 3. Daily Outage Trend Logic
            if (i.date_time_start) {
                const iDate = i.date_time_start.split(' ')[0];
                if (trendMap[iDate]) {
                    trendMap[iDate].count++;
                }
            }

            // 4. Type Breakdown Logic
            if (i.type && typeMap[i.type] !== undefined) {
                typeMap[i.type]++;
            }

            // 5. Cause Category Logic
            const cause = i.cause_category || 'Uncategorized';
            causeMap[cause] = (causeMap[cause] || 0) + 1;
        });

        const feeders = Object.values(feederMap)
            .sort((a,b) => (b.status === 'Critical') - (a.status === 'Critical'))
            .slice(0, 4);

        const totalItems = Math.max(1, sourceData.length);
        const topAreas = Object.entries(areaMap)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, count]) => ({ 
                name, 
                count, 
                perc: `${Math.min(100, (count / totalItems) * 100)}%` 
            }));

        const causeData = Object.entries(causeMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

        const trendData = Object.values(trendMap);

        return { active, upcoming, restored24h, total, cancelled, scheduledTotal, rescheduled, feeders, topAreas, trendData, causeData, typeData };
    }, [interruptions]);

    // Dynamic calculations for Support Tickets analytics
    const ticketStats = useMemo(() => {
        const hasData = tickets.length > 0;
        const sourceData = hasData ? tickets : [
            { id: 1, status: 'Pending', category: 'Primary Line No Power', municipality: 'Legazpi', is_urgent: 1, created_at: new Date().toISOString() },
            { id: 2, status: 'Ongoing', category: 'Metering Issue', municipality: 'Daraga', is_urgent: 0, created_at: new Date().toISOString(), service_memo_id: 101 },
            { id: 3, status: 'Restored', category: 'Fallen Pole', municipality: 'Camalig', is_urgent: 0, created_at: new Date().toISOString() },
            { id: 4, status: 'NoFaultFound', category: 'Other', municipality: 'Guinobatan', is_urgent: 0, created_at: new Date().toISOString() }
        ];

        // 1. Monthly Trends (Last 6 Months)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const trendMap = {};
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const label = months[d.getMonth()];
            trendMap[label] = 0;
        }

        sourceData.forEach(t => {
            const date = new Date(t.created_at);
            const label = months[date.getMonth()];
            if (trendMap[label] !== undefined) {
                trendMap[label]++;
            }
        });

        const trendData = Object.entries(trendMap).map(([name, count]) => ({ name, count }));

        // 2. Category Breakdown (Top 5)
        const catMap = {};
        sourceData.forEach(t => {
            catMap[t.category || 'Other'] = (catMap[t.category || 'Other'] || 0) + 1;
        });
        const categoryData = Object.entries(catMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // 3. Top Ticket Locations
        const locMap = {};
        sourceData.forEach(t => {
            const loc = t.municipality || 'Unknown';
            locMap[loc] = (locMap[loc] || 0) + 1;
        });
        const totalTickets = Math.max(1, sourceData.length);
        const topLocations = Object.entries(locMap)
            .map(([name, count]) => ({ 
                name, 
                count, 
                perc: `${Math.min(100, (count / totalTickets) * 100)}%` 
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);

        // Summary Counts for Cards
        const total = hasData ? tickets.length : 124;
        const pending = sourceData.filter(t => t.status === 'Pending').length;
        const ongoing = sourceData.filter(t => t.status === 'Ongoing').length;
        const resolved = sourceData.filter(t => ['Restored', 'Resolved'].includes(t.status)).length;
        const unresolved = sourceData.filter(t => t.status === 'Unresolved').length;
        const nofault = sourceData.filter(t => t.status === 'NoFaultFound').length;
        const denied = sourceData.filter(t => t.status === 'AccessDenied').length;
        const urgent = sourceData.filter(t => t.is_urgent === 1).length;
        const memoLinked = sourceData.filter(t => Number(t?.service_memo_id || 0) > 0 || Number(t?.has_service_memo || 0) === 1).length;

        return { total, pending, ongoing, resolved, unresolved, nofault, denied, urgent, memoLinked, trendData, categoryData, topLocations };
    }, [tickets]);

    // Dynamic calculations for B2B Mail — real data
    const b2bMailStats = useMemo(() => {
        const sent    = b2bMessages.filter(m => m.status === 'sent').length;
        const failed  = b2bMessages.filter(m => m.status === 'failed').length;
        const draft   = b2bMessages.filter(m => m.status === 'draft').length;
        const queued  = b2bMessages.filter(m => ['queued','sending'].includes(m.status)).length;
        const totalContacts = b2bContacts.length;
        const verified   = b2bContacts.filter(c => c.is_verified === 1 || c.is_verified === true).length;
        const unverified = totalContacts - verified;

        const deliveryData = [
            { name: 'Sent',   value: sent,   fill: 'var(--accent-success)' },
            { name: 'Failed', value: failed, fill: 'var(--accent-danger)' },
            { name: 'Draft',  value: draft,  fill: 'var(--text-secondary)' },
            { name: 'Queued', value: queued, fill: 'var(--accent-warning)' },
        ];

        const verificationData = [
            { name: 'Verified',   value: verified   || 0, fill: 'var(--accent-success)' },
            { name: 'Unverified', value: unverified || 0, fill: 'var(--accent-warning)' },
        ];

        const recentActivity = b2bMessages.slice(0, 5).map(m => ({
            id:        m.id,
            subject:   m.subject || '(No subject)',
            recipient: m.created_by_email || '—',
            status:    m.status,
            time:      m.updated_at ? new Date(m.updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '—',
        }));

        return { totalSent: sent, delivered: sent, failed, pending: queued, draft, totalContacts, deliveryData, verificationData, recentActivity };
    }, [b2bMessages, b2bContacts]);

    // Dynamic calculations for Personnel — real data
    const personnelStats = useMemo(() => {
        const totalLinemen      = linemen.length;
        const activeLinemen     = linemen.filter(l => (l.status || 'Active').toLowerCase() === 'active').length;
        const onLeave           = linemen.filter(l => (l.status || '').toLowerCase() === 'on leave').length;

        const totalCrews        = crews.length;
        const availableCrews    = crews.filter(c => (c.status || 'Available').toLowerCase() === 'available').length;
        const deployedCrews     = crews.filter(c => (c.status || '').toLowerCase() === 'deployed').length;
        const offlineCrews      = crews.filter(c => (c.status || '').toLowerCase() === 'offline').length;

        const crewStatusData = [
            { name: 'Available', value: availableCrews, fill: 'var(--accent-success)' },
            { name: 'Deployed',  value: deployedCrews,  fill: 'var(--accent-primary)' },
            { name: 'Offline',   value: offlineCrews,   fill: 'var(--text-secondary)' },
        ];

        const recentDeployments = crews.slice(0, 5).map(c => ({
            id:     c.id,
            crew:   c.crew_name,
            status: c.status || 'Available',
            members: c.member_count || 0,
            lead:   c.lead_lineman_name || '—',
        }));

        return { totalLinemen, activeLinemen, onLeave, totalCrews, availableCrews, deployedCrews, crewStatusData, recentDeployments };
    }, [crews, linemen]);

    // Service memo stats — real data
    const memoStats = useMemo(() => {
        const total  = memos.length;
        const saved  = memos.filter(m => m.memo_status === 'saved').length;
        const closed = memos.filter(m => m.memo_status === 'closed').length;
        return { total, saved, closed };
    }, [memos]);

    // Users stats — real data
    const userStats = useMemo(() => {
        const total    = users.length;
        const admins   = users.filter(u => (u.role || '').toLowerCase() === 'admin').length;
        const employees = users.filter(u => (u.role || '').toLowerCase() === 'employee').length;
        const others   = total - admins - employees;
        return { total, admins, employees, others };
    }, [users]);


    return (
        <AdminLayout activePage="home">
            <div className="dashboard-scroll-host">
            <div className="admin-page-container dashboard-page-container">
                {/* Page Header */}
                <div className="dashboard-header">
                    <div className="header-text-group">
                        <h2 className="header-title">{greeting}, {userName}</h2>
                        <p className="header-subtitle">{currentDate}</p>
                    </div>
                    <div className="dashboard-nav-actions">
                        <button className="dash-nav-btn" onClick={() => document.getElementById('power-grid-section')?.scrollIntoView({ behavior: 'smooth' })}><FaBolt /> Advisories</button>
                        <button className="dash-nav-btn" onClick={() => document.getElementById('ticket-overview-section')?.scrollIntoView({ behavior: 'smooth' })}><FaTicketAlt /> Tickets</button>
                        <button className="dash-nav-btn" onClick={() => document.getElementById('memo-users-section')?.scrollIntoView({ behavior: 'smooth' })}><FaFileAlt /> Memos</button>
                        <button className="dash-nav-btn" onClick={() => document.getElementById('b2b-personnel-section')?.scrollIntoView({ behavior: 'smooth' })}><FaEnvelope /> B2B & Crew</button>
                    </div>
                </div>

                {/* ── KPI Ribbon ── */}
                <div className="dash-kpi-ribbon">
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--tickets">
                            {loading ? <Skeleton width={32} height={32} circle /> : <FaTicketAlt />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{loading ? <Skeleton width={80} height={14} /> : 'Total Tickets'}</span>
                            <span className="dash-kpi-value">{loading ? <Skeleton width={60} height={24} /> : ticketStats.total}</span>
                        </div>
                    </div>
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--outage">
                            {loadingAdvisories ? <Skeleton width={32} height={32} circle /> : <FaBolt />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{loadingAdvisories ? <Skeleton width={80} height={14} /> : 'Active Outages'}</span>
                            <span className="dash-kpi-value">{loadingAdvisories ? <Skeleton width={60} height={24} /> : interruptionStats.active}</span>
                        </div>
                    </div>
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--memo">
                            {memosLoading ? <Skeleton width={32} height={32} circle /> : <FaFileAlt />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{memosLoading ? <Skeleton width={80} height={14} /> : 'Service Memos'}</span>
                            <span className="dash-kpi-value">{memosLoading ? <Skeleton width={60} height={24} /> : memoStats.total}</span>
                        </div>
                    </div>
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--users">
                            {usersLoading ? <Skeleton width={32} height={32} circle /> : <FaUsers />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{usersLoading ? <Skeleton width={80} height={14} /> : 'System Users'}</span>
                            <span className="dash-kpi-value">{usersLoading ? <Skeleton width={60} height={24} /> : userStats.total}</span>
                        </div>
                    </div>
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--b2b">
                            {b2bLoading ? <Skeleton width={32} height={32} circle /> : <FaEnvelope />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{b2bLoading ? <Skeleton width={80} height={14} /> : 'B2B Sent'}</span>
                            <span className="dash-kpi-value">{b2bLoading ? <Skeleton width={60} height={24} /> : b2bMailStats.totalSent}</span>
                        </div>
                    </div>
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--crew">
                            {personnelLoading ? <Skeleton width={32} height={32} circle /> : <FaTools />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{personnelLoading ? <Skeleton width={80} height={14} /> : 'Active Crews'}</span>
                            <span className="dash-kpi-value">{personnelLoading ? <Skeleton width={60} height={24} /> : personnelStats.totalCrews}</span>
                        </div>
                    </div>
                </div>

                {/* Analytics Section */}
                <div className="analytics-container">
                    <div className="dashboard-features-grid">
                    {/* 1. Power Advisories Container (Interruptions) */}
                    <div id="power-grid-section" className="dashboard-power-advisories-wrapper">
                        <div className="section-label-group">
                            <h3 className="column-section-title">Power Advisories & Status</h3>
                            <p className="widget-text">Real-time monitoring of power distribution and service advisories.</p>
                        </div>
                        
                        {loadingAdvisories && interruptions.length === 0 ? (
                            <div className="stats-grid">
                                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                    <div key={i} className="stat-card">
                                        <div className="stat-icon-box"><Skeleton width={32} height={32} circle /></div>
                                        <div className="stat-content">
                                            <span className="stat-label"><Skeleton width={100} height={16} /></span>
                                            <h3 className="stat-number"><Skeleton width={60} height={32} /></h3>
                                            <span className="stat-trend"><Skeleton width={80} height={14} /></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                        <>
                        {/* Interruption Summary Stats */}
                        <div className="stats-grid">
                            <div className="stat-card urgent">
                                <div className="stat-icon-box"><FaBolt /></div>
                                <div className="stat-content">
                                    <span className="stat-label">Active Outages</span>
                                    <h3 className="stat-number">{interruptionStats.active}</h3>
                                    <span className="stat-trend negative">Unscheduled</span>
                                </div>
                            </div>
                            <div className="stat-card pending">
                                <div className="stat-icon-box"><FaCalendarAlt /></div>
                                <div className="stat-content">
                                    <span className="stat-label">Upcoming</span>
                                    <h3 className="stat-number">{interruptionStats.upcoming}</h3>
                                    <span className="stat-trend">Scheduled Maint.</span>
                                </div>
                            </div>
                            <div className="stat-card resolved">
                                <div className="stat-icon-box"><FaCheckCircle /></div>
                                <div className="stat-content">
                                    <span className="stat-label">Restored (24h)</span>
                                    <h3 className="stat-number">{interruptionStats.restored24h}</h3>
                                    <span className="stat-trend positive">Normal Ops</span>
                                </div>
                            </div>
                            <div className="stat-card total">
                                <div className="stat-icon-box"><FaListUl /></div>
                                <div className="stat-content">
                                    <span className="stat-label">Total Recorded</span>
                                    <h3 className="stat-number">{interruptionStats.total}</h3>
                                    <span className="stat-trend">Advisory Logs</span>
                                </div>
                            </div>
                            <div className="stat-card scheduled">
                                <div className="stat-icon-box"><FaCalendarAlt /></div>
                                <div className="stat-content">
                                    <span className="stat-label">Total Scheduled</span>
                                    <h3 className="stat-number">{interruptionStats.scheduledTotal}</h3>
                                    <span className="stat-trend">Planned Events</span>
                                </div>
                            </div>
                            <div className="stat-card cancelled">
                                <div className="stat-icon-box"><FaTimesCircle /></div>
                                <div className="stat-content">
                                    <span className="stat-label">Cancelled</span>
                                    <h3 className="stat-number">{interruptionStats.cancelled}</h3>
                                    <span className="stat-trend">No longer active</span>
                                </div>
                            </div>
                            <div className="stat-card rescheduled">
                                <div className="stat-icon-box"><FaClock /></div>
                                <div className="stat-content">
                                    <span className="stat-label">Rescheduled</span>
                                    <h3 className="stat-number">{interruptionStats.rescheduled}</h3>
                                    <span className="stat-trend">Adjusted dates</span>
                                </div>
                            </div>
                        </div>

                        {/* Analytics Grid: Trends & Status Distribution */}
                        <div className="charts-grid-main">
                            <div className="chart-card">
                                <div className="chart-header-group">
                                    <FaChartLine className="chart-icon" />
                                    <h4>Daily Outage Trends</h4>
                                </div>
                                <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height={180}>
                                        <LineChart data={interruptionStats.trendData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="var(--text-secondary)" fontSize={11} />
                                            <YAxis axisLine={false} tickLine={false} stroke="var(--text-secondary)" fontSize={11} />
                                            <Tooltip contentStyle={{ background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                                            <Line type="monotone" dataKey="count" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="chart-card">
                                <div className="chart-header-group">
                                    <FaTools className="chart-icon" />
                                    <h4>Interruption Types</h4>
                                </div>
                                <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height={180}>
                                        <PieChart>
                                            <Pie data={interruptionStats.typeData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                                                <Cell fill="#2563eb" />
                                                <Cell fill="#facc15" />
                                            </Pie>
                                            <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                                            <Legend verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{ paddingBottom: '10px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Insights Grid: Feeder Health & Impacted Areas */}
                        <div className="charts-grid-secondary">
                            <div className="chart-card">
                                <div className="chart-header-group">
                                    <FaExclamationTriangle className="chart-icon" />
                                    <h4>Primary Outage Causes</h4>
                                </div>
                                <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height={150}>
                                        <BarChart layout="vertical" data={interruptionStats.causeData}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} stroke="var(--text-secondary)" fontSize={10} width={90} />
                                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: 'var(--bg-card)' }} />
                                            <Bar dataKey="count" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} barSize={16} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="chart-card">
                                <div className="chart-header-group">
                                    <FaMapMarkerAlt className="chart-icon" />
                                    <h4>Top Impacted Areas</h4>
                                </div>
                                <div className="location-insight-list">
                                    {interruptionStats.topAreas.length > 0 ? (
                                        interruptionStats.topAreas.map((area, index) => (
                                            <div key={index} className="location-row">
                                                <div className="loc-info">
                                                    <span>{area.name}</span>
                                                    <span>{area.count} Issues</span>
                                                </div>
                                                <div className="loc-bar-bg">
                                                    <div className="loc-bar-fill" style={{ width: area.perc }}></div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="widget-text" style={{ textAlign: 'center', opacity: 0.6, padding: '10px 0' }}>No recurring impacted areas recorded.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        </>
                        )}
                    </div>

                    <div id="ticket-overview-section" className="dashboard-ticket-features-wrapper">
                        {/* Optional Section Label for better UX */}
                        <div className="section-label-group">
                            <h3 className="column-section-title">
                                Ticket Overview & Analytics
                            </h3>
                            <p className="widget-text">Real-time performance metrics and distribution.</p>
                        </div>

                    {loading ? (
                        <>
                        {/* 1. Top Summary Cards Skeleton */}
                        <div className="stats-grid">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                                <div key={i} className="stat-card">
                                    <div className="stat-icon-box"><Skeleton width={32} height={32} circle /></div>
                                    <div className="stat-content">
                                        <span className="stat-label"><Skeleton width={100} height={16} /></span>
                                        <h3 className="stat-number"><Skeleton width={60} height={32} /></h3>
                                        <span className="stat-trend"><Skeleton width={80} height={14} /></span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Charts Grid Skeleton */}
                        <div className="charts-grid-main">
                            <div className="chart-card">
                                <div className="chart-header-group">
                                    <Skeleton width={24} height={24} circle />
                                    <h4><Skeleton width={200} height={20} /></h4>
                                </div>
                                <div className="chart-wrapper">
                                    <Skeleton width="100%" height={170} />
                                </div>
                            </div>
                            <div className="chart-card">
                                <div className="chart-header-group">
                                    <Skeleton width={24} height={24} circle />
                                    <h4><Skeleton width={200} height={20} /></h4>
                                </div>
                                <div className="chart-wrapper">
                                    <Skeleton width="100%" height={170} />
                                </div>
                            </div>
                        </div>

                        <div className="charts-grid-secondary">
                            <div className="chart-card">
                                <div className="chart-header-group">
                                    <Skeleton width={24} height={24} circle />
                                    <h4><Skeleton width={200} height={20} /></h4>
                                </div>
                                <div className="chart-wrapper">
                                    <Skeleton width="100%" height={150} />
                                </div>
                            </div>
                            <div className="chart-card">
                                <div className="chart-header-group">
                                    <Skeleton width={24} height={24} circle />
                                    <h4><Skeleton width={200} height={20} /></h4>
                                </div>
                                <div className="location-insight-list">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="location-row">
                                            <div className="loc-info">
                                                <span><Skeleton width={80} height={14} /></span>
                                                <span><Skeleton width={40} height={14} /></span>
                                            </div>
                                            <div className="loc-bar-bg">
                                                <Skeleton width="100%" height={8} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        </>
                    ) : (
                    <>
                    {/* 1. Top Summary Cards */}
                    <div className="stats-grid">
                        <div className="stat-card total">
                            <div className="stat-icon-box"><FaTicketAlt /></div>
                            <div className="stat-content">
                                <span className="stat-label">Total Tickets</span>
                                <h3 className="stat-number">{ticketStats.total}</h3>
                                <span className="stat-trend positive">+5% from yesterday</span>
                            </div>
                        </div>
                        <div className="stat-card pending">
                            <div className="stat-icon-box"><FaClock /></div>
                            <div className="stat-content">
                                <span className="stat-label">Pending</span>
                                <h3 className="stat-number">{ticketStats.pending}</h3>
                                <span className="stat-trend negative">Action required</span>
                            </div>
                        </div>
                        <div className="stat-card ongoing">
                            <div className="stat-icon-box"><FaTools /></div>
                            <div className="stat-content">
                                <span className="stat-label">Ongoing</span>
                                <h3 className="stat-number">{ticketStats.ongoing}</h3>
                                <span className="stat-trend">Crews on field</span>
                            </div>
                        </div>
                        <div className="stat-card resolved">
                            <div className="stat-icon-box"><FaCheckCircle /></div>
                            <div className="stat-content">
                                <span className="stat-label">Resolved</span>
                                <h3 className="stat-number">{ticketStats.resolved}</h3>
                                <span className="stat-trend positive">92% success rate</span>
                            </div>
                        </div>
                        <div className="stat-card unresolved">
                            <div className="stat-icon-box"><FaExclamationCircle /></div>
                            <div className="stat-content">
                                <span className="stat-label">Unresolved</span>
                                <h3 className="stat-number">{ticketStats.unresolved}</h3>
                                <span className="stat-trend negative">Needs review</span>
                            </div>
                        </div>
                        <div className="stat-card nofault">
                            <div className="stat-icon-box"><FaSearch /></div>
                            <div className="stat-content">
                                <span className="stat-label">No Fault Found</span>
                                <h3 className="stat-number">{ticketStats.nofault}</h3>
                                <span className="stat-trend">Verified issue</span>
                            </div>
                        </div>
                        <div className="stat-card denied">
                            <div className="stat-icon-box"><FaLock /></div>
                            <div className="stat-content">
                                <span className="stat-label">Access Denied</span>
                                <h3 className="stat-number">{ticketStats.denied}</h3>
                                <span className="stat-trend negative">Restricted area</span>
                            </div>
                        </div>
                        <div className="stat-card urgent">
                            <div className="stat-icon-box"><FaExclamationTriangle /></div>
                            <div className="stat-content">
                                <span className="stat-label">Urgent</span>
                                <h3 className="stat-number">{ticketStats.urgent}</h3>
                                <span className="stat-trend negative">High priority</span>
                            </div>
                        </div>
                        <div className="stat-card memo">
                            <div className="stat-icon-box"><FaListUl /></div>
                            <div className="stat-content">
                                <span className="stat-label">Memo Linked</span>
                                <h3 className="stat-number">{ticketStats.memoLinked}</h3>
                                <span className="stat-trend">Service Memos</span>
                            </div>
                        </div>
                    </div>

                    {/* 2 & 3. Main Charts Row */}
                    <div className="charts-grid-main">
                        <div className="chart-card">
                            <div className="chart-header-group">
                                <FaChartPie className="chart-icon" />
                                <h4>Ticket Status Distribution</h4>
                            </div>
                            <div className="chart-wrapper">
                                <ResponsiveContainer width="100%" height={170}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Pending', value: ticketStats.pending },
                                                { name: 'Ongoing', value: ticketStats.ongoing },
                                                { name: 'Resolved', value: ticketStats.resolved }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={45}
                                            outerRadius={65}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            <Cell fill="var(--accent-warning)" />
                                            <Cell fill="var(--accent-primary)" />
                                            <Cell fill="var(--accent-success)" />
                                        </Pie>
                                        <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                                        <Legend verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{ paddingTop: '10px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="chart-card">
                            <div className="chart-header-group">
                                <FaChartLine className="chart-icon" />
                                <h4>Monthly Ticket Trends</h4>
                            </div>
                            <div className="chart-wrapper">
                                <ResponsiveContainer width="100%" height={170}>
                                    <LineChart data={ticketStats.trendData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="var(--text-secondary)" fontSize={12} />
                                        <YAxis axisLine={false} tickLine={false} stroke="var(--text-secondary)" fontSize={12} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-card)', borderRadius: '8px' }} />
                                        <Line type="monotone" dataKey="count" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* 4 & 5. Insights Row */}
                    <div className="charts-grid-secondary">
                        <div className="chart-card">
                            <div className="chart-header-group">
                                <FaListUl className="chart-icon" />
                                <h4>Ticket Category Breakdown</h4>
                            </div>
                            <div className="chart-wrapper">
                                <ResponsiveContainer width="100%" height={150}>
                                    <BarChart layout="vertical" data={ticketStats.categoryData}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} stroke="var(--text-secondary)" fontSize={11} width={80} />
                                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: 'var(--bg-card)' }} />
                                        <Bar dataKey="count" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="chart-card">
                            <div className="chart-header-group">
                                <FaMapMarkerAlt className="chart-icon" />
                                <h4>Top Ticket Locations</h4>
                            </div>
                            <div className="location-insight-list">
                                {ticketStats.topLocations.map((loc, index) => (
                                    <div key={index} className="location-row">
                                        <div className="loc-info">
                                            <span>{loc.name}</span>
                                            <span>{loc.count}</span>
                                        </div>
                                        <div className="loc-bar-bg">
                                            <div className="loc-bar-fill" style={{ width: loc.perc }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                    </div> {/* End of Ticket Overview & Analytics Wrapper */}

                    {/* ── B2B Mail + Personnel side-by-side ── */}
                    <div id="b2b-personnel-section" className="dashboard-auxiliary-grid">
                        {/* 3. B2B Mail Overview Container */}
                    <div id="b2b-mail-section" className="dashboard-b2b-mail-wrapper">
                        <div className="section-label-group">
                            <h3 className="column-section-title">B2B Mail Overview</h3>
                            <p className="widget-text">Tracking of outgoing business notifications and partner communications.</p>
                        </div>
                        
                        {b2bLoading ? (
                            <div className="b2b-analytics-layout">
                                {/* B2B Mail Summary Stats Skeleton */}
                                <div className="stats-grid">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="stat-card">
                                            <div className="stat-icon-box"><Skeleton width={32} height={32} circle /></div>
                                            <div className="stat-content">
                                                <span className="stat-label"><Skeleton width={100} height={16} /></span>
                                                <h3 className="stat-number"><Skeleton width={60} height={32} /></h3>
                                                <span className="stat-trend"><Skeleton width={80} height={14} /></span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Charts Grid Skeleton */}
                                <div className="charts-grid-main">
                                    <div className="chart-card">
                                        <div className="chart-header-group">
                                            <Skeleton width={24} height={24} circle />
                                            <h4><Skeleton width={200} height={20} /></h4>
                                        </div>
                                        <div className="chart-wrapper">
                                            <Skeleton width="100%" height={180} />
                                        </div>
                                    </div>
                                    <div className="chart-card">
                                        <div className="chart-header-group">
                                            <Skeleton width={24} height={24} circle />
                                            <h4><Skeleton width={200} height={20} /></h4>
                                        </div>
                                        <div className="chart-wrapper">
                                            <Skeleton width="100%" height={180} />
                                        </div>
                                    </div>
                                </div>

                                {/* Activity List Skeleton */}
                                <div className="b2b-activity-list">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="b2b-activity-item">
                                            <div className="b2b-activity-content">
                                                <span className="b2b-activity-label"><Skeleton width={150} height={14} /></span>
                                                <span className="b2b-activity-time"><Skeleton width={120} height={12} /></span>
                                            </div>
                                            <span className="feeder-status-tag"><Skeleton width={60} height={20} /></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="b2b-analytics-layout">
                            {/* B2B Mail Summary Stats */}
                            <div className="stats-grid">
                                <div className="stat-card total">
                                    <div className="stat-icon-box"><FaEnvelope /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Total Sent</span>
                                        <h3 className="stat-number">{b2bMailStats.totalSent}</h3>
                                        <span className="stat-trend">All Time</span>
                                    </div>
                                </div>
                                <div className="stat-card resolved">
                                    <div className="stat-icon-box"><FaPaperPlane /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Delivered</span>
                                        <h3 className="stat-number">{b2bMailStats.delivered}</h3>
                                        <span className="stat-trend positive">Success Rate</span>
                                    </div>
                                </div>
                                <div className="stat-card urgent">
                                    <div className="stat-icon-box"><FaTimesCircle /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Failed</span>
                                        <h3 className="stat-number">{b2bMailStats.failed}</h3>
                                        <span className="stat-trend negative">Needs Attention</span>
                                    </div>
                                </div>
                                <div className="stat-card pending">
                                    <div className="stat-icon-box"><FaHourglassHalf /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Pending</span>
                                        <h3 className="stat-number">{b2bMailStats.pending}</h3>
                                        <span className="stat-trend">In Queue</span>
                                    </div>
                                </div>
                            </div>

                            {/* B2B Mail Delivery Status Chart */}
                            <div className="charts-grid-main">
                                <div className="chart-card">
                                    <div className="chart-header-group">
                                        <FaChartPie className="chart-icon" />
                                        <h4>Delivery Status</h4>
                                    </div>
                                    <div className="chart-wrapper">
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart data={b2bMailStats.deliveryData} layout="vertical">
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} stroke="var(--text-secondary)" fontSize={11} width={80} />
                                                <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                                                <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* B2B Contact Verification Health Analytics */}
                                <div className="chart-card">
                                    <div className="chart-header-group">
                                        <FaCheckCircle className="chart-icon" />
                                        <h4>Contact Verification Health</h4>
                                    </div>
                                    <div className="chart-wrapper">
                                        <ResponsiveContainer width="100%" height={180}>
                                            <PieChart>
                                                <Pie data={b2bMailStats.verificationData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                                                    {b2bMailStats.verificationData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                                                <Legend verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{ paddingBottom: '10px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Mail Activity List */}
                            <div className="b2b-activity-list">
                                {b2bMailStats.recentActivity.map(activity => (
                                    <div key={activity.id} className="b2b-activity-item">
                                        <div className="b2b-activity-content">
                                            <span className="b2b-activity-label">{activity.subject}</span>
                                            <span className="b2b-activity-time">To: {activity.recipient} • {activity.time}</span>
                                        </div>
                                        <span className={`feeder-status-tag ${activity.status.toLowerCase()}`}>
                                            {activity.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        )}
                    </div>

                    {/* 4. Personnel Section Container */}
                    <div id="personnel-section" className="dashboard-personnel-wrapper">
                        <div className="section-label-group">
                            <h3 className="column-section-title">Personnel & Crew Status</h3>
                            <p className="widget-text">Monitoring of field crews, linemen availability, and active deployments.</p>
                        </div>
                        
                        <div className="personnel-analytics-layout">
                            {personnelLoading ? (
                                <>
                                {/* Personnel Summary Stats Skeleton */}
                                <div className="stats-grid">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="stat-card">
                                            <div className="stat-icon-box"><Skeleton width={32} height={32} circle /></div>
                                            <div className="stat-content">
                                                <span className="stat-label"><Skeleton width={100} height={16} /></span>
                                                <h3 className="stat-number"><Skeleton width={60} height={32} /></h3>
                                                <span className="stat-trend"><Skeleton width={80} height={14} /></span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Chart Skeleton */}
                                <div className="charts-grid-main">
                                    <div className="chart-card">
                                        <div className="chart-header-group">
                                            <Skeleton width={24} height={24} circle />
                                            <h4><Skeleton width={200} height={20} /></h4>
                                        </div>
                                        <div className="chart-wrapper">
                                            <Skeleton width="100%" height={180} />
                                        </div>
                                    </div>
                                </div>

                                {/* Activity List Skeleton */}
                                <div className="personnel-activity-list">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="personnel-activity-item">
                                            <div className="personnel-activity-content">
                                                <span className="personnel-activity-label"><Skeleton width={120} height={14} /></span>
                                                <span className="personnel-activity-time"><Skeleton width={150} height={12} /></span>
                                            </div>
                                            <span className="feeder-status-tag"><Skeleton width={60} height={20} /></span>
                                        </div>
                                    ))}
                                </div>
                                </>
                            ) : (
                                <>
                                {/* Personnel Summary Stats */}
                                <div className="stats-grid">
                                <div className="stat-card total">
                                    <div className="stat-icon-box"><FaUsers /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Total Linemen</span>
                                        <h3 className="stat-number">{personnelStats.totalLinemen}</h3>
                                        <span className="stat-trend">Personnel Pool</span>
                                    </div>
                                </div>
                                <div className="stat-card resolved">
                                    <div className="stat-icon-box"><FaCheckCircle /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Available Crews</span>
                                        <h3 className="stat-number">{personnelStats.availableCrews}</h3>
                                        <span className="stat-trend positive">Ready for dispatch</span>
                                    </div>
                                </div>
                                <div className="stat-card ongoing">
                                    <div className="stat-icon-box"><FaTools /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Deployed Crews</span>
                                        <h3 className="stat-number">{personnelStats.deployedCrews}</h3>
                                        <span className="stat-trend">Crews on field</span>
                                    </div>
                                </div>
                                <div className="stat-card pending">
                                    <div className="stat-icon-box"><FaClock /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">On Leave</span>
                                        <h3 className="stat-number">{personnelStats.onLeave}</h3>
                                        <span className="stat-trend">Away from duty</span>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Row - Crew Status Distribution */}
                            <div className="charts-grid-main">
                                <div className="chart-card">
                                    <div className="chart-header-group">
                                        <FaChartPie className="chart-icon" />
                                        <h4>Crew Status Distribution</h4>
                                    </div>
                                    <div className="chart-wrapper">
                                        <ResponsiveContainer width="100%" height={180}>
                                            <PieChart>
                                                <Pie data={personnelStats.crewStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                                                    {personnelStats.crewStatusData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                                                <Legend verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{ paddingBottom: '10px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Crews List */}
                            <div className="personnel-activity-list">
                                {personnelStats.recentDeployments.length === 0 ? (
                                    <p className="placeholder-desc" style={{ textAlign: 'center', padding: '12px 0' }}>No crews found.</p>
                                ) : personnelStats.recentDeployments.map(deployment => (
                                    <div key={deployment.id} className="personnel-activity-item">
                                        <div className="personnel-activity-content">
                                            <span className="personnel-activity-label">{deployment.crew}</span>
                                            <span className="personnel-activity-time">Lead: {deployment.lead} &bull; {deployment.members} member{deployment.members !== 1 ? 's' : ''}</span>
                                        </div>
                                        <span className={`feeder-status-tag ${deployment.status.toLowerCase() === 'deployed' ? 'critical' : deployment.status.toLowerCase() === 'offline' ? 'failed' : 'scheduled'}`}>
                                            {deployment.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                        )}
                        </div>
                    </div>
                    </div> {/* End of b2b-personnel-section */}

                    {/* ── Service Memos + Users side-by-side ── */}
                    <div id="memo-users-section" className="dashboard-auxiliary-grid">

                        {/* Service Memos Mini-Section */}
                        <div className="dashboard-mini-wrapper">
                            <div className="section-label-group">
                                <h3 className="column-section-title">Service Memos</h3>
                                <p className="widget-text">Summary of field service memo records.</p>
                            </div>
                            {memosLoading ? (
                                <>
                                <div className="stats-grid">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="stat-card">
                                            <div className="stat-icon-box"><Skeleton width={32} height={32} circle /></div>
                                            <div className="stat-content">
                                                <span className="stat-label"><Skeleton width={100} height={16} /></span>
                                                <h3 className="stat-number"><Skeleton width={60} height={32} /></h3>
                                                <span className="stat-trend"><Skeleton width={80} height={14} /></span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="charts-grid-main">
                                    <div className="chart-card">
                                        <div className="chart-header-group">
                                            <Skeleton width={24} height={24} circle />
                                            <h4><Skeleton width={200} height={20} /></h4>
                                        </div>
                                        <div className="chart-wrapper">
                                            <Skeleton width="100%" height={180} />
                                        </div>
                                    </div>
                                </div>
                                </>
                            ) : (
                            <>
                            <div className="stats-grid">
                                <div className="stat-card total">
                                    <div className="stat-icon-box"><FaFileAlt /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Total Memos</span>
                                        <h3 className="stat-number">{memoStats.total}</h3>
                                        <span className="stat-trend">All records</span>
                                    </div>
                                </div>
                                <div className="stat-card pending">
                                    <div className="stat-icon-box"><FaClock /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Saved / Open</span>
                                        <h3 className="stat-number">{memoStats.saved}</h3>
                                        <span className="stat-trend">In progress</span>
                                    </div>
                                </div>
                                <div className="stat-card resolved">
                                    <div className="stat-icon-box"><FaCheckCircle /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Closed</span>
                                        <h3 className="stat-number">{memoStats.closed}</h3>
                                        <span className="stat-trend positive">Completed</span>
                                    </div>
                                </div>
                            </div>
                            <div className="charts-grid-main">
                                <div className="chart-card">
                                    <div className="chart-header-group">
                                        <FaChartPie className="chart-icon" />
                                        <h4>Memo Status Split</h4>
                                    </div>
                                    <div className="chart-wrapper">
                                        <ResponsiveContainer width="100%" height={180}>
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Saved', value: memoStats.saved },
                                                        { name: 'Closed', value: memoStats.closed },
                                                    ]}
                                                    cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value"
                                                >
                                                    <Cell fill="#f59e0b" />
                                                    <Cell fill="#22c55e" />
                                                </Pie>
                                                <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                                                <Legend verticalAlign="bottom" align="center" iconSize={8} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                            </>
                            )}
                        </div>

                        {/* Users Mini-Section */}
                        <div className="dashboard-mini-wrapper">
                            <div className="section-label-group">
                                <h3 className="column-section-title">System Users</h3>
                                <p className="widget-text">Registered accounts and role distribution.</p>
                            </div>
                            {usersLoading ? (
                                <>
                                <div className="stats-grid">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="stat-card">
                                            <div className="stat-icon-box"><Skeleton width={32} height={32} circle /></div>
                                            <div className="stat-content">
                                                <span className="stat-label"><Skeleton width={100} height={16} /></span>
                                                <h3 className="stat-number"><Skeleton width={60} height={32} /></h3>
                                                <span className="stat-trend"><Skeleton width={80} height={14} /></span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="charts-grid-main">
                                    <div className="chart-card">
                                        <div className="chart-header-group">
                                            <Skeleton width={24} height={24} circle />
                                            <h4><Skeleton width={200} height={20} /></h4>
                                        </div>
                                        <div className="chart-wrapper">
                                            <Skeleton width="100%" height={180} />
                                        </div>
                                    </div>
                                </div>
                                </>
                            ) : (
                            <>
                            <div className="stats-grid">
                                <div className="stat-card total">
                                    <div className="stat-icon-box"><FaUsers /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Total Users</span>
                                        <h3 className="stat-number">{userStats.total}</h3>
                                        <span className="stat-trend">All accounts</span>
                                    </div>
                                </div>
                                <div className="stat-card urgent">
                                    <div className="stat-icon-box"><FaUserShield /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Admins</span>
                                        <h3 className="stat-number">{userStats.admins}</h3>
                                        <span className="stat-trend">Full access</span>
                                    </div>
                                </div>
                                <div className="stat-card ongoing">
                                    <div className="stat-icon-box"><FaUserTie /></div>
                                    <div className="stat-content">
                                        <span className="stat-label">Employees</span>
                                        <h3 className="stat-number">{userStats.employees}</h3>
                                        <span className="stat-trend">Staff access</span>
                                    </div>
                                </div>
                            </div>
                            <div className="charts-grid-main">
                                <div className="chart-card">
                                    <div className="chart-header-group">
                                        <FaChartPie className="chart-icon" />
                                        <h4>Role Distribution</h4>
                                    </div>
                                    <div className="chart-wrapper">
                                        <ResponsiveContainer width="100%" height={180}>
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Admin', value: userStats.admins },
                                                        { name: 'Employee', value: userStats.employees },
                                                        { name: 'Other', value: userStats.others },
                                                    ]}
                                                    cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value"
                                                >
                                                    <Cell fill="#a855f7" />
                                                    <Cell fill="#22c55e" />
                                                    <Cell fill="#64748b" />
                                                </Pie>
                                                <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                                                <Legend verticalAlign="bottom" align="center" iconSize={8} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                            </>
                            )}
                        </div>

                    </div> {/* End of memo-users-section */}

                    </div> {/* End of Analytics Container */}
                </div>
            </div> {/* End of dashboard-page-container */}
            </div> {/* End of dashboard-scroll-host */}
        </AdminLayout>
    );
};

export default AdminDashboard;