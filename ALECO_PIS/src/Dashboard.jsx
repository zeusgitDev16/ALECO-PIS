import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { listInterruptions } from './api/interruptionsApi';
import { 
    CAUSE_CATEGORY_FORM_OPTIONS, 
    getCauseCategoryLabel, 
    isEmergencyOutageType, 
    isInterruptionEnergizedStatus 
} from './utils/interruptionLabels';
import { FaEnvelope, FaPaperPlane, FaTimesCircle, FaHourglassHalf } from 'react-icons/fa';
import { authFetch } from './utils/authFetch';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import './CSS/AdminPageLayout.css';
import './CSS/Dashboard.css';
import './CSS/DashboardUIScale.css';

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
    const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
    const scrollHostRef = useRef(null);
    const headerRef = useRef(null);

    const { tickets = [], loading } = useTickets({ includeChildren: true });

    // ── Ticket dashboard stats (accurate counts from DB) ──
    const [ticketDashStats, setTicketDashStats] = useState(null);
    const [ticketStatsLoading, setTicketStatsLoading] = useState(true);

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

    // --- PREMIUM NAVIGATION & UI LOGIC ---

    /**
     * Shell Scroll Lock: Ensures the parent container doesn't double-scroll.
     */
    useEffect(() => {
        const mainWrapper = document.querySelector('.admin-main-wrapper');
        if (mainWrapper) {
            mainWrapper.classList.add('is-dashboard-active');
        }
        return () => {
            if (mainWrapper) mainWrapper.classList.remove('is-dashboard-active');
        };
    }, []);

    /**
     * Scroll Listener: Tracks if header should show glassmorphism.
     */
    useEffect(() => {
        const host = scrollHostRef.current;
        if (!host) return;

        const handleHostScroll = () => {
            setIsHeaderScrolled(host.scrollTop > 20);
        };

        host.addEventListener('scroll', handleHostScroll);
        return () => host.removeEventListener('scroll', handleHostScroll);
    }, []);

    /**
     * Slow Smooth Scroll: Custom easing animator for a premium feel.
     * @param {string} targetId - ID of element to scroll to
     * @param {number} duration - Duration in ms
     */
    const slowScrollTo = useCallback((targetId, duration = 1200) => {
        const host = scrollHostRef.current;
        const target = document.getElementById(targetId);
        if (!host || !target) return;

        // Calculate offset (Sticky header height + buffer)
        const headerHeight = headerRef.current?.getBoundingClientRect().height || 80;
        const start = host.scrollTop;
        const targetPos = target.offsetTop - headerHeight - 10;
        const change = targetPos - start;
        const startTime = performance.now();

        // Easing function: easeInOutCubic
        const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeInOutCubic(progress);

            host.scrollTop = start + change * easedProgress;

            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            }
        };

        requestAnimationFrame(animateScroll);
    }, []);

    const [ticketSyncLoading, setTicketSyncLoading] = useState(false);

    const fetchRealData = useCallback(async () => {
        try {
            // Fetch ticket dashboard stats separately for accuracy
            authFetch(apiUrl('/api/tickets/dashboard-stats')).then(async (res) => {
                if (res.ok) {
                    const d = await res.json();
                    if (d.success) setTicketDashStats(d.data);
                }
                setTicketStatsLoading(false);
                setTicketSyncLoading(false);
            }).catch(() => {
                setTicketStatsLoading(false);
                setTicketSyncLoading(false);
            });

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

    // ── Real-time Ticket Sync ──
    useEffect(() => {
        const onRealtimeChange = (ev) => {
            const module = ev?.detail?.module;
            // Listen for ticket-related changes
            if (module === 'TICKETS' || module === 'SERVICE_MEMOS' || module === 'SYSTEM') {
                console.log('Dashboard: Real-time ticket change detected, refreshing...');
                setTicketSyncLoading(true);
                fetchRealData();
            }
        };
        window.addEventListener('aleco:realtime-change', onRealtimeChange);
        return () => window.removeEventListener('aleco:realtime-change', onRealtimeChange);
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

        // 4. Fetch real-time Power Advisories (active only, no deleted/archived)
        const fetchAdvisories = async () => {
            try {
                // Use the proper API function with authentication
                const result = await listInterruptions({
                    limit: 200,
                    includeFuture: true,
                    includeDeleted: false,
                    deletedOnly: false
                });
                
                if (result.success && !result.unavailable) {
                    const rawData = result.data || [];
                    
                    // Filter out any deleted or archived items client-side as extra safety
                    const activeData = rawData.filter(i => 
                        !i.is_deleted && 
                        !i.deleted && 
                        !i.is_archived && 
                        !i.archived
                    );
                    
                    console.log('Dashboard: Fetched interruptions:', rawData.length, 'raw items');
                    console.log('Dashboard: Active interruptions:', activeData.length, 'items');
                    console.log('Dashboard: First active item:', activeData[0]);
                    setInterruptions(activeData);
                } else {
                    console.error('Dashboard: API returned error or unavailable:', result.message);
                    setInterruptions([]);
                }
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
        // Only use real data - no mock fallback
        const hasData = interruptions.length > 0;
        console.log('Dashboard: hasData =', hasData, 'interruptions.length =', interruptions.length);
        
        // Return N/A state when no data available
        if (!hasData) {
            return {
                active: 0,
                upcoming: 0,
                restored24h: 0,
                total: 0,
                cancelled: 0,
                scheduledTotal: 0,
                rescheduled: 0,
                feeders: [],
                topAreas: [],
                trendData: [],
                causeData: [],
                statusData: null // null indicates no data for pie chart
            };
        }

        const sourceData = interruptions;

        // Active: Current unscheduled interruptions
        const active = sourceData.filter(i => i.status === 'Ongoing' && isEmergencyOutageType(i.type)).length;
        // Upcoming: Scheduled maintenance events
        const upcoming = sourceData.filter(i => i.status === 'Pending' && !isEmergencyOutageType(i.type)).length;
        const total = hasData ? interruptions.length : 52;
        const cancelled = sourceData.filter(i => i.status === 'Cancelled').length;
        const rescheduled = sourceData.filter(i => i.status === 'Rescheduled').length;
        const scheduledTotal = sourceData.filter(i => i.type === 'Scheduled' || i.type === 'NgcScheduled').length; // Total scheduled advisories
        
        const restored24h = sourceData.filter(i => {
            if (!isInterruptionEnergizedStatus(i.status) || !i.dateTimeRestored) return false;
            const restoredDate = new Date(i.dateTimeRestored);
            const now = new Date();
            return (now - restoredDate) < (24 * 60 * 60 * 1000);
        }).length;

        // Derive analytics data
        const feederMap = {};
        const areaMap = {};
        const causeMap = {};
        // Status breakdown for pie chart: Upcoming, Ongoing, Energized, Cancelled, Rescheduled
        const statusMap = { Upcoming: 0, Ongoing: 0, Energized: 0, Cancelled: 0, Rescheduled: 0 };
        
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
            // Check both camelCase (API) and snake_case (legacy) field names
            // Handle both flat array (affectedAreas) and grouped format (affectedAreasGrouped)
            let areas = [];
            
            // Try grouped areas first (from poster sections)
            if (i.affectedAreasGrouped && Array.isArray(i.affectedAreasGrouped)) {
                i.affectedAreasGrouped.forEach(group => {
                    if (group.items && Array.isArray(group.items)) {
                        group.items.forEach(area => {
                            if (area && String(area).trim()) {
                                areaMap[String(area).trim()] = (areaMap[String(area).trim()] || 0) + 1;
                            }
                        });
                    }
                });
            }
            
            // Also try flat affectedAreas array (from where & why section)
            try {
                areas = i.affectedAreas || i.affected_areas || [];
                if (typeof areas === 'string') {
                    areas = JSON.parse(areas);
                }
            } catch(e) {}
            
            if (Array.isArray(areas)) {
                areas.forEach(a => {
                    if (a && String(a).trim()) {
                        areaMap[String(a).trim()] = (areaMap[String(a).trim()] || 0) + 1;
                    }
                });
            }

            // 3. Daily Outage Trend Logic
            if (i.dateTimeStart) {
                // Ensure date is parsed in local time to match trendMap keys (YYYY-MM-DD)
                const iDate = new Date(i.dateTimeStart).toLocaleDateString('en-CA');
                if (trendMap[iDate]) {
                    trendMap[iDate].count++;
                }
            }

            // 4. Status Breakdown Logic (for Interruption Types pie chart)
            // Note: Archived/deleted already filtered at API level
            
            // Map interruption status to display categories
            // Real data uses: Pending, Ongoing, Restored, Cancelled, Rescheduled
            // Display as: Upcoming (Pending), Ongoing, Energized (Restored), Cancelled, Rescheduled
            const status = i.status;
            if (status === 'Pending') {
                statusMap.Upcoming++; // Pending = Upcoming
            } else if (status === 'Ongoing') {
                statusMap.Ongoing++;
            } else if (status === 'Restored' || status === 'Energized') {
                statusMap.Energized++; // Restored/Energized = Energized
            } else if (status === 'Cancelled') {
                statusMap.Cancelled++;
            } else if (status === 'Rescheduled') {
                statusMap.Rescheduled++;
            }

            // 5. Cause Category Logic - use official categories from CAUSE_CATEGORY_FORM_OPTIONS
            // Map cause_category to official display label
            // Check both cause_category and causeCategory field names
            const rawCause = i.cause_category || i.causeCategory || '';
            const causeLabel = getCauseCategoryLabel(rawCause) || 'Other';
            causeMap[causeLabel] = (causeMap[causeLabel] || 0) + 1;
        });

        const feeders = Object.values(feederMap)
            .sort((a,b) => (b.status === 'Critical') - (a.status === 'Critical'))
            .slice(0, 4);

        const totalItems = Math.max(1, Object.keys(areaMap).length || 1);
        const topAreas = Object.entries(areaMap)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, count]) => ({ 
                name, 
                count, 
                perc: `${Math.min(100, (count / totalItems) * 100)}%` 
            }));
        
        console.log('Dashboard: areaMap =', areaMap);
        console.log('Dashboard: topAreas =', topAreas);

        // Build causeData ensuring all official categories are represented (with 0 if no data)
        const officialCategories = CAUSE_CATEGORY_FORM_OPTIONS
            .filter(opt => opt.value !== '') // exclude '(none)'
            .map(opt => opt.label);
        
        const causeData = officialCategories
            .map(name => ({ name, count: causeMap[name] || 0 }))
            .filter(item => item.count > 0) // only show categories with data
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        console.log('Dashboard: causeMap =', causeMap);
        console.log('Dashboard: causeData =', causeData);
        console.log('Dashboard: First item cause fields:', { cause_category: sourceData[0]?.cause_category, causeCategory: sourceData[0]?.causeCategory });

        const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));
        console.log('Dashboard: statusMap =', statusMap);
        console.log('Dashboard: statusData =', statusData);

        const trendData = Object.values(trendMap);
        console.log('Dashboard: trendData =', trendData);

        return { active, upcoming, restored24h, total, cancelled, scheduledTotal, rescheduled, feeders, topAreas, trendData, causeData, statusData };
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
            const yearKey = d.getFullYear();
            const fullKey = `${label}-${yearKey}`;
            trendMap[fullKey] = { name: label, count: 0, order: 5 - i };
        }

        sourceData.forEach(t => {
            const date = new Date(t.created_at);
            const label = months[date.getMonth()];
            const yearKey = date.getFullYear();
            const fullKey = `${label}-${yearKey}`;
            
            if (trendMap[fullKey] !== undefined) {
                trendMap[fullKey].count++;
            }
        });

        const trendData = Object.values(trendMap)
            .sort((a, b) => a.order - b.order)
            .map(({ name, count }) => ({ name, count }));

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

        // Summary Counts for Cards — use DB stats if available, else fall back to ticket array
        const total    = ticketDashStats ? Number(ticketDashStats.total)       : (hasData ? tickets.length : 0);
        const pending  = ticketDashStats ? Number(ticketDashStats.pending)      : sourceData.filter(t => t.status === 'Pending').length;
        const ongoing  = ticketDashStats ? Number(ticketDashStats.ongoing)      : sourceData.filter(t => t.status === 'Ongoing').length;
        const onhold   = ticketDashStats ? Number(ticketDashStats.onhold)       : sourceData.filter(t => t.status === 'OnHold').length;
        const resolved = ticketDashStats ? Number(ticketDashStats.resolved)     : sourceData.filter(t => ['Restored', 'Resolved'].includes(t.status)).length;
        const unresolved = ticketDashStats ? Number(ticketDashStats.unresolved) : sourceData.filter(t => t.status === 'Unresolved').length;
        const nofault  = ticketDashStats ? Number(ticketDashStats.nofault)      : sourceData.filter(t => t.status === 'NoFaultFound').length;
        const denied   = ticketDashStats ? Number(ticketDashStats.denied)       : sourceData.filter(t => t.status === 'AccessDenied').length;
        const urgent   = ticketDashStats ? Number(ticketDashStats.urgent)       : sourceData.filter(t => t.is_urgent === 1).length;
        const memoLinked = ticketDashStats ? Number(ticketDashStats.memo_linked) : sourceData.filter(t => Number(t?.service_memo_id || 0) > 0 || Number(t?.has_service_memo || 0) === 1).length;

        return { total, pending, ongoing, onhold, resolved, unresolved, nofault, denied, urgent, memoLinked, trendData, categoryData, topLocations };
    }, [tickets, ticketDashStats]);

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
            <div className="dashboard-scroll-host" ref={scrollHostRef}>
            <div className="admin-page-container dashboard-page-container">
                {/* Page Header */}
                <div className={`dashboard-header ${isHeaderScrolled ? 'is-scrolled' : ''}`} ref={headerRef}>
                    <div className="header-text-group">
                        <h2 className="header-title">{greeting}, {userName}</h2>
                        <p className="header-subtitle">{currentDate}</p>
                    </div>
                    <div className="dashboard-nav-actions">
                        <button className="dash-nav-btn" aria-label="Power Advisories" onClick={() => slowScrollTo('power-grid-section')}><FaBolt /> <span className="dash-nav-text">Advisories</span></button>
                        <button className="dash-nav-btn" aria-label="Tickets" onClick={() => slowScrollTo('ticket-overview-section')}><FaTicketAlt /> <span className="dash-nav-text">Tickets</span></button>
                        <button className="dash-nav-btn" aria-label="Memos" onClick={() => slowScrollTo('memo-users-section')}><FaFileAlt /> <span className="dash-nav-text">Memos</span></button>
                        <button className="dash-nav-btn" aria-label="B2B and Crew" onClick={() => slowScrollTo('b2b-personnel-section')}><FaEnvelope /> <span className="dash-nav-text">B2B & Crew</span></button>
                    </div>
                </div>

                {/* ── KPI Ribbon ── Unified Structural Skeleton Loading */}
                {(() => {
                    const kpiLoading = loading || loadingAdvisories || memosLoading || usersLoading || b2bLoading || personnelLoading;
                    return (
                <div className="dash-kpi-ribbon">
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--tickets">
                            {kpiLoading ? <div className="kpi-icon-skeleton" /> : <FaTicketAlt />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{kpiLoading ? <Skeleton width={75} height={12} /> : 'Total Tickets'}</span>
                            <span className="dash-kpi-value">{kpiLoading ? <Skeleton width={35} height={20} /> : ticketStats.total}</span>
                        </div>
                    </div>
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--outage">
                            {kpiLoading ? <div className="kpi-icon-skeleton" /> : <FaBolt />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{kpiLoading ? <Skeleton width={85} height={12} /> : 'Active Outages'}</span>
                            <span className="dash-kpi-value">{kpiLoading ? <Skeleton width={35} height={20} /> : interruptionStats.active}</span>
                        </div>
                    </div>
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--memo">
                            {kpiLoading ? <div className="kpi-icon-skeleton" /> : <FaFileAlt />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{kpiLoading ? <Skeleton width={90} height={12} /> : 'Service Memos'}</span>
                            <span className="dash-kpi-value">{kpiLoading ? <Skeleton width={35} height={20} /> : memoStats.total}</span>
                        </div>
                    </div>
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--users">
                            {kpiLoading ? <div className="kpi-icon-skeleton" /> : <FaUsers />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{kpiLoading ? <Skeleton width={85} height={12} /> : 'System Users'}</span>
                            <span className="dash-kpi-value">{kpiLoading ? <Skeleton width={35} height={20} /> : userStats.total}</span>
                        </div>
                    </div>
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--b2b">
                            {kpiLoading ? <div className="kpi-icon-skeleton" /> : <FaEnvelope />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{kpiLoading ? <Skeleton width={65} height={12} /> : 'B2B Sent'}</span>
                            <span className="dash-kpi-value">{kpiLoading ? <Skeleton width={35} height={20} /> : b2bMailStats.totalSent}</span>
                        </div>
                    </div>
                    <div className="dash-kpi-card">
                        <div className="dash-kpi-icon dash-kpi-icon--crew">
                            {kpiLoading ? <div className="kpi-icon-skeleton" /> : <FaTools />}
                        </div>
                        <div className="dash-kpi-body">
                            <span className="dash-kpi-label">{kpiLoading ? <Skeleton width={80} height={12} /> : 'Active Crews'}</span>
                            <span className="dash-kpi-value">{kpiLoading ? <Skeleton width={35} height={20} /> : personnelStats.totalCrews}</span>
                        </div>
                    </div>
                </div>
                    );
                })()}

                {/* Analytics Section */}
                <div className="analytics-container">
                    <div className="dashboard-features-grid">
                    {/* 1. Power Advisories Container (Interruptions) */}
                    <div id="power-grid-section" className="dashboard-power-advisories-wrapper">
                        <div className="section-label-group">
                            <h3 className="column-section-title">Power Advisories & Status</h3>
                            <p className="widget-text">Real-time monitoring of power distribution and service advisories.</p>
                        </div>

                        {/* Interruption Summary Stats - Unified Cards */}
                        <div className="dash-summary-grid count-7">
                            <div className="dash-summary-card outage">
                                <div className="dash-summary-title">
                                    {loadingAdvisories ? <Skeleton width={80} height={10} /> : 'Active Outages'}
                                </div>
                                <div className="dash-summary-count">
                                    {loadingAdvisories ? <Skeleton width={40} height={16} /> : interruptionStats.active}
                                </div>
                                <div className="dash-summary-trend">
                                    {loadingAdvisories ? <Skeleton width={60} height={8} /> : 'Unscheduled'}
                                </div>
                            </div>
                            <div className="dash-summary-card pending">
                                <div className="dash-summary-title">
                                    {loadingAdvisories ? <Skeleton width={60} height={10} /> : 'Upcoming'}
                                </div>
                                <div className="dash-summary-count">
                                    {loadingAdvisories ? <Skeleton width={40} height={16} /> : interruptionStats.upcoming}
                                </div>
                                <div className="dash-summary-trend">
                                    {loadingAdvisories ? <Skeleton width={70} height={8} /> : 'Scheduled Maint.'}
                                </div>
                            </div>
                            <div className="dash-summary-card restored">
                                <div className="dash-summary-title">
                                    {loadingAdvisories ? <Skeleton width={80} height={10} /> : 'Restored (24h)'}
                                </div>
                                <div className="dash-summary-count">
                                    {loadingAdvisories ? <Skeleton width={40} height={16} /> : interruptionStats.restored24h}
                                </div>
                                <div className="dash-summary-trend">
                                    {loadingAdvisories ? <Skeleton width={60} height={8} /> : 'Normal Ops'}
                                </div>
                            </div>
                            <div className="dash-summary-card total">
                                <div className="dash-summary-title">
                                    {loadingAdvisories ? <Skeleton width={80} height={10} /> : 'Total Recorded'}
                                </div>
                                <div className="dash-summary-count">
                                    {loadingAdvisories ? <Skeleton width={40} height={16} /> : interruptionStats.total}
                                </div>
                                <div className="dash-summary-trend">
                                    {loadingAdvisories ? <Skeleton width={60} height={8} /> : 'Advisory Logs'}
                                </div>
                            </div>
                            <div className="dash-summary-card scheduled">
                                <div className="dash-summary-title">
                                    {loadingAdvisories ? <Skeleton width={80} height={10} /> : 'Total Scheduled'}
                                </div>
                                <div className="dash-summary-count">
                                    {loadingAdvisories ? <Skeleton width={40} height={16} /> : interruptionStats.scheduledTotal}
                                </div>
                                <div className="dash-summary-trend">
                                    {loadingAdvisories ? <Skeleton width={60} height={8} /> : 'Planned Events'}
                                </div>
                            </div>
                            <div className="dash-summary-card cancelled">
                                <div className="dash-summary-title">
                                    {loadingAdvisories ? <Skeleton width={60} height={10} /> : 'Cancelled'}
                                </div>
                                <div className="dash-summary-count">
                                    {loadingAdvisories ? <Skeleton width={40} height={16} /> : interruptionStats.cancelled}
                                </div>
                                <div className="dash-summary-trend">
                                    {loadingAdvisories ? <Skeleton width={70} height={8} /> : 'No longer active'}
                                </div>
                            </div>
                            <div className="dash-summary-card rescheduled">
                                <div className="dash-summary-title">
                                    {loadingAdvisories ? <Skeleton width={70} height={10} /> : 'Rescheduled'}
                                </div>
                                <div className="dash-summary-count">
                                    {loadingAdvisories ? <Skeleton width={40} height={16} /> : interruptionStats.rescheduled}
                                </div>
                                <div className="dash-summary-trend">
                                    {loadingAdvisories ? <Skeleton width={60} height={8} /> : 'Adjusted dates'}
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
                                <div className="chart-wrapper chart-wrapper--fullwidth daily-outage-trends-chart">
                                    {loadingAdvisories
                                        ? <Skeleton height="100%" borderRadius={8} />
                                        : interruptionStats.trendData.length === 0 ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                                                N/A
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%" key={`trend-${interruptionStats.trendData.length}`}>
                                                <LineChart data={interruptionStats.trendData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                                <XAxis 
                                                    dataKey="name" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    stroke="var(--text-secondary)" 
                                                    tick={{ fontSize: 10 }}
                                                    interval={0}
                                                />
                                                <YAxis 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    stroke="var(--text-secondary)" 
                                                    tick={{ fontSize: 10 }}
                                                    width={30}
                                                />
                                                <Tooltip 
                                                    contentStyle={{ 
                                                        background: 'var(--bg-card)', 
                                                        borderRadius: '6px', 
                                                        border: '1px solid var(--border-color)',
                                                        fontSize: '12px'
                                                    }} 
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="count" 
                                                    stroke="var(--accent-primary)" 
                                                    strokeWidth={2}
                                                    dot={{ r: 2 }}
                                                    activeDot={{ r: 4 }}
                                                    isAnimationActive={false}
                                                />
                                            </LineChart>
                                            </ResponsiveContainer>
                                        )
                                    }
                                </div>
                            </div>

                            <div className="chart-card">
                                <div className="chart-header-group">
                                    <FaTools className="chart-icon" />
                                    <h4>Interruption Types</h4>
                                </div>
                                <div className="chart-wrapper interruption-types-chart-wrapper">
                                    {loadingAdvisories
                                        ? <Skeleton height="100%" borderRadius={8} />
                                        : !interruptionStats.statusData
                                            ? (
                                                <div className="interruption-types-na">
                                                    N/A
                                                </div>
                                            )
                                            : (
                                                <>
                                                    {/* Desktop/Tablet: Standard pie chart with bottom legend */}
                                                    <div className="interruption-types-desktop">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie 
                                                                    data={interruptionStats.statusData} 
                                                                    cx="50%" 
                                                                    cy={`${parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pie-center-y')) || 50}%`}
                                                                    innerRadius={parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pie-inner-radius')) || 45}
                                                                    outerRadius={parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pie-outer-radius')) || 65}
                                                                    paddingAngle={parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pie-padding-angle')) || 5}
                                                                    dataKey="value"
                                                                >
                                                                    {interruptionStats.statusData?.map((entry, index) => {
                                                                        const colors = ['#3b82f6', '#ef4444', '#22c55e', '#6b7280', '#f97316'];
                                                                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                                                    })}
                                                                </Pie>
                                                                <Tooltip 
                                                                    contentStyle={{ 
                                                                        background: 'var(--bg-card)', 
                                                                        borderColor: 'var(--border-color)', 
                                                                        borderRadius: 'clamp(6px, calc(8px * var(--dashboard-ui-scale, 1)), 10px)',
                                                                        fontSize: 'clamp(10px, calc(12px * var(--dashboard-ui-scale, 1)), 14px)'
                                                                    }} 
                                                                />
                                                                <Legend 
                                                                    verticalAlign="bottom" 
                                                                    align="center" 
                                                                    iconSize={parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--legend-icon-size')) || 8}
                                                                    wrapperStyle={{ 
                                                                        paddingBottom: 'clamp(4px, calc(8px * var(--dashboard-ui-scale, 1)), 12px)',
                                                                        paddingTop: '2px',
                                                                        fontSize: `${parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--legend-font-size')) || 12}px`
                                                                    }} 
                                                                />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                    
                                                    {/* Mobile: Dual pane - left small circle, right legend */}
                                                    <div className="interruption-types-mobile">
                                                        <div className="mobile-chart-left">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <PieChart>
                                                                    <Pie 
                                                                        data={interruptionStats.statusData} 
                                                                        cx="50%" 
                                                                        cy="50%"
                                                                        innerRadius={15}
                                                                        outerRadius={28}
                                                                        paddingAngle={2}
                                                                        dataKey="value"
                                                                    >
                                                                        {interruptionStats.statusData?.map((entry, index) => {
                                                                            const colors = ['#3b82f6', '#ef4444', '#22c55e', '#6b7280', '#f97316'];
                                                                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                                                        })}
                                                                    </Pie>
                                                                    <Tooltip 
                                                                        contentStyle={{ 
                                                                            background: 'var(--bg-card)', 
                                                                            borderColor: 'var(--border-color)', 
                                                                            borderRadius: '6px',
                                                                            fontSize: '10px'
                                                                        }} 
                                                                    />
                                                                </PieChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                        <div className="mobile-chart-right">
                                                            {interruptionStats.statusData?.map((entry, index) => {
                                                                const colors = ['#3b82f6', '#ef4444', '#22c55e', '#6b7280', '#f97316'];
                                                                return (
                                                                    <div key={index} className="mobile-legend-item">
                                                                        <span 
                                                                            className="mobile-legend-color" 
                                                                            style={{ backgroundColor: colors[index % colors.length] }}
                                                                        />
                                                                        <span className="mobile-legend-label">{entry.name}</span>
                                                                        <span className="mobile-legend-value">{entry.value}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </>
                                            )
                                    }
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
                                <div className="location-insight-list location-insight-list--scrollable">
                                    {loadingAdvisories ? (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="location-row">
                                                <div className="loc-info">
                                                    <span><Skeleton width={100} height={parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--list-skeleton-height')) || 11} /></span>
                                                    <span><Skeleton width={20} height={parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--list-skeleton-height')) || 11} /></span>
                                                </div>
                                                <div className="loc-bar-bg">
                                                    <div className="loc-bar-fill" style={{ width: 0 }}></div>
                                                </div>
                                            </div>
                                        ))
                                    ) : !interruptionStats.causeData || interruptionStats.causeData.length === 0 ? (
                                        <div className="location-list-na">
                                            N/A
                                        </div>
                                    ) : (
                                        <div className="location-list-content">
                                            {interruptionStats.causeData.map((cause, index) => {
                                                const maxCount = Math.max(...interruptionStats.causeData.map(c => c.count), 1);
                                                const percentage = `${(cause.count / maxCount) * 100}%`;
                                                return (
                                                    <div key={index} className="location-row">
                                                        <div className="loc-info">
                                                            <span style={{ fontSize: 'clamp(11px, calc(12px * var(--dashboard-ui-scale, 1)), 14px)' }}>{cause.name}</span>
                                                            <span style={{ fontSize: 'clamp(10px, calc(11px * var(--dashboard-ui-scale, 1)), 12px)' }}>{cause.count}</span>
                                                        </div>
                                                        <div className="loc-bar-bg">
                                                            <div className="loc-bar-fill" style={{ width: percentage }}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="chart-card">
                                <div className="chart-header-group">
                                    <FaMapMarkerAlt className="chart-icon" />
                                    <h4>Top Impacted Areas</h4>
                                </div>
                                <div className="location-insight-list location-insight-list--scrollable">
                                    {loadingAdvisories ? (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="location-row">
                                                <div className="loc-info">
                                                    <span><Skeleton width={100} height={parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--list-skeleton-height')) || 11} /></span>
                                                    <span><Skeleton width={20} height={parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--list-skeleton-height')) || 11} /></span>
                                                </div>
                                                <div className="loc-bar-bg">
                                                    <div className="loc-bar-fill" style={{ width: 0 }}></div>
                                                </div>
                                            </div>
                                        ))
                                    ) : interruptionStats.topAreas.length > 0 ? (
                                        <div className="location-list-content">
                                            {interruptionStats.topAreas.map((area, index) => (
                                                <div key={index} className="location-row">
                                                    <div className="loc-info">
                                                        <span style={{ fontSize: 'clamp(11px, calc(12px * var(--dashboard-ui-scale, 1)), 14px)' }}>{area.name}</span>
                                                        <span style={{ fontSize: 'clamp(10px, calc(11px * var(--dashboard-ui-scale, 1)), 12px)' }}>{area.count} Issues</span>
                                                    </div>
                                                    <div className="loc-bar-bg">
                                                        <div className="loc-bar-fill" style={{ width: area.perc }}></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="location-list-na">
                                            N/A
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="ticket-overview-section" className="dashboard-ticket-features-wrapper">
                        {/* Optional Section Label for better UX */}
                        <div className="section-label-group">
                            <h3 className="column-section-title">
                                Ticket Overview & Analytics
                            </h3>
                            <p className="widget-text">Real-time performance metrics and distribution.</p>
                        </div>

                        {/* 1. Top Summary Cards - Unified */}
                        <div className="dash-summary-grid count-10">
                            <div className="dash-summary-card total">
                                <div className="dash-summary-title">{ticketStatsLoading ? <Skeleton width={70} height={10} /> : 'Total Tickets'}</div>
                                <div className="dash-summary-count">{ticketStatsLoading ? <Skeleton width={40} height={16} /> : ticketStats.total}</div>
                                <div className="dash-summary-trend">{ticketStatsLoading ? <Skeleton width={60} height={8} /> : 'All time records'}</div>
                            </div>
                            <div className="dash-summary-card pending">
                                <div className="dash-summary-title">{ticketStatsLoading ? <Skeleton width={50} height={10} /> : 'Pending'}</div>
                                <div className="dash-summary-count">{ticketStatsLoading ? <Skeleton width={40} height={16} /> : ticketStats.pending}</div>
                                <div className="dash-summary-trend">{ticketStatsLoading ? <Skeleton width={60} height={8} /> : 'Action required'}</div>
                            </div>
                            <div className="dash-summary-card ongoing">
                                <div className="dash-summary-title">{ticketStatsLoading ? <Skeleton width={50} height={10} /> : 'Ongoing'}</div>
                                <div className="dash-summary-count">{ticketStatsLoading ? <Skeleton width={40} height={16} /> : ticketStats.ongoing}</div>
                                <div className="dash-summary-trend">{ticketStatsLoading ? <Skeleton width={60} height={8} /> : 'Crews on field'}</div>
                            </div>
                            <div className="dash-summary-card restored">
                                <div className="dash-summary-title">{ticketStatsLoading ? <Skeleton width={50} height={10} /> : 'Resolved'}</div>
                                <div className="dash-summary-count">{ticketStatsLoading ? <Skeleton width={40} height={16} /> : ticketStats.resolved}</div>
                                <div className="dash-summary-trend">{ticketStatsLoading ? <Skeleton width={60} height={8} /> : 'Restored / closed'}</div>
                            </div>
                            <div className="dash-summary-card outage">
                                <div className="dash-summary-title">{ticketStatsLoading ? <Skeleton width={60} height={10} /> : 'Unresolved'}</div>
                                <div className="dash-summary-count">{ticketStatsLoading ? <Skeleton width={40} height={16} /> : ticketStats.unresolved}</div>
                                <div className="dash-summary-trend">{ticketStatsLoading ? <Skeleton width={60} height={8} /> : 'Needs review'}</div>
                            </div>
                            <div className="dash-summary-card cancelled">
                                <div className="dash-summary-title">{ticketStatsLoading ? <Skeleton width={70} height={10} /> : 'No Fault Found'}</div>
                                <div className="dash-summary-count">{ticketStatsLoading ? <Skeleton width={40} height={16} /> : ticketStats.nofault}</div>
                                <div className="dash-summary-trend">{ticketStatsLoading ? <Skeleton width={60} height={8} /> : 'Verified clear'}</div>
                            </div>
                            <div className="dash-summary-card pending">
                                <div className="dash-summary-title">{ticketStatsLoading ? <Skeleton width={70} height={10} /> : 'On Hold'}</div>
                                <div className="dash-summary-count">{ticketStatsLoading ? <Skeleton width={40} height={16} /> : ticketStats.onhold}</div>
                                <div className="dash-summary-trend">{ticketStatsLoading ? <Skeleton width={60} height={8} /> : 'Paused tickets'}</div>
                            </div>
                            <div className="dash-summary-card denied">
                                <div className="dash-summary-title">{ticketStatsLoading ? <Skeleton width={70} height={10} /> : 'Access Denied'}</div>
                                <div className="dash-summary-count">{ticketStatsLoading ? <Skeleton width={40} height={16} /> : ticketStats.denied}</div>
                                <div className="dash-summary-trend">{ticketStatsLoading ? <Skeleton width={60} height={8} /> : 'Restricted area'}</div>
                            </div>
                            <div className="dash-summary-card urgent">
                                <div className="dash-summary-title">{ticketStatsLoading ? <Skeleton width={40} height={10} /> : 'Urgent'}</div>
                                <div className="dash-summary-count">{ticketStatsLoading ? <Skeleton width={40} height={16} /> : ticketStats.urgent}</div>
                                <div className="dash-summary-trend">{ticketStatsLoading ? <Skeleton width={60} height={8} /> : 'High priority'}</div>
                            </div>
                            <div className="dash-summary-card memo">
                                <div className="dash-summary-title">{ticketStatsLoading ? <Skeleton width={60} height={10} /> : 'Memo Linked'}</div>
                                <div className="dash-summary-count">{ticketStatsLoading ? <Skeleton width={40} height={16} /> : ticketStats.memoLinked}</div>
                                <div className="dash-summary-trend">{ticketStatsLoading ? <Skeleton width={60} height={8} /> : 'Service Memos'}</div>
                            </div>
                        </div>

                    {/* 2 & 3. Main Charts Row */}
                    <div className="charts-grid-main">
                        <div className="chart-card">
                            <div className="chart-header-group">
                                <FaChartPie className="chart-icon" />
                                <h4>Ticket Status Distribution</h4>
                            </div>
                            <div className="chart-wrapper ticket-status-chart-wrapper">
                                {ticketStatsLoading ? <Skeleton height="100%" borderRadius={8} /> : (() => {
                                    const statusPieData = [
                                        { name: 'Pending',      value: ticketStats.pending,    fill: '#f59e0b' },
                                        { name: 'Ongoing',      value: ticketStats.ongoing,    fill: '#3b82f6' },
                                        { name: 'On Hold',      value: ticketStats.onhold,     fill: '#64748b' },
                                        { name: 'Resolved',     value: ticketStats.resolved,   fill: '#22c55e' },
                                        { name: 'Unresolved',   value: ticketStats.unresolved, fill: '#ef4444' },
                                        { name: 'No Fault',     value: ticketStats.nofault,    fill: '#a78bfa' },
                                        { name: 'Access Denied',value: ticketStats.denied,     fill: '#fb923c' },
                                    ].filter(d => d.value > 0);
                                    return statusPieData.length === 0 ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>N/A</div>
                                    ) : (
                                        <>
                                            {/* Desktop/Tablet: Standard pie with bottom legend */}
                                            <div className="interruption-types-desktop">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={statusPieData}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={45}
                                                            outerRadius={65}
                                                            paddingAngle={3}
                                                            dataKey="value"
                                                            isAnimationActive={false}
                                                        >
                                                            {statusPieData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '12px' }} formatter={(value, name) => [value, name]} />
                                                        <Legend verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>

                                            {/* Mobile: Dual pane - left small circle, right legend */}
                                            <div className="interruption-types-mobile">
                                                <div className="mobile-chart-left">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={statusPieData}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={15}
                                                                outerRadius={28}
                                                                paddingAngle={2}
                                                                dataKey="value"
                                                                isAnimationActive={false}
                                                            >
                                                                {statusPieData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '6px', fontSize: '10px' }} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="mobile-chart-right">
                                                    {statusPieData.map((entry, index) => (
                                                        <div key={index} className="mobile-legend-item">
                                                            <span className="mobile-legend-color" style={{ backgroundColor: entry.fill }} />
                                                            <span className="mobile-legend-label">{entry.name}</span>
                                                            <span className="mobile-legend-value">{entry.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="chart-card">
                            <div className="chart-header-group">
                                <FaChartLine className="chart-icon" />
                                <h4>Monthly Ticket Trends</h4>
                            </div>
                            <div className="chart-wrapper">
                                <ResponsiveContainer width="100%" height="100%">
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
                                <ResponsiveContainer width="100%" height="100%">
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
                    </div> {/* End of Ticket Overview & Analytics Wrapper */}

                    {/* ── B2B Mail + Personnel side-by-side ── */}
                    <div id="b2b-personnel-section" className="dashboard-auxiliary-grid">
                        {/* 3. B2B Mail Overview Container */}
                    <div id="b2b-mail-section" className="dashboard-b2b-mail-wrapper">
                        <div className="section-label-group">
                            <h3 className="column-section-title">B2B Mail Overview</h3>
                            <p className="widget-text">Tracking of outgoing business notifications and partner communications.</p>
                        </div>
                        
                        <div className="b2b-analytics-layout">
                            {/* B2B Mail Summary Stats - Unified Cards */}
                            <div className="dash-summary-grid count-4">
                                <div className="dash-summary-card total">
                                    <div className="dash-summary-title">{b2bLoading ? <Skeleton width={60} height={10} /> : 'Total Sent'}</div>
                                    <div className="dash-summary-count">{b2bLoading ? <Skeleton width={40} height={16} /> : b2bMailStats.totalSent}</div>
                                    <div className="dash-summary-trend">{b2bLoading ? <Skeleton width={50} height={8} /> : 'All Time'}</div>
                                </div>
                                <div className="dash-summary-card delivered">
                                    <div className="dash-summary-title">{b2bLoading ? <Skeleton width={60} height={10} /> : 'Delivered'}</div>
                                    <div className="dash-summary-count">{b2bLoading ? <Skeleton width={40} height={16} /> : b2bMailStats.delivered}</div>
                                    <div className="dash-summary-trend">{b2bLoading ? <Skeleton width={60} height={8} /> : 'Success Rate'}</div>
                                </div>
                                <div className="dash-summary-card failed">
                                    <div className="dash-summary-title">{b2bLoading ? <Skeleton width={50} height={10} /> : 'Failed'}</div>
                                    <div className="dash-summary-count">{b2bLoading ? <Skeleton width={40} height={16} /> : b2bMailStats.failed}</div>
                                    <div className="dash-summary-trend">{b2bLoading ? <Skeleton width={70} height={8} /> : 'Needs Attention'}</div>
                                </div>
                                <div className="dash-summary-card pending">
                                    <div className="dash-summary-title">{b2bLoading ? <Skeleton width={50} height={10} /> : 'Pending'}</div>
                                    <div className="dash-summary-count">{b2bLoading ? <Skeleton width={40} height={16} /> : b2bMailStats.pending}</div>
                                    <div className="dash-summary-trend">{b2bLoading ? <Skeleton width={50} height={8} /> : 'In Queue'}</div>
                                </div>
                            </div>

                            {/* B2B Mail Delivery Status Chart - Structural Mirroring */}
                            <div className="charts-grid-main">
                                <div className="chart-card">
                                    <div className="chart-header-group">
                                        {b2bLoading ? <Skeleton width={24} height={24} circle /> : <FaChartPie className="chart-icon" />}
                                        <h4>{b2bLoading ? <Skeleton width={150} height={20} /> : 'Delivery Status'}</h4>
                                    </div>
                                    <div className="chart-wrapper">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={b2bMailStats.deliveryData} layout="vertical">
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} stroke="var(--text-secondary)" fontSize={11} width={80} />
                                                <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                                                <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* B2B Contact Verification Health Analytics - Structural Mirroring */}
                                <div className="chart-card">
                                    <div className="chart-header-group">
                                        {b2bLoading ? <Skeleton width={24} height={24} circle /> : <FaCheckCircle className="chart-icon" />}
                                        <h4>{b2bLoading ? <Skeleton width={180} height={20} /> : 'Contact Verification Health'}</h4>
                                    </div>
                                    <div className="chart-wrapper">
                                        {b2bLoading ? (
                                            <Skeleton width="100%" height={180} borderRadius={8} />
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
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
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Mail Activity List - Structural Mirroring */}
                            <div className="b2b-activity-list">
                                {(b2bLoading ? Array.from({ length: 5 }) : b2bMailStats.recentActivity).map((activity, i) => (
                                    <div key={b2bLoading ? i : activity.id} className="b2b-activity-item">
                                        <div className="b2b-activity-content">
                                            <span className="b2b-activity-label">
                                                {b2bLoading ? <Skeleton width={150} height={14} /> : activity.subject}
                                            </span>
                                            <span className="b2b-activity-time">
                                                {b2bLoading ? <Skeleton width={120} height={12} /> : `To: ${activity.recipient} • ${activity.time}`}
                                            </span>
                                        </div>
                                        <span className={`feeder-status-tag ${b2bLoading ? '' : activity.status.toLowerCase()}`}>
                                            {b2bLoading ? <Skeleton width={60} height={20} /> : activity.status}
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
                            {/* Personnel Summary Stats - Unified Cards */}
                            <div className="dash-summary-grid count-4">
                                <div className="dash-summary-card personnel">
                                    <div className="dash-summary-title">{personnelLoading ? <Skeleton width={70} height={10} /> : 'Total Linemen'}</div>
                                    <div className="dash-summary-count">{personnelLoading ? <Skeleton width={40} height={16} /> : personnelStats.totalLinemen}</div>
                                    <div className="dash-summary-trend">{personnelLoading ? <Skeleton width={60} height={8} /> : 'Personnel Pool'}</div>
                                </div>
                                <div className="dash-summary-card restored">
                                    <div className="dash-summary-title">{personnelLoading ? <Skeleton width={80} height={10} /> : 'Available Crews'}</div>
                                    <div className="dash-summary-count">{personnelLoading ? <Skeleton width={40} height={16} /> : personnelStats.availableCrews}</div>
                                    <div className="dash-summary-trend">{personnelLoading ? <Skeleton width={80} height={8} /> : 'Ready for dispatch'}</div>
                                </div>
                                <div className="dash-summary-card ongoing">
                                    <div className="dash-summary-title">{personnelLoading ? <Skeleton width={80} height={10} /> : 'Deployed Crews'}</div>
                                    <div className="dash-summary-count">{personnelLoading ? <Skeleton width={40} height={16} /> : personnelStats.deployedCrews}</div>
                                    <div className="dash-summary-trend">{personnelLoading ? <Skeleton width={60} height={8} /> : 'Crews on field'}</div>
                                </div>
                                <div className="dash-summary-card cancelled">
                                    <div className="dash-summary-title">{personnelLoading ? <Skeleton width={50} height={10} /> : 'On Leave'}</div>
                                    <div className="dash-summary-count">{personnelLoading ? <Skeleton width={40} height={16} /> : personnelStats.onLeave}</div>
                                    <div className="dash-summary-trend">{personnelLoading ? <Skeleton width={70} height={8} /> : 'Away from duty'}</div>
                                </div>
                            </div>

                            {/* Charts Row - Crew Status Distribution - Structural Mirroring */}
                            <div className="charts-grid-main">
                                <div className="chart-card">
                                    <div className="chart-header-group">
                                        {personnelLoading ? <Skeleton width={24} height={24} circle /> : <FaChartPie className="chart-icon" />}
                                        <h4>{personnelLoading ? <Skeleton width={200} height={20} /> : 'Crew Status Distribution'}</h4>
                                    </div>
                                    <div className="chart-wrapper">
                                        {personnelLoading ? (
                                            <Skeleton width="100%" height={180} />
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
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
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Crews List - Structural Mirroring */}
                            <div className="personnel-activity-list">
                                {personnelLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="personnel-activity-item">
                                            <div className="personnel-activity-content">
                                                <span className="personnel-activity-label"><Skeleton width={120} height={14} /></span>
                                                <span className="personnel-activity-time"><Skeleton width={150} height={12} /></span>
                                            </div>
                                            <span className="feeder-status-tag"><Skeleton width={60} height={20} /></span>
                                        </div>
                                    ))
                                ) : personnelStats.recentDeployments.length === 0 ? (
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
                            <div className="dash-summary-grid count-3">
                                <div className="dash-summary-card memo">
                                    <div className="dash-summary-title">{memosLoading ? <Skeleton width={60} height={10} /> : 'Total Memos'}</div>
                                    <div className="dash-summary-count">{memosLoading ? <Skeleton width={40} height={16} /> : memoStats.total}</div>
                                    <div className="dash-summary-trend">{memosLoading ? <Skeleton width={50} height={8} /> : 'All records'}</div>
                                </div>
                                <div className="dash-summary-card pending">
                                    <div className="dash-summary-title">{memosLoading ? <Skeleton width={70} height={10} /> : 'Saved / Open'}</div>
                                    <div className="dash-summary-count">{memosLoading ? <Skeleton width={40} height={16} /> : memoStats.saved}</div>
                                    <div className="dash-summary-trend">{memosLoading ? <Skeleton width={60} height={8} /> : 'In progress'}</div>
                                </div>
                                <div className="dash-summary-card restored">
                                    <div className="dash-summary-title">{memosLoading ? <Skeleton width={40} height={10} /> : 'Closed'}</div>
                                    <div className="dash-summary-count">{memosLoading ? <Skeleton width={40} height={16} /> : memoStats.closed}</div>
                                    <div className="dash-summary-trend">{memosLoading ? <Skeleton width={60} height={8} /> : 'Completed'}</div>
                                </div>
                            </div>
                            <div className="charts-grid-main">
                                <div className="chart-card">
                                    <div className="chart-header-group">
                                        <FaChartPie className="chart-icon" />
                                        <h4>Memo Status Split</h4>
                                    </div>
                                    <div className="chart-wrapper">
                                        {memosLoading
                                            ? <Skeleton height="100%" borderRadius={8} />
                                            : <ResponsiveContainer width="100%" height="100%">
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
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Users Mini-Section */}
                        <div className="dashboard-mini-wrapper">
                            <div className="section-label-group">
                                <h3 className="column-section-title">System Users</h3>
                                <p className="widget-text">Registered accounts and role distribution.</p>
                            </div>
                            <div className="dash-summary-grid count-3">
                                <div className="dash-summary-card user">
                                    <div className="dash-summary-title">{usersLoading ? <Skeleton width={60} height={10} /> : 'Total Users'}</div>
                                    <div className="dash-summary-count">{usersLoading ? <Skeleton width={40} height={16} /> : userStats.total}</div>
                                    <div className="dash-summary-trend">{usersLoading ? <Skeleton width={60} height={8} /> : 'All accounts'}</div>
                                </div>
                                <div className="dash-summary-card personnel">
                                    <div className="dash-summary-title">{usersLoading ? <Skeleton width={50} height={10} /> : 'Admins'}</div>
                                    <div className="dash-summary-count">{usersLoading ? <Skeleton width={40} height={16} /> : userStats.admins}</div>
                                    <div className="dash-summary-trend">{usersLoading ? <Skeleton width={60} height={8} /> : 'Full access'}</div>
                                </div>
                                <div className="dash-summary-card crew">
                                    <div className="dash-summary-title">{usersLoading ? <Skeleton width={60} height={10} /> : 'Employees'}</div>
                                    <div className="dash-summary-count">{usersLoading ? <Skeleton width={40} height={16} /> : userStats.employees}</div>
                                    <div className="dash-summary-trend">{usersLoading ? <Skeleton width={60} height={8} /> : 'Staff access'}</div>
                                </div>
                            </div>
                            <div className="charts-grid-main">
                                <div className="chart-card">
                                    <div className="chart-header-group">
                                        <FaChartPie className="chart-icon" />
                                        <h4>Role Distribution</h4>
                                    </div>
                                    <div className="chart-wrapper">
                                        {usersLoading
                                            ? <Skeleton height="100%" borderRadius={8} />
                                            : <ResponsiveContainer width="100%" height="100%">
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
                                        }
                                    </div>
                                </div>
                            </div>
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