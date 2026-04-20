import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from './components/AdminLayout';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { 
    FaTicketAlt, FaClock, FaCheckCircle, FaExclamationTriangle, 
    FaMapMarkerAlt, FaChartPie, FaChartLine, FaListUl,
    FaTools, FaExclamationCircle, FaSearch, FaLock
} from 'react-icons/fa';
import useTickets from './utils/useTickets';
import './CSS/AdminPageLayout.css';
import './CSS/Dashboard.css';

const AdminDashboard = () => {
    const [greeting, setGreeting] = useState('');
    const [userName, setUserName] = useState('');
    const [currentDate, setCurrentDate] = useState('');

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
                </div>

                {/* Analytics Section */}
                <div className="analytics-container">
                    <div className="dashboard-ticket-features-wrapper">
                        {/* Optional Section Label for better UX */}
                        <div className="section-label-group">
                            <h3 className="column-section-title" style={{ marginTop: 0, marginBottom: '8px' }}>
                                Ticket Overview & Analytics
                            </h3>
                            <p className="widget-text" style={{ fontSize: '0.85rem', marginBottom: '10px' }}>Real-time performance metrics and distribution.</p>
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
                                    <LineChart data={[
                                        { name: 'Jan', count: 42 }, { name: 'Feb', count: 38 }, { name: 'Mar', count: 55 },
                                        { name: 'Apr', count: 48 }, { name: 'May', count: 70 }, { name: 'Jun', count: 61 }
                                    ]}>
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
                                    <BarChart layout="vertical" data={[
                                        { name: 'No Light', count: 12 }, { name: 'Rotten Pole', count: 8 },
                                        { name: 'Meter Calib', count: 15 }, { name: 'Upgrade', count: 5 }
                                    ]}>
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
                                {[
                                    { name: 'Daraga', count: 24, perc: '45%' },
                                    { name: 'Legazpi City', count: 18, perc: '32%' },
                                    { name: 'Guinobatan', count: 9, perc: '15%' }
                                ].map((loc, index) => (
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