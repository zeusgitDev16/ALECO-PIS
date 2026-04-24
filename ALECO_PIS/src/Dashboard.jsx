import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from './components/AdminLayout';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts'; // Ensure PieChart, Cell, LineChart, Line, Legend are imported
import { 
    FaTicketAlt, FaClock, FaCheckCircle, FaExclamationTriangle, 
    FaMapMarkerAlt, FaChartPie, FaChartLine, FaListUl,
    FaTools, FaExclamationCircle, FaSearch, FaLock, FaBolt, FaCalendarAlt, FaUsers
} from 'react-icons/fa';
import axios from 'axios';
import { apiUrl } from './utils/api';
import useTickets from './utils/useTickets';
import { FaEnvelope, FaPaperPlane, FaTimesCircle, FaHourglassHalf } from 'react-icons/fa'; // New B2B icons
import './CSS/AdminPageLayout.css';
import './CSS/Dashboard.css';

const AdminDashboard = () => {
    const [greeting, setGreeting] = useState('');
    const [userName, setUserName] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [interruptions, setInterruptions] = useState([]);
    const [loadingAdvisories, setLoadingAdvisories] = useState(true);

    const { tickets = [], loading } = useTickets();

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

        return { active, upcoming, restored24h, total, feeders, topAreas, trendData, causeData, typeData };
    }, [interruptions]);

    // Dynamic calculations for Support Tickets analytics
    const ticketStats = useMemo(() => {
        const hasData = tickets.length > 0;
        const sourceData = hasData ? tickets : [
            { id: 1, status: 'Pending', category: 'Primary Line No Power', municipality: 'Legazpi', is_urgent: 1, created_at: new Date().toISOString() },
            { id: 2, status: 'Ongoing', category: 'Metering Issue', municipality: 'Daraga', is_urgent: 0, created_at: new Date().toISOString() },
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

        return { total, pending, ongoing, resolved, unresolved, nofault, denied, urgent, trendData, categoryData, topLocations };
    }, [tickets]);

    // Dynamic calculations for B2B Mail features
    const b2bMailStats = useMemo(() => {
        // Mock data for B2B Mail
        const totalSent = 1250;
        const delivered = 1180;
        const failed = 50;
        const pending = 20;

        const deliveryData = [
            { name: 'Sent', value: totalSent, fill: 'var(--accent-primary)' },
            { name: 'Delivered', value: delivered, fill: 'var(--accent-success)' },
            { name: 'Failed', value: failed, fill: 'var(--accent-danger)' },
            { name: 'Pending', value: pending, fill: 'var(--accent-warning)' },
        ];

        const recentActivity = [
            { id: 1, subject: 'Advisory: Scheduled Maintenance', recipient: 'ABC Corp', status: 'Sent', time: '2 min ago' },
            { id: 2, subject: 'Invoice: Q1 2024', recipient: 'XYZ Ltd', status: 'Failed', time: '15 min ago' },
            { id: 3, subject: 'Notification: Power Restoration', recipient: 'PQR Inc', status: 'Delivered', time: '1 hour ago' },
            { id: 4, subject: 'Advisory: Unscheduled Outage', recipient: 'LMN Co', status: 'Pending', time: '3 hours ago' },
            { id: 5, subject: 'Report: Monthly Consumption', recipient: 'DEF Group', status: 'Sent', time: 'Yesterday' },
        ];

        // NEW: Mock data for Daily Mail Activity (last 7 days)
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dailyTrendData = days.map((day, index) => ({
            name: day,
            sent: 100 + index * 10 + Math.floor(Math.random() * 20),
            delivered: 90 + index * 10 + Math.floor(Math.random() * 15),
            failed: 5 + Math.floor(Math.random() * 5),
        }));

        // NEW: Mock data for Contact Verification Insights
        const verificationData = [
            { name: 'Verified', value: 94, fill: 'var(--accent-success)' },
            { name: 'Unverified', value: 6, fill: 'var(--accent-warning)' }
        ];

        return { totalSent, delivered, failed, pending, deliveryData, recentActivity, dailyTrendData, verificationData };
    }, []);

    // Dynamic calculations for Personnel Overview
    const personnelStats = useMemo(() => {
        // Mock data for Personnel Overview
        const totalLinemen = 45;
        const availableCrews = 8;
        const activeDeployments = 12;
        const onLeave = 3;

        const crewStatusData = [
            { name: 'Available', value: availableCrews, fill: 'var(--accent-success)' },
            { name: 'On-Task', value: activeDeployments, fill: 'var(--accent-primary)' },
            { name: 'Offline', value: 2, fill: 'var(--text-secondary)' },
        ];

        const recentDeployments = [
            { id: 1, crew: 'Crew Alpha', location: 'Brgy. Rawis', task: 'Line Maintenance', status: 'Deployed', time: 'Started: 08:30 AM' },
            { id: 2, crew: 'Crew Bravo', location: 'Legazpi Port', task: 'Fault Clearing', status: 'Standby', time: 'Awaiting dispatch' },
            { id: 3, crew: 'Crew Charlie', location: 'Daraga Proper', task: 'Transformer Check', status: 'Deployed', time: 'Started: 09:15 AM' },
            { id: 4, crew: 'Crew Delta', location: 'Brgy. Bitano', task: 'Service Connection', status: 'Deployed', time: 'Started: 10:00 AM' },
        ];

        return { totalLinemen, availableCrews, activeDeployments, onLeave, crewStatusData, recentDeployments };
    }, []);


    return (
        <AdminLayout activePage="home">
            <div className="admin-page-container dashboard-page-container">
                {/* Page Header */}
                <div className="dashboard-header">
                    <div className="header-text-group">
                        <h2 className="header-title">{greeting}, {userName}</h2>
                        <p className="header-subtitle">{currentDate}</p>
                    </div>
                    <div className="dashboard-nav-actions">
                        <button 
                            className="dash-nav-btn"
                            onClick={() => document.getElementById('power-grid-section')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            <FaBolt /> Advisories
                        </button>
                        <button 
                            className="dash-nav-btn"
                            onClick={() => document.getElementById('ticket-overview-section')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            <FaChartPie /> Analytics
                        </button>
                        <button 
                            className="dash-nav-btn"
                            onClick={() => document.getElementById('b2b-mail-section')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            <FaListUl /> B2B Mail
                        </button>
                        <button 
                            className="dash-nav-btn"
                            onClick={() => document.getElementById('personnel-section')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            <FaUsers /> Personnel
                        </button>
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
                            <div className="analytics-loading-overlay analytics-pulse">
                                <FaBolt /> Synchronizing Power Grid Intelligence...
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
                    </div>

                    {/* 3. B2B Mail Overview Container */}
                    <div id="b2b-mail-section" className="dashboard-b2b-mail-wrapper">
                        <div className="section-label-group">
                            <h3 className="column-section-title">B2B Mail Overview</h3>
                            <p className="widget-text">Tracking of outgoing business notifications and partner communications.</p>
                        </div>
                        
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
                    </div>

                    {/* 4. Personnel Section Container */}
                    <div id="personnel-section" className="dashboard-personnel-wrapper">
                        <div className="section-label-group">
                            <h3 className="column-section-title">Personnel & Crew Status</h3>
                            <p className="widget-text">Monitoring of field crews, linemen availability, and active deployments.</p>
                        </div>
                        
                        <div className="personnel-analytics-layout">
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
                                        <span className="stat-label">Active Tasks</span>
                                        <h3 className="stat-number">{personnelStats.activeDeployments}</h3>
                                        <span className="stat-trend">Crews deployed</span>
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

                            {/* Recent Personnel/Crew Activity List */}
                            <div className="personnel-activity-list">
                                {personnelStats.recentDeployments.map(deployment => (
                                    <div key={deployment.id} className="personnel-activity-item">
                                        <div className="personnel-activity-content">
                                            <span className="personnel-activity-label">{deployment.crew} - {deployment.task}</span>
                                            <span className="personnel-activity-time">{deployment.location} • {deployment.time}</span>
                                        </div>
                                        <span className={`feeder-status-tag ${deployment.status === 'Deployed' ? 'critical' : 'scheduled'}`}>
                                            {deployment.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
                {/* Existing Incident Tracking Feed below */}
                <div className="main-content-card">
                    <div className="placeholder-content">
                        <h3>Active Incident Tracking</h3>
                        <p className="widget-text">Detailed logs will appear here based on selected filters.</p>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminDashboard;