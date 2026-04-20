import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from './components/AdminLayout';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { 
    FaTicketAlt, FaClock, FaCheckCircle, FaExclamationTriangle, 
    FaMapMarkerAlt, FaChartPie, FaChartLine, FaListUl,
    FaTools, FaExclamationCircle, FaSearch, FaLock, FaBolt, FaCalendarAlt
} from 'react-icons/fa';
import axios from 'axios';
import { apiUrl } from './utils/api';
import useTickets from './utils/useTickets';
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
        const active = interruptions.filter(i => i.status === 'Ongoing').length;
        const upcoming = interruptions.filter(i => i.status === 'Pending').length;
        const total = interruptions.length;
        
        const restored24h = interruptions.filter(i => {
            if (i.status !== 'Restored' || !i.date_time_restored) return false;
            const restoredDate = new Date(i.date_time_restored);
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

        interruptions.forEach(i => {
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

        const totalItems = Math.max(1, interruptions.length);
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
        // 1. Monthly Trends (Last 6 Months)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const trendMap = {};
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const label = months[d.getMonth()];
            trendMap[label] = 0;
        }

        tickets.forEach(t => {
            const date = new Date(t.created_at);
            const label = months[date.getMonth()];
            if (trendMap[label] !== undefined) {
                trendMap[label]++;
            }
        });

        const trendData = Object.entries(trendMap).map(([name, count]) => ({ name, count }));

        // 2. Category Breakdown (Top 5)
        const catMap = {};
        tickets.forEach(t => {
            catMap[t.category] = (catMap[t.category] || 0) + 1;
        });
        const categoryData = Object.entries(catMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // 3. Top Ticket Locations
        const locMap = {};
        tickets.forEach(t => {
            const loc = t.municipality || 'Unknown';
            locMap[loc] = (locMap[loc] || 0) + 1;
        });
        const topLocations = Object.entries(locMap)
            .map(([name, count]) => ({ 
                name, 
                count, 
                perc: `${Math.min(100, (count / Math.max(1, tickets.length)) * 100)}%` 
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);

        return { trendData, categoryData, topLocations };
    }, [tickets]);

    return (
        <AdminLayout activePage="home">
            <div className="admin-page-container dashboard-page-container">
                {/* Page Header */}
                <div className="dashboard-header">
                    <div className="header-text-group">
                        <h2 className="header-title">{greeting}, {userName}</h2>
                        <p className="header-subtitle">{currentDate}</p>
                    </div>
                </div>

                {/* Analytics Section */}
                <div className="analytics-container">
                    {/* 1. Power Advisories Container (Interruptions) */}
                    <div className="dashboard-power-advisories-wrapper">
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

                    <div className="dashboard-ticket-features-wrapper">
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
                                <h3 className="stat-number">{tickets.length}</h3>
                                <span className="stat-trend positive">+5% from yesterday</span>
                            </div>
                        </div>
                        <div className="stat-card pending">
                            <div className="stat-icon-box"><FaClock /></div>
                            <div className="stat-content">
                                <span className="stat-label">Pending</span>
                                <h3 className="stat-number">{tickets.filter(t => t.status === 'Pending').length}</h3>
                                <span className="stat-trend negative">Action required</span>
                            </div>
                        </div>
                        <div className="stat-card ongoing">
                            <div className="stat-icon-box"><FaTools /></div>
                            <div className="stat-content">
                                <span className="stat-label">Ongoing</span>
                                <h3 className="stat-number">{tickets.filter(t => t.status === 'Ongoing').length}</h3>
                                <span className="stat-trend">Crews on field</span>
                            </div>
                        </div>
                        <div className="stat-card resolved">
                            <div className="stat-icon-box"><FaCheckCircle /></div>
                            <div className="stat-content">
                                <span className="stat-label">Resolved</span>
                                <h3 className="stat-number">{tickets.filter(t => ['Restored', 'Resolved'].includes(t.status)).length}</h3>
                                <span className="stat-trend positive">92% success rate</span>
                            </div>
                        </div>
                        <div className="stat-card unresolved">
                            <div className="stat-icon-box"><FaExclamationCircle /></div>
                            <div className="stat-content">
                                <span className="stat-label">Unresolved</span>
                                <h3 className="stat-number">{tickets.filter(t => t.status === 'Unresolved').length}</h3>
                                <span className="stat-trend negative">Needs review</span>
                            </div>
                        </div>
                        <div className="stat-card nofault">
                            <div className="stat-icon-box"><FaSearch /></div>
                            <div className="stat-content">
                                <span className="stat-label">No Fault Found</span>
                                <h3 className="stat-number">{tickets.filter(t => t.status === 'NoFaultFound').length}</h3>
                                <span className="stat-trend">Verified issue</span>
                            </div>
                        </div>
                        <div className="stat-card denied">
                            <div className="stat-icon-box"><FaLock /></div>
                            <div className="stat-content">
                                <span className="stat-label">Access Denied</span>
                                <h3 className="stat-number">{tickets.filter(t => t.status === 'AccessDenied').length}</h3>
                                <span className="stat-trend negative">Restricted area</span>
                            </div>
                        </div>
                        <div className="stat-card urgent">
                            <div className="stat-icon-box"><FaExclamationTriangle /></div>
                            <div className="stat-content">
                                <span className="stat-label">Urgent</span>
                                <h3 className="stat-number">{tickets.filter(t => t.is_urgent === 1).length}</h3>
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
                                                { name: 'Pending', value: tickets.filter(t => t.status === 'Pending').length },
                                                { name: 'Ongoing', value: tickets.filter(t => t.status === 'Ongoing').length },
                                                { name: 'Resolved', value: tickets.filter(t => ['Restored', 'Resolved'].includes(t.status)).length }
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