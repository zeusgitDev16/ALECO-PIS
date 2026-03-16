# 🏢 ALECO Power Interruption System (PIS) - Complete Technical Documentation

**Version:** 1.0.0  
**Last Updated:** March 16, 2026  
**Author:** Amando Zeus C. Millete (zeusgitDev16)  
**Organization:** Albay Electric Cooperative (ALECO)

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architectural Philosophy](#architectural-philosophy)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [Backend Architecture](#backend-architecture)
6. [Frontend Architecture](#frontend-architecture)
7. [Feature Implementation Status](#feature-implementation-status)
8. [API Documentation](#api-documentation)
9. [Development Guidelines](#development-guidelines)
10. [Deployment Guide](#deployment-guide)
11. [Future Roadmap](#future-roadmap)

---

## 🎯 System Overview

### Purpose
The ALECO Power Interruption System (PIS) is a comprehensive web-based platform designed to streamline the reporting, tracking, and resolution of power outages and electrical issues across the Albay Electric Cooperative service area.

### Core Objectives
- **Real-time Ticket Management**: Enable customers to report power issues instantly
- **Efficient Crew Dispatch**: Optimize lineman crew assignments and routing
- **Transparent Communication**: Keep customers informed about ticket status and ETAs
- **Data-Driven Insights**: Provide analytics for operational improvements
- **Geographic Intelligence**: Leverage GPS data for accurate incident mapping

### Key Stakeholders
- **Customers**: Report issues, track tickets, receive updates
- **Employees**: Manage tickets, dispatch crews, update statuses
- **Administrators**: Oversee system operations, manage users, analyze data
- **Linemen/Crews**: Receive assignments, update field status, submit reports

---

## 🏗️ Architectural Philosophy

### The "Lego Brick" Methodology

The ALECO PIS is built using a **modular "Lego Brick" architecture**, where every component is:

1. **Atomic**: Each module serves a single, well-defined purpose
2. **Idempotent**: Operations can be safely repeated without side effects
3. **Replaceable**: Components can be swapped without breaking the system
4. **Testable**: Small units are easier to test and debug
5. **Backwards Compatible**: Changes never break existing functionality

#### Lego Brick Principles in Practice

**Backend Routes (Bricks)**:
```
server.js (The Foundation)
    ├── auth.js (Authentication Brick)
    ├── tickets.js (Ticket Submission Brick)
    ├── ticket-routes.js (Ticket Filtering Brick)
    ├── ticket-grouping.js (Ticket Grouping Brick)
    └── user.js (User Management Brick)
```

**Frontend Components (Bricks)**:
```
App.jsx (The Foundation)
    ├── Navbar (Navigation Brick)
    ├── Sidebar (Menu Brick)
    ├── Tickets (Ticket Management Brick)
    │   ├── TicketFilterBar (Filter Brick)
    │   ├── TicketListPane (Grid View Brick)
    │   ├── TicketTableView (Table View Brick)
    │   ├── TicketKanbanView (Kanban View Brick)
    │   └── TicketDetailPane (Detail Modal Brick)
    └── PersonnelManagement (Crew Management Brick)
```

### Design Patterns

1. **Separation of Concerns**: UI, business logic, and data access are strictly separated
2. **Single Responsibility**: Each file/function does one thing well
3. **DRY (Don't Repeat Yourself)**: Shared logic is extracted into utilities
4. **Prop Drilling with Intent**: State is lifted to the appropriate level
5. **CSS Isolation**: Each component has its own CSS file

---

## 💻 Technology Stack

### Frontend Dependencies

```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.13.0",
  "axios": "^1.13.6",
  "leaflet": "^1.9.4",
  "react-leaflet": "^5.0.0",
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "react-icons": "^5.5.0",
  "recharts": "^3.7.0",
  "date-fns": "^4.1.0",
  "dayjs": "^1.11.19",
  "react-toastify": "^11.0.5",
  "react-window": "^2.2.7",
  "tailwindcss": "^4.1.18",
  "@react-oauth/google": "^0.13.4",
  "jwt-decode": "^4.0.0",
  "prop-types": "^15.8.1"
}
```

### Backend Dependencies

```json
{
  "express": "^5.2.1",
  "mysql2": "^3.17.2",
  "cors": "^2.8.6",
  "dotenv": "^17.3.1",
  "bcrypt": "^6.0.0",
  "nodemailer": "^8.0.1",
  "twilio": "^5.12.2",
  "cloudinary": "^1.41.3",
  "multer": "^2.0.2",
  "multer-storage-cloudinary": "^4.0.0"
}
```

### Development Tools

```json
{
  "vite": "^7.3.1",
  "@vitejs/plugin-react": "^5.1.1",
  "nodemon": "^3.1.14",
  "eslint": "^9.39.1"
}
```

### Infrastructure

- **Database**: Aiven MySQL (Cloud-hosted)
- **File Storage**: Cloudinary (Image uploads)
- **SMS Service**: Twilio
- **Email Service**: Nodemailer (SMTP)
- **Build Tool**: Vite
- **Module System**: ES Modules (ESM)

---

## 🗄️ Database Schema

### Complete Database Structure

The ALECO PIS uses **8 core tables** to manage the entire system:

#### 1. `users` - User Authentication & Authorization

| Column | Type | Nullable | Default | Key | Description |
|--------|------|----------|---------|-----|-------------|
| `id` | int | NO | NULL | PRI (auto_increment) | Internal user ID |
| `name` | varchar(255) | YES | NULL | | Full name |
| `email` | varchar(255) | NO | NULL | UNI | Unique email address |
| `password` | varchar(255) | YES | NULL | | Hashed password (bcrypt) |
| `role` | varchar(50) | YES | 'customer' | | User role: `admin`, `employee`, `customer` |
| `status` | enum(8) | YES | 'Active' | | Account status: `Active`, `Disabled` |
| `auth_method` | varchar(20) | YES | 'password' | | Authentication method: `password`, `google` |
| `profile_pic` | text | YES | NULL | | Cloudinary URL for profile picture |
| `created_at` | timestamp | YES | CURRENT_TIMESTAMP | | Account creation timestamp |
| `token_version` | int | YES | 1 | | JWT token version (for invalidation) |

**Purpose**: Manages all system users including customers, employees, and administrators.

---

#### 2. `access_codes` - User Invitation System

| Column | Type | Nullable | Default | Key | Description |
|--------|------|----------|---------|-----|-------------|
| `id` | int | NO | NULL | PRI (auto_increment) | Code ID |
| `email` | varchar(255) | NO | NULL | | Invited user email |
| `role_assigned` | varchar(50) | NO | NULL | | Role to assign: `admin`, `employee` |
| `code` | varchar(12) | NO | NULL | UNI | Unique 12-digit invitation code |
| `status` | enum(7) | YES | 'pending' | | Code status: `pending`, `used` |
| `created_at` | timestamp | YES | CURRENT_TIMESTAMP | | Code generation timestamp |

**Purpose**: Manages invitation codes for new employee/admin accounts.

**Flow**:
1. Admin generates code via `/api/invite`
2. Code is emailed to the invitee
3. Invitee registers using the code
4. Status changes to `used`

---

#### 3. `aleco_tickets` - Core Ticket Management

| Column | Type | Nullable | Default | Key | Description |
|--------|------|----------|---------|-----|-------------|
| `id` | int | NO | NULL | PRI (auto_increment) | Internal ticket ID |
| `ticket_id` | varchar(20) | NO | NULL | UNI | Public ticket ID (e.g., `TKT-20260316-0001`) |
| `parent_ticket_id` | varchar(20) | YES | NULL | | Master ticket ID for grouped tickets |
| `account_number` | varchar(50) | YES | NULL | | Customer account number |
| `first_name` | varchar(50) | NO | NULL | | Customer first name |
| `middle_name` | varchar(50) | YES | NULL | | Customer middle name |
| `last_name` | varchar(50) | NO | NULL | | Customer last name |
| `phone_number` | varchar(20) | NO | NULL | | Customer contact number |
| `address` | varchar(255) | NO | NULL | | Full address |
| `category` | varchar(150) | NO | NULL | | Issue category (e.g., "Primary Line No Power") |
| `concern` | text | NO | NULL | | Detailed description of the issue |
| `is_urgent` | tinyint | YES | 0 | | Urgency flag: `0` = normal, `1` = urgent |
| `image_url` | varchar(500) | YES | NULL | | Cloudinary URL for uploaded evidence |
| `status` | enum(10) | YES | 'Pending' | | Ticket status: `Pending`, `Ongoing`, `Restored`, `Unresolved` |
| `created_at` | timestamp | YES | CURRENT_TIMESTAMP | | Ticket creation timestamp |
| `updated_at` | timestamp | YES | CURRENT_TIMESTAMP | | Last update timestamp (auto-updated) |
| `district` | varchar(255) | YES | NULL | | District name |
| `municipality` | varchar(255) | YES | NULL | | Municipality name |
| `incident_id` | int | YES | NULL | MUL | Foreign key to `aleco_incidents` |
| `assigned_crew` | varchar(100) | YES | NULL | | Assigned crew name |
| `eta` | varchar(50) | YES | NULL | | Estimated time of arrival |
| `dispatch_notes` | text | YES | NULL | | Dispatcher notes |
| `is_consumer_notified` | tinyint | YES | 0 | | SMS notification flag |
| `lineman_remarks` | text | YES | NULL | | Field technician remarks |
| `reported_lat` | decimal(10,8) | YES | NULL | MUL | GPS latitude |
| `reported_lng` | decimal(11,8) | YES | NULL | | GPS longitude |
| `location_accuracy` | int | YES | NULL | | GPS accuracy in meters |
| `location_method` | varchar(20) | YES | 'manual' | | Location method: `gps`, `manual` |
| `location_confidence` | enum(6) | YES | 'medium' | | Confidence: `high`, `medium`, `low` |
| `remarks` | text | YES | NULL | | Additional remarks |

**Purpose**: The heart of the system - stores all power outage tickets.

**Ticket ID Format**: `TKT-YYYYMMDD-XXXX` (e.g., `TKT-20260316-0001`)
**Master Ticket ID Format**: `GROUP-YYYYMMDD-XXXX` (e.g., `GROUP-20260316-0001`)

**Status Flow**:
```
Pending → Ongoing → Restored
   ↓         ↓
Unresolved ← ←
```

---

#### 4. `aleco_personnel` - Crew Management

| Column | Type | Nullable | Default | Key | Description |
|--------|------|----------|---------|-----|-------------|
| `id` | int | NO | NULL | PRI (auto_increment) | Crew ID |
| `crew_name` | varchar(100) | NO | NULL | UNI | Unique crew name (e.g., "Team Alpha") |
| `lead_lineman` | varchar(255) | YES | NULL | | Lead lineman name |
| `phone_number` | varchar(20) | NO | NULL | | Crew contact number |
| `status` | enum(9) | YES | 'Available' | | Crew status: `Available`, `Deployed`, `Offline` |
| `created_at` | timestamp | YES | CURRENT_TIMESTAMP | | Crew creation timestamp |
| `updated_at` | timestamp | YES | CURRENT_TIMESTAMP | | Last update timestamp |

**Purpose**: Manages lineman crews for ticket dispatch.

---

#### 5. `aleco_linemen_pool` - Individual Linemen

| Column | Type | Nullable | Default | Key | Description |
|--------|------|----------|---------|-----|-------------|
| `id` | int | NO | NULL | PRI (auto_increment) | Lineman ID |
| `full_name` | varchar(255) | NO | NULL | | Lineman full name |
| `designation` | varchar(100) | YES | 'Lineman' | | Job title |
| `contact_no` | varchar(20) | NO | NULL | | Contact number |
| `status` | enum(8) | YES | 'Active' | | Employment status: `Active`, `Inactive` |
| `created_at` | timestamp | YES | CURRENT_TIMESTAMP | | Record creation timestamp |
| `updated_at` | timestamp | YES | CURRENT_TIMESTAMP | | Last update timestamp |

**Purpose**: Stores individual lineman records for crew assignment.

---

#### 6. `aleco_crew_members` - Crew-Lineman Relationship

| Column | Type | Nullable | Default | Key | Description |
|--------|------|----------|---------|-----|-------------|
| `crew_id` | int | NO | NULL | PRI | Foreign key to `aleco_personnel.id` |
| `lineman_id` | int | NO | NULL | PRI | Foreign key to `aleco_linemen_pool.id` |

**Purpose**: Many-to-many relationship between crews and linemen.

**Example**:
```
Team Alpha (crew_id: 1)
    ├── Juan Dela Cruz (lineman_id: 1)
    ├── Pedro Santos (lineman_id: 2)
    └── Maria Garcia (lineman_id: 3)
```

---

#### 7. `aleco_incidents` - Master Incident Records

| Column | Type | Nullable | Default | Key | Description |
|--------|------|----------|---------|-----|-------------|
| `incident_id` | int | NO | NULL | PRI (auto_increment) | Incident ID |
| `category` | varchar(100) | NO | NULL | | Incident category |
| `title` | varchar(255) | NO | NULL | | Incident title |
| `remarks` | text | YES | NULL | | Incident remarks |
| `status` | varchar(50) | YES | 'PENDING' | | Incident status |
| `created_at` | timestamp | YES | CURRENT_TIMESTAMP | | Creation timestamp |
| `updated_at` | timestamp | YES | CURRENT_TIMESTAMP | | Last update timestamp |

**Purpose**: Stores master incident records for grouped tickets.

**Note**: This table is currently **partially implemented**. The ticket grouping system uses `parent_ticket_id` in `aleco_tickets` instead of this table.

---

#### 8. `password_resets` - Password Recovery

| Column | Type | Nullable | Default | Key | Description |
|--------|------|----------|---------|-----|-------------|
| `id` | int | NO | NULL | PRI (auto_increment) | Reset ID |
| `email` | varchar(255) | NO | NULL | MUL | User email |
| `token` | varchar(12) | YES | NULL | | Reset token |
| `expires_at` | datetime | NO | NULL | | Token expiration timestamp |

**Purpose**: Manages password reset tokens.

**Flow**:
1. User requests password reset
2. Token is generated and emailed
3. User clicks link with token
4. Token is validated (not expired)
5. User sets new password
6. Token is deleted

---

### Database Relationships

```
users (1) ←→ (N) aleco_tickets (via email/account)
aleco_tickets (N) ←→ (1) aleco_incidents (via incident_id)
aleco_tickets (N) ←→ (1) aleco_tickets (via parent_ticket_id) [Self-referencing]
aleco_personnel (1) ←→ (N) aleco_tickets (via assigned_crew)
aleco_personnel (N) ←→ (N) aleco_linemen_pool (via aleco_crew_members)
```

---

## 🔧 Backend Architecture

### Server Structure

The backend follows a **modular route-based architecture** using Express.js and ES Modules.

#### File Structure

```
ALECO_PIS/
├── server.js                          # Main server entry point
├── backend/
│   ├── config/
│   │   └── db.js                      # MySQL connection pool
│   ├── routes/
│   │   ├── auth.js                    # Authentication routes
│   │   ├── tickets.js                 # Ticket submission & tracking
│   │   ├── ticket-routes.js           # Ticket filtering & management
│   │   ├── ticket-grouping.js         # Ticket grouping system
│   │   └── user.js                    # User management
│   └── migrations/
│       ├── fix_status_enum.sql        # Status enum migration
│       └── create_ticket_grouping_tables.sql  # (Deprecated)
├── cloudinaryConfig.js                # Cloudinary setup
├── geocoder.js                        # GPS geocoding utilities
└── alecoScope.js                      # Municipality/district data
```

---

### Database Connection (`backend/config/db.js`)

**Purpose**: Centralized MySQL connection pool using Aiven MySQL.

```javascript
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  },
  timezone: '+08:00',           // Manila timezone
  dateStrings: true,            // Return dates as strings
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
```

**Key Features**:
- ✅ SSL connection to Aiven MySQL
- ✅ Manila timezone (UTC+8)
- ✅ Connection pooling (max 10 connections)
- ✅ Promise-based API

---

### Main Server (`server.js`)

**Purpose**: Express server initialization and route mounting.

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import Lego Bricks
import authRoutes from './backend/routes/auth.js';
import ticketRoutes from './backend/routes/tickets.js';
import userRoutes from './backend/routes/user.js';
import ticketFilterRoutes from './backend/routes/ticket-routes.js';
import ticketGroupingRoutes from './backend/routes/ticket-grouping.js';

dotenv.config();
process.env.TZ = 'Asia/Manila';

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Mount Routes
app.use('/api', authRoutes);
app.use('/api', ticketRoutes);
app.use('/api', userRoutes);
app.use('/api', ticketFilterRoutes);
app.use('/api', ticketGroupingRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Lego Brick Principle**: Each route file is a self-contained module that can be added/removed without affecting others.

---

### Route Modules (Lego Bricks)

#### 1. Authentication Routes (`backend/routes/auth.js`)

**Endpoints**:
- `POST /api/login` - User login (email/password or Google OAuth)
- `POST /api/register` - New user registration
- `POST /api/logout` - User logout

**Key Features**:
- ✅ Bcrypt password hashing
- ✅ JWT token generation
- ✅ Google OAuth integration
- ✅ Role-based access control

**Example**:
```javascript
// Login endpoint
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Check if user exists
  const [users] = await pool.execute(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );

  if (users.length === 0) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Verify password
  const isValid = await bcrypt.compare(password, users[0].password);

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Return user data
  res.json({
    success: true,
    user: {
      id: users[0].id,
      name: users[0].name,
      email: users[0].email,
      role: users[0].role
    }
  });
});
```

---

#### 2. Ticket Submission Routes (`backend/routes/tickets.js`)

**Endpoints**:
- `POST /api/tickets/submit` - Submit new ticket
- `GET /api/tickets/track/:ticketId` - Track ticket status
- `PUT /api/tickets/:ticketId/dispatch` - Dispatch crew to ticket
- `PUT /api/tickets/:ticketId/status` - Update ticket status

**Key Features**:
- ✅ Automatic ticket ID generation (`TKT-YYYYMMDD-XXXX`)
- ✅ Cloudinary image upload
- ✅ GPS coordinate validation
- ✅ SMS notifications via Twilio
- ✅ Email notifications via Nodemailer

**Ticket ID Generation Logic**:
```javascript
const generateTicketId = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const [rows] = await pool.execute(
    `SELECT ticket_id FROM aleco_tickets
     WHERE ticket_id LIKE ?
     ORDER BY ticket_id DESC LIMIT 1`,
    [`TKT-${dateStr}-%`]
  );

  let sequence = 1;
  if (rows.length > 0) {
    const lastId = rows[0].ticket_id;
    const lastSeq = parseInt(lastId.split('-')[2]);
    sequence = lastSeq + 1;
  }

  return `TKT-${dateStr}-${String(sequence).padStart(4, '0')}`;
};
```

---

#### 3. Ticket Filtering Routes (`backend/routes/ticket-routes.js`)

**Endpoints**:
- `GET /api/filtered-tickets` - Get filtered tickets
- `GET /api/crews/list` - Get all crews
- `GET /api/pool/list` - Get all linemen

**Query Parameters**:
- `status` - Filter by status (`Pending`, `Ongoing`, `Restored`, `Unresolved`)
- `category` - Filter by category
- `district` - Filter by district
- `municipality` - Filter by municipality
- `search` - Search by ticket ID, name, or address
- `isUrgent` - Filter urgent tickets
- `isNew` - Filter new tickets (created in last 24 hours)

**Example**:
```
GET /api/filtered-tickets?status=Pending&district=Legazpi&isUrgent=true
```

---

#### 4. Ticket Grouping Routes (`backend/routes/ticket-grouping.js`)

**Endpoints**:
- `POST /api/tickets/group/create` - Create ticket group
- `GET /api/tickets/group/:masterTicketId` - Get group details
- `PUT /api/tickets/group/:masterTicketId/restore` - Restore entire group

**Purpose**: Group multiple related tickets under a master ticket.

**Master Ticket ID Format**: `GROUP-YYYYMMDD-XXXX`

**Example Request**:
```json
POST /api/tickets/group/create
{
  "title": "Transformer Failure - Brgy Rawis",
  "category": "PRIMARY LINE NO POWER",
  "remarks": "Multiple reports in same area",
  "ticketIds": ["TKT-20260316-0001", "TKT-20260316-0002", "TKT-20260316-0003"]
}
```

**Database Changes**:
1. Creates master ticket with `GROUP-YYYYMMDD-XXXX` ID
2. Updates child tickets' `parent_ticket_id` to master ticket ID
3. Returns master ticket ID

---

#### 5. User Management Routes (`backend/routes/user.js`)

**Endpoints**:
- `POST /api/invite` - Generate invitation code
- `POST /api/send-email` - Send invitation email
- `POST /api/check-email` - Check if email exists
- `GET /api/users` - Get all registered users
- `POST /api/users/toggle-status` - Enable/disable user account

**Invitation Flow**:
```
1. Admin enters email and role
2. System generates 12-digit code
3. Code is saved to `access_codes` table
4. Email is sent with code
5. User registers using code
6. Code status changes to 'used'
```

**Code Generation**:
```javascript
const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
```

---

### Idempotency in Backend

All backend operations are designed to be **idempotent**:

1. **Ticket Submission**: Duplicate submissions are prevented by checking recent tickets
2. **Status Updates**: Updating to the same status is a no-op
3. **Crew Dispatch**: Re-dispatching the same crew updates the timestamp
4. **User Invitation**: Re-generating code for same email updates the existing record

---

### Error Handling Pattern

All routes follow a consistent error handling pattern:

```javascript
router.post('/endpoint', async (req, res) => {
  try {
    // Business logic here
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
```

---

## ⚛️ Frontend Architecture

### Application Structure

The frontend is built with **React 19** and follows a **component-based architecture** with strict CSS isolation.

#### File Structure

```
ALECO_PIS/src/
├── main.jsx                        # Application entry point
├── App.jsx                         # Root component with routing
├── index.css                       # Global styles
├── components/
│   ├── AdminLayout.jsx             # Admin dashboard layout
│   ├── Sidebar.jsx                 # Navigation sidebar
│   ├── Tickets.jsx                 # Main ticket management page
│   ├── Users.jsx                   # User management page
│   ├── PersonnelManagement.jsx     # Crew management page
│   ├── History.jsx                 # History logs (NOT IMPLEMENTED)
│   ├── Interruptions.jsx           # Scheduled interruptions (NOT IMPLEMENTED)
│   ├── tickets/
│   │   ├── TicketFilterBar.jsx    # Filter controls
│   │   ├── TicketLayoutPicker.jsx # View mode switcher
│   │   ├── TicketListPane.jsx     # Grid view
│   │   ├── TicketTableView.jsx    # Table view
│   │   ├── TicketKanbanView.jsx   # Kanban view
│   │   ├── TicketDetailPane.jsx   # Ticket detail modal
│   │   ├── GroupIncidentModal.jsx # Bulk action bar
│   │   ├── DispatchTicketModal.jsx # Crew dispatch modal
│   │   └── kanban/
│   │       ├── KanbanColumn.jsx   # Kanban column
│   │       └── KanbanTicketCard.jsx # Kanban card
│   ├── containers/
│   │   ├── AllUsers.jsx           # User list
│   │   ├── InviteNewUsers.jsx     # User invitation form
│   │   └── UrgentTickets.jsx      # Urgent ticket widget
│   └── personnels/
│       ├── AddCrew.jsx            # Crew creation form
│       └── AddLinemen.jsx         # Lineman creation form
├── CSS/                            # Component-specific CSS files
├── utils/
│   ├── useTickets.js              # Ticket data hook
│   ├── useDraggable.js            # Drag-and-drop hook
│   ├── dateUtils.js               # Date formatting utilities
│   ├── kanbanHelpers.js           # Kanban logic
│   └── gpsLocationMatcher.js      # GPS utilities
└── api/
    └── axiosConfig.js             # Axios instance configuration
```

---

### Routing Structure (`App.jsx`)

**Public Routes**:
- `/` - Landing page
- `/report` - Report a problem (customer-facing)
- `/privacy` - Privacy notice
- `/about` - About ALECO

**Protected Routes** (require authentication):
- `/dashboard` - Admin dashboard
- `/tickets` - Ticket management
- `/users` - User management
- `/personnel` - Crew management
- `/history` - History logs (NOT IMPLEMENTED)
- `/interruptions` - Scheduled interruptions (NOT IMPLEMENTED)
- `/profile` - User profile

**Authentication Flow**:
```javascript
const ProtectedRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user'));

  if (!user) {
    return <Navigate to="/" />;
  }

  return children;
};
```

---

### State Management

The application uses **React Context** and **Custom Hooks** for state management (no Redux).

#### 1. `useTickets` Hook (`utils/useTickets.js`)

**Purpose**: Centralized ticket data management with filtering.

**Features**:
- ✅ Fetches tickets from `/api/filtered-tickets`
- ✅ Real-time filtering (status, category, district, search)
- ✅ Loading and error states
- ✅ Automatic refetching on filter changes

**Usage**:
```javascript
const { tickets, loading, error, filters, setFilters } = useTickets();

// Update filters
setFilters({ status: 'Pending', district: 'Legazpi' });
```

**State Structure**:
```javascript
{
  tickets: [],           // Array of ticket objects
  loading: false,        // Loading state
  error: null,           // Error message
  filters: {
    status: '',
    category: '',
    district: '',
    municipality: '',
    search: '',
    isUrgent: false,
    isNew: false
  }
}
```

---

#### 2. `useDraggable` Hook (`utils/useDraggable.js`)

**Purpose**: Makes any element draggable (used for modals and bulk action bar).

**Usage**:
```javascript
const { position, handleMouseDown } = useDraggable();

<div
  style={{ left: position.x, top: position.y }}
  onMouseDown={handleMouseDown}
>
  Draggable content
</div>
```

---

### Core Components

#### 1. Tickets Page (`components/Tickets.jsx`)

**Purpose**: Main ticket management interface with 3 view modes.

**State Management**:
```javascript
const [viewMode, setViewMode] = useState('grid');  // 'grid', 'table', 'kanban'
const [selectedTicket, setSelectedTicket] = useState(null);
const [selectedIds, setSelectedIds] = useState([]);  // For bulk actions
const [showGroupModal, setShowGroupModal] = useState(false);
```

**View Modes**:

1. **Grid View** (`TicketListPane.jsx`):
   - Card-based layout
   - Checkboxes for bulk selection
   - Color-coded status badges
   - Urgent ticket highlighting

2. **Table View** (`TicketTableView.jsx`):
   - Tabular layout with sortable columns
   - Checkboxes for bulk selection
   - Inline status updates
   - Pagination support

3. **Kanban View** (`TicketKanbanView.jsx`):
   - Drag-and-drop columns (Pending, Ongoing, Restored, Unresolved)
   - Uses `@dnd-kit/core` and `@dnd-kit/sortable`
   - Checkboxes for bulk selection
   - Real-time status updates on drag

**Bulk Actions**:
- Select multiple tickets via checkboxes
- Floating draggable action bar appears
- Options: Group tickets, Restore all, Cancel selection

---

#### 2. Kanban View Implementation

**Technology**: `@dnd-kit/core` + `@dnd-kit/sortable`

**Structure**:
```
TicketKanbanView.jsx (Container)
  ├── DndContext (Drag-and-drop provider)
  ├── KanbanColumn.jsx (Droppable column)
  │   └── SortableContext (Sortable items)
  │       └── KanbanTicketCard.jsx (Draggable card)
  │           ├── Checkbox (with stopPropagation)
  │           └── Drag Handle (category badge)
```

**Key Implementation Details**:

1. **Drag Handle Isolation**:
   ```javascript
   // Only the category badge triggers drag
   <div className="kanban-ticket-category" {...listeners} {...attributes}>
     {ticket.category}
   </div>
   ```

2. **Checkbox Event Handling**:
   ```javascript
   // Prevent drag when clicking checkbox
   <input
     type="checkbox"
     onClick={(e) => e.stopPropagation()}
     onChange={() => onToggleSelect(ticket.ticket_id)}
   />
   ```

3. **Status Update on Drop**:
   ```javascript
   const handleDragEnd = async (event) => {
     const { active, over } = event;

     if (over && active.id !== over.id) {
       const newStatus = over.id;  // Column ID = status
       await updateTicketStatus(active.id, newStatus);
     }
   };
   ```

**Critical Fix Applied**:
- ✅ Changed `useSortable({ id: ticket.id })` to `useSortable({ id: ticket.ticket_id })`
- ✅ Moved drag listeners from card container to category badge
- ✅ Added `e.stopPropagation()` to checkbox click handler

---

#### 3. Bulk Action Bar (`tickets/GroupIncidentModal.jsx`)

**Purpose**: Floating draggable bar for bulk ticket operations.

**Features**:
- ✅ Appears when tickets are selected
- ✅ Draggable anywhere on screen
- ✅ Glassmorphism design (`backdrop-filter: blur(10px)`)
- ✅ Shows selected ticket count
- ✅ Group tickets into master ticket
- ✅ Bulk restore all selected tickets

**Styling** (`CSS/TicketMain.css`):
```css
.bulk-action-bar-floating {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  cursor: move;
}
```

**Critical Fix Applied**:
- ✅ Added `import '../CSS/TicketMain.css'` to `Tickets.jsx`

---

#### 4. Ticket Detail Pane (`tickets/TicketDetailPane.jsx`)

**Purpose**: Modal showing full ticket details.

**Features**:
- ✅ Full ticket information
- ✅ Status update dropdown
- ✅ Crew dispatch button
- ✅ GPS location map (Leaflet)
- ✅ Image preview (Cloudinary)
- ✅ Lineman remarks
- ✅ Dispatch notes

**Actions**:
- Update status
- Dispatch crew
- Add remarks
- View location on map
- Close ticket

---

#### 5. User Management (`Users.jsx`)

**Components**:
- `InviteNewUsers.jsx` - Generate invitation codes
- `AllUsers.jsx` - List all registered users

**Invitation Flow**:
```
1. Admin enters email and role
2. Click "Generate Code"
3. 12-digit code is generated
4. Code is displayed in modal
5. Admin clicks "Send Email"
6. Email is sent to invitee
7. Invitee registers using code
```

**Critical Fix Applied**:
- ✅ Fixed SQL parameter mismatch in `/api/invite` endpoint
- ✅ Removed duplicate `"pending"` parameter

---

#### 6. Personnel Management (`PersonnelManagement.jsx`)

**Components**:
- `AddCrew.jsx` - Create new crew
- `AddLinemen.jsx` - Add lineman to pool

**Features**:
- ✅ Create crews with unique names
- ✅ Assign lead lineman
- ✅ Add contact information
- ✅ Manage crew status (Available, Deployed, Offline)
- ✅ Add individual linemen to pool
- ✅ Assign linemen to crews

---

### CSS Architecture

**Principle**: **One component, one CSS file**.

**Example**:
```
Tickets.jsx → TicketsPage.css
TicketKanbanView.jsx → TicketKanban.css
GroupIncidentModal.jsx → GroupIncidentModal.css
```

**Global Styles** (`index.css`):
- CSS variables for colors
- Typography
- Reset styles

**Component Styles**:
- Scoped to component
- No global class pollution
- BEM naming convention

**Example**:
```css
/* TicketKanban.css */
.kanban-container { }
.kanban-column { }
.kanban-ticket-card { }
.kanban-ticket-card__header { }
.kanban-ticket-card__body { }
```

---

### API Integration (`api/axiosConfig.js`)

**Purpose**: Centralized Axios instance with base URL.

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;
```

**Usage**:
```javascript
import api from '../api/axiosConfig';

// GET request
const response = await api.get('/filtered-tickets');

// POST request
const response = await api.post('/tickets/submit', ticketData);
```

---

### Utilities

#### 1. Date Utilities (`utils/dateUtils.js`)

**Functions**:
- `formatDate(date)` - Format date to "MMM DD, YYYY"
- `formatDateTime(date)` - Format date to "MMM DD, YYYY HH:mm"
- `getRelativeTime(date)` - Get relative time (e.g., "2 hours ago")

#### 2. GPS Location Matcher (`utils/gpsLocationMatcher.js`)

**Purpose**: Match GPS coordinates to municipality/district.

**Features**:
- ✅ Reverse geocoding
- ✅ Confidence scoring
- ✅ Fallback to manual entry

#### 3. Kanban Helpers (`utils/kanbanHelpers.js`)

**Functions**:
- `groupTicketsByStatus(tickets)` - Group tickets by status
- `getColumnColor(status)` - Get color for status column
- `canMoveTicket(ticket, newStatus)` - Validate status transitions

---

## ✅ Feature Implementation Status

### Fully Implemented Features

#### 1. ✅ User Authentication & Authorization
- [x] Email/password login
- [x] Google OAuth login
- [x] User registration with invitation codes
- [x] Role-based access control (Admin, Employee, Customer)
- [x] Password reset functionality
- [x] Account status management (Active/Disabled)

#### 2. ✅ Ticket Submission System
- [x] Customer-facing ticket submission form
- [x] Automatic ticket ID generation (`TKT-YYYYMMDD-XXXX`)
- [x] Image upload to Cloudinary
- [x] GPS location capture
- [x] Manual location entry
- [x] Issue category selection
- [x] Urgency flag
- [x] Email confirmation to customer

#### 3. ✅ Ticket Management (Partial)
- [x] Grid view with checkboxes
- [x] Table view with checkboxes
- [x] Kanban view with drag-and-drop
- [x] Ticket filtering (status, category, district, search)
- [x] Ticket detail modal
- [x] Status updates
- [x] Bulk selection across all views
- [x] Bulk action bar (draggable)
- [ ] Ticket editing (NOT IMPLEMENTED)
- [ ] Ticket deletion (NOT IMPLEMENTED)
- [ ] Ticket comments/notes (PARTIAL - only dispatch notes)

#### 4. ✅ Ticket Grouping System
- [x] Select multiple tickets
- [x] Create master ticket (`GROUP-YYYYMMDD-XXXX`)
- [x] Link child tickets to master ticket
- [x] Bulk restore grouped tickets
- [x] View grouped tickets
- [ ] Ungroup tickets (NOT IMPLEMENTED)
- [ ] Edit master ticket (NOT IMPLEMENTED)

#### 5. ✅ Crew Dispatch System
- [x] Crew creation
- [x] Lineman pool management
- [x] Assign crew to ticket
- [x] Set ETA
- [x] Add dispatch notes
- [x] SMS notification to customer (Twilio)
- [ ] Real-time crew location tracking (NOT IMPLEMENTED)
- [ ] Crew status updates from field (NOT IMPLEMENTED)

#### 6. ✅ User Management
- [x] Invitation code generation
- [x] Email invitation sending
- [x] User list view
- [x] Enable/disable user accounts
- [ ] User role editing (NOT IMPLEMENTED)
- [ ] User deletion (NOT IMPLEMENTED)

#### 7. ✅ Personnel Management
- [x] Create crews
- [x] Add linemen to pool
- [x] Assign linemen to crews
- [x] Crew status management
- [ ] Crew performance analytics (NOT IMPLEMENTED)
- [ ] Lineman scheduling (NOT IMPLEMENTED)

---

### Partially Implemented Features

#### 1. ⚠️ Ticket Detail View
**Status**: 70% Complete

**Implemented**:
- ✅ View all ticket details
- ✅ Status dropdown
- ✅ Dispatch button
- ✅ GPS map view

**Not Implemented**:
- ❌ Edit ticket information
- ❌ Add comments/notes
- ❌ Attach additional images
- ❌ View ticket history timeline

---

#### 2. ⚠️ Dashboard Analytics
**Status**: 30% Complete

**Implemented**:
- ✅ Urgent tickets widget
- ✅ Basic ticket counts

**Not Implemented**:
- ❌ Ticket trend charts
- ❌ Resolution time analytics
- ❌ Crew performance metrics
- ❌ Geographic heat maps
- ❌ Category breakdown charts

---

### Not Implemented Features

#### 1. ❌ History Logs (`components/History.jsx`)
**Status**: 0% Complete

**Purpose**: Track all system activities and changes.

**Planned Features**:
- [ ] Ticket status change logs
- [ ] User login/logout logs
- [ ] Crew dispatch logs
- [ ] System configuration changes
- [ ] Export logs to CSV/PDF
- [ ] Filter logs by date, user, action type

**Current State**: Placeholder component with no functionality.

**File Location**: `ALECO_PIS/src/components/History.jsx`

---

#### 2. ❌ Scheduled Interruptions (`components/Interruptions.jsx`)
**Status**: 0% Complete

**Purpose**: Manage planned power outages and maintenance schedules.

**Planned Features**:
- [ ] Create scheduled interruption
- [ ] Set affected areas (district/municipality)
- [ ] Set start/end time
- [ ] Notify affected customers via SMS/Email
- [ ] Display on customer-facing page
- [ ] Calendar view of scheduled interruptions
- [ ] Automatic ticket creation for interruptions

**Current State**: Placeholder component with no functionality.

**File Location**: `ALECO_PIS/src/components/Interruptions.jsx`

**Database Table**: Not yet created (needs migration)

**Proposed Schema**:
```sql
CREATE TABLE aleco_interruptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  affected_districts JSON,
  affected_municipalities JSON,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status ENUM('Scheduled', 'Ongoing', 'Completed', 'Cancelled') DEFAULT 'Scheduled',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

---

#### 3. ❌ Customer Portal
**Status**: 0% Complete

**Purpose**: Allow customers to track their tickets and view interruptions.

**Planned Features**:
- [ ] Customer login
- [ ] View submitted tickets
- [ ] Track ticket status
- [ ] View scheduled interruptions
- [ ] Receive notifications
- [ ] Update contact information

---

#### 4. ❌ Mobile App
**Status**: 0% Complete

**Purpose**: Mobile app for linemen to update ticket status from the field.

**Planned Features**:
- [ ] View assigned tickets
- [ ] Update ticket status
- [ ] Add field remarks
- [ ] Upload photos from field
- [ ] GPS location tracking
- [ ] Offline mode

---

#### 5. ❌ Reporting & Analytics
**Status**: 0% Complete

**Purpose**: Generate reports and insights.

**Planned Features**:
- [ ] Monthly ticket reports
- [ ] Crew performance reports
- [ ] Resolution time analytics
- [ ] Category breakdown reports
- [ ] Export to PDF/Excel
- [ ] Scheduled report emails

---

## 📡 API Documentation

### Base URL
```
http://localhost:5000/api
```

---

### Authentication Endpoints

#### 1. Login
```http
POST /api/login
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

---

#### 2. Register
```http
POST /api/register
```

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "password123",
  "code": "123456789012"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Registration successful"
}
```

---

### Ticket Endpoints

#### 1. Submit Ticket
```http
POST /api/tickets/submit
```

**Request Body** (multipart/form-data):
```json
{
  "firstName": "Juan",
  "middleName": "Santos",
  "lastName": "Dela Cruz",
  "phoneNumber": "09123456789",
  "address": "123 Main St, Brgy Rawis",
  "district": "Legazpi",
  "municipality": "Legazpi City",
  "category": "PRIMARY LINE NO POWER",
  "concern": "No power since 8am",
  "isUrgent": true,
  "reportedLat": 13.1391,
  "reportedLng": 123.7348,
  "image": <File>
}
```

**Response**:
```json
{
  "success": true,
  "ticketId": "TKT-20260316-0001",
  "message": "Ticket submitted successfully"
}
```

---

#### 2. Get Filtered Tickets
```http
GET /api/filtered-tickets?status=Pending&district=Legazpi&search=TKT-20260316
```

**Query Parameters**:
- `status` - Filter by status
- `category` - Filter by category
- `district` - Filter by district
- `municipality` - Filter by municipality
- `search` - Search by ticket ID, name, or address
- `isUrgent` - Filter urgent tickets (`true`/`false`)
- `isNew` - Filter new tickets (`true`/`false`)

**Response**:
```json
{
  "success": true,
  "tickets": [
    {
      "id": 1,
      "ticket_id": "TKT-20260316-0001",
      "first_name": "Juan",
      "last_name": "Dela Cruz",
      "phone_number": "09123456789",
      "address": "123 Main St, Brgy Rawis",
      "category": "PRIMARY LINE NO POWER",
      "concern": "No power since 8am",
      "status": "Pending",
      "is_urgent": 1,
      "created_at": "2026-03-16 08:30:00",
      "district": "Legazpi",
      "municipality": "Legazpi City"
    }
  ]
}
```

---

#### 3. Track Ticket
```http
GET /api/tickets/track/:ticketId
```

**Response**:
```json
{
  "success": true,
  "ticket": {
    "ticket_id": "TKT-20260316-0001",
    "status": "Ongoing",
    "assigned_crew": "Team Alpha",
    "eta": "2 hours",
    "dispatch_notes": "Crew dispatched at 10:00 AM"
  }
}
```

---

#### 4. Update Ticket Status
```http
PUT /api/tickets/:ticketId/status
```

**Request Body**:
```json
{
  "status": "Restored",
  "remarks": "Power restored at 12:00 PM"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Ticket status updated"
}
```

---

#### 5. Dispatch Crew
```http
PUT /api/tickets/:ticketId/dispatch
```

**Request Body**:
```json
{
  "assignedCrew": "Team Alpha",
  "eta": "2 hours",
  "dispatchNotes": "Crew dispatched at 10:00 AM",
  "notifyCustomer": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Crew dispatched successfully"
}
```

---

### Ticket Grouping Endpoints

#### 1. Create Ticket Group
```http
POST /api/tickets/group/create
```

**Request Body**:
```json
{
  "title": "Transformer Failure - Brgy Rawis",
  "category": "PRIMARY LINE NO POWER",
  "remarks": "Multiple reports in same area",
  "ticketIds": ["TKT-20260316-0001", "TKT-20260316-0002", "TKT-20260316-0003"]
}
```

**Response**:
```json
{
  "success": true,
  "masterTicketId": "GROUP-20260316-0001",
  "message": "Ticket group created successfully"
}
```

---

#### 2. Get Ticket Group
```http
GET /api/tickets/group/:masterTicketId
```

**Response**:
```json
{
  "success": true,
  "masterTicket": {
    "ticket_id": "GROUP-20260316-0001",
    "category": "PRIMARY LINE NO POWER",
    "status": "Ongoing"
  },
  "childTickets": [
    {
      "ticket_id": "TKT-20260316-0001",
      "first_name": "Juan",
      "last_name": "Dela Cruz"
    }
  ]
}
```

---

#### 3. Restore Ticket Group
```http
PUT /api/tickets/group/:masterTicketId/restore
```

**Response**:
```json
{
  "success": true,
  "message": "All tickets in group restored",
  "updatedCount": 3
}
```

---

### User Management Endpoints

#### 1. Generate Invitation Code
```http
POST /api/invite
```

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "role": "employee"
}
```

**Response**:
```json
{
  "success": true,
  "code": "123456789012",
  "message": "Invitation code generated"
}
```

---

#### 2. Send Invitation Email
```http
POST /api/send-email
```

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "code": "123456789012"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

---

#### 3. Get All Users
```http
GET /api/users
```

**Response**:
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "admin",
      "status": "Active",
      "created_at": "2026-01-01 00:00:00"
    }
  ]
}
```

---

#### 4. Toggle User Status
```http
POST /api/users/toggle-status
```

**Request Body**:
```json
{
  "id": 1,
  "currentStatus": "Active"
}
```

**Response**:
```json
{
  "success": true,
  "message": "User status updated to Disabled",
  "newStatus": "Disabled"
}
```

---

### Personnel Management Endpoints

#### 1. Get All Crews
```http
GET /api/crews/list
```

**Response**:
```json
{
  "success": true,
  "crews": [
    {
      "id": 1,
      "crew_name": "Team Alpha",
      "lead_lineman": "Juan Dela Cruz",
      "phone_number": "09123456789",
      "status": "Available"
    }
  ]
}
```

---

#### 2. Get Linemen Pool
```http
GET /api/pool/list
```

**Response**:
```json
{
  "success": true,
  "linemen": [
    {
      "id": 1,
      "full_name": "Juan Dela Cruz",
      "designation": "Lineman",
      "contact_no": "09123456789",
      "status": "Active"
    }
  ]
}
```

---

## 🛠️ Development Guidelines

### Lego Brick Development Rules

#### 1. **Modular "Lego" Design**
- ✅ Write short, atomic, modular blocks
- ✅ Prioritize small functions over large classes
- ✅ Every line should serve a singular purpose
- ✅ Make code easy to read, test, and replace

**Example**:
```javascript
// ❌ BAD: Large monolithic function
function handleTicketSubmission(data) {
  // 200 lines of code doing everything
}

// ✅ GOOD: Small, focused functions
function validateTicketData(data) { }
function generateTicketId() { }
function uploadImage(file) { }
function saveTicketToDatabase(ticket) { }
function sendConfirmationEmail(ticket) { }
```

---

#### 2. **Idempotency**
- ✅ All scripts and functions must be idempotent
- ✅ Re-running the same operation multiple times must produce the same result
- ✅ No unintended side effects

**Example**:
```javascript
// ✅ GOOD: Idempotent status update
async function updateTicketStatus(ticketId, newStatus) {
  const [result] = await pool.execute(
    'UPDATE aleco_tickets SET status = ? WHERE ticket_id = ?',
    [newStatus, ticketId]
  );

  // Running this multiple times with same status = no change
  return result;
}
```

---

#### 3. **Backwards Compatibility**
- ✅ Ensure all schema changes don't break existing features
- ✅ Deprecate with care
- ✅ Never delete active dependencies without a migration path

**Example**:
```sql
-- ✅ GOOD: Add new column with default value
ALTER TABLE aleco_tickets
ADD COLUMN priority INT DEFAULT 1;

-- ❌ BAD: Remove column that might be in use
ALTER TABLE aleco_tickets
DROP COLUMN is_urgent;
```

---

#### 4. **No Hardcoding**
- ✅ Use environment variables for configuration
- ✅ Use database-driven settings for dynamic data
- ✅ Never hardcode URLs, credentials, or business logic

**Example**:
```javascript
// ❌ BAD: Hardcoded values
const apiUrl = 'http://localhost:5000/api';
const maxTickets = 100;

// ✅ GOOD: Environment variables
const apiUrl = process.env.API_URL;
const maxTickets = parseInt(process.env.MAX_TICKETS);
```

---

#### 5. **Database Context**
- ✅ No feature is "front-end only"
- ✅ Every integration must consider backend impact
- ✅ Always reference the database schema before proposing logic

---

#### 6. **Zero Assumption Policy**
- ✅ Do not guess intent, folder structures, or variable names
- ✅ If a detail is missing, ask for clarification
- ✅ Deliver code based only on confirmed tech stack and active database schema

---

### Code Style Guidelines

#### JavaScript/React

**1. Use ES Modules**:
```javascript
// ✅ GOOD
import express from 'express';
export default router;

// ❌ BAD
const express = require('express');
module.exports = router;
```

**2. Use Async/Await**:
```javascript
// ✅ GOOD
async function getTickets() {
  const [rows] = await pool.execute('SELECT * FROM aleco_tickets');
  return rows;
}

// ❌ BAD
function getTickets() {
  return pool.execute('SELECT * FROM aleco_tickets')
    .then(([rows]) => rows);
}
```

**3. Use Destructuring**:
```javascript
// ✅ GOOD
const { firstName, lastName, email } = req.body;

// ❌ BAD
const firstName = req.body.firstName;
const lastName = req.body.lastName;
const email = req.body.email;
```

**4. Use Template Literals**:
```javascript
// ✅ GOOD
const ticketId = `TKT-${dateStr}-${sequence}`;

// ❌ BAD
const ticketId = 'TKT-' + dateStr + '-' + sequence;
```

---

#### SQL

**1. Use Parameterized Queries**:
```javascript
// ✅ GOOD
const [rows] = await pool.execute(
  'SELECT * FROM aleco_tickets WHERE ticket_id = ?',
  [ticketId]
);

// ❌ BAD (SQL Injection risk)
const [rows] = await pool.execute(
  `SELECT * FROM aleco_tickets WHERE ticket_id = '${ticketId}'`
);
```

**2. Use Consistent Naming**:
```sql
-- ✅ GOOD: snake_case for columns
CREATE TABLE aleco_tickets (
  ticket_id VARCHAR(20),
  first_name VARCHAR(50),
  created_at TIMESTAMP
);

-- ❌ BAD: Mixed case
CREATE TABLE alecoTickets (
  ticketID VARCHAR(20),
  FirstName VARCHAR(50),
  createdAt TIMESTAMP
);
```

---

### Git Workflow

**Branch Naming**:
```
feature/ticket-grouping
bugfix/kanban-checkbox
hotfix/sql-parameter-mismatch
```

**Commit Messages**:
```
✅ feat: Add ticket grouping system
✅ fix: Fix kanban checkbox event propagation
✅ refactor: Extract ticket ID generation to utility
✅ docs: Update API documentation
```

---

### Testing Guidelines

**1. Test All API Endpoints**:
```javascript
// Example test
describe('POST /api/tickets/submit', () => {
  it('should create a new ticket', async () => {
    const response = await request(app)
      .post('/api/tickets/submit')
      .send(ticketData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.ticketId).toMatch(/^TKT-\d{8}-\d{4}$/);
  });
});
```

**2. Test Edge Cases**:
- Empty inputs
- Invalid data types
- SQL injection attempts
- Duplicate submissions
- Concurrent requests

---

## 🚀 Deployment Guide

### Prerequisites

1. **Node.js**: v18 or higher
2. **MySQL**: 8.0 or higher (Aiven MySQL recommended)
3. **Cloudinary Account**: For image uploads
4. **Twilio Account**: For SMS notifications
5. **SMTP Server**: For email notifications

---

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=your-aiven-mysql-host.aivencloud.com
DB_USER=avnadmin
DB_PASSWORD=your-password
DB_NAME=defaultdb
DB_PORT=12345

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Application Configuration
PORT=5000
NODE_ENV=production
```

---

### Installation Steps

#### 1. Clone Repository
```bash
git clone https://github.com/your-org/ALECO_PIS.git
cd ALECO_PIS
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

#### 4. Run Database Migrations
```bash
# Connect to your MySQL database
mysql -h your-host -u your-user -p

# Run migrations
source backend/migrations/fix_status_enum.sql
```

#### 5. Start Development Server
```bash
# Terminal 1: Start backend
npm run server

# Terminal 2: Start frontend
npm run dev
```

#### 6. Access Application
```
Frontend: http://localhost:5173
Backend: http://localhost:5000
```

---

### Production Deployment

#### Option 1: Traditional VPS (DigitalOcean, Linode, AWS EC2)

**1. Install Node.js**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**2. Install PM2**:
```bash
sudo npm install -g pm2
```

**3. Clone and Setup**:
```bash
git clone https://github.com/your-org/ALECO_PIS.git
cd ALECO_PIS
npm install
npm run build
```

**4. Start with PM2**:
```bash
pm2 start server.js --name aleco-backend
pm2 startup
pm2 save
```

**5. Setup Nginx**:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /var/www/ALECO_PIS/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

#### Option 2: Vercel (Frontend) + Railway (Backend)

**Frontend (Vercel)**:
```bash
npm install -g vercel
vercel --prod
```

**Backend (Railway)**:
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push

---

### Database Backup

**Automated Daily Backup**:
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/aleco_pis"

mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +30 -delete
```

**Cron Job**:
```bash
0 2 * * * /path/to/backup.sh
```

---

## 🔮 Future Roadmap

### Phase 1: Complete Core Features (Q2 2026)

#### 1. History Logs Implementation
- [ ] Create `aleco_history_logs` table
- [ ] Log all ticket status changes
- [ ] Log user login/logout
- [ ] Log crew dispatch events
- [ ] Build History.jsx component
- [ ] Add filtering and search
- [ ] Export logs to CSV

**Estimated Time**: 2 weeks

---

#### 2. Scheduled Interruptions Implementation
- [ ] Create `aleco_interruptions` table
- [ ] Build Interruptions.jsx component
- [ ] Create interruption form
- [ ] Calendar view
- [ ] SMS/Email notifications to affected customers
- [ ] Display on customer-facing page

**Estimated Time**: 3 weeks

---

#### 3. Complete Ticket Management
- [ ] Add ticket editing functionality
- [ ] Add ticket deletion (soft delete)
- [ ] Add comment/notes system
- [ ] Add ticket history timeline
- [ ] Add attachment support (multiple images)

**Estimated Time**: 2 weeks

---

### Phase 2: Analytics & Reporting (Q3 2026)

#### 1. Dashboard Analytics
- [ ] Ticket trend charts (Recharts)
- [ ] Resolution time analytics
- [ ] Crew performance metrics
- [ ] Geographic heat maps (Leaflet)
- [ ] Category breakdown charts

**Estimated Time**: 3 weeks

---

#### 2. Reporting System
- [ ] Monthly ticket reports
- [ ] Crew performance reports
- [ ] Export to PDF (jsPDF)
- [ ] Export to Excel (xlsx)
- [ ] Scheduled report emails

**Estimated Time**: 2 weeks

---

### Phase 3: Customer Portal (Q4 2026)

#### 1. Customer Authentication
- [ ] Customer login system
- [ ] Email verification
- [ ] Password reset

**Estimated Time**: 1 week

---

#### 2. Customer Dashboard
- [ ] View submitted tickets
- [ ] Track ticket status
- [ ] View scheduled interruptions
- [ ] Receive notifications
- [ ] Update contact information

**Estimated Time**: 3 weeks

---

### Phase 4: Mobile App (Q1 2027)

#### 1. Lineman Mobile App (React Native)
- [ ] View assigned tickets
- [ ] Update ticket status
- [ ] Add field remarks
- [ ] Upload photos from field
- [ ] GPS location tracking
- [ ] Offline mode

**Estimated Time**: 8 weeks

---

### Phase 5: Advanced Features (Q2 2027)

#### 1. Real-time Features
- [ ] WebSocket integration
- [ ] Real-time ticket updates
- [ ] Live crew location tracking
- [ ] Push notifications

**Estimated Time**: 4 weeks

---

#### 2. AI/ML Features
- [ ] Automatic ticket categorization
- [ ] Predictive maintenance
- [ ] Optimal crew routing
- [ ] Outage prediction

**Estimated Time**: 12 weeks

---

## 📝 Appendix

### Common Issues & Solutions

#### 1. Bulk Action Bar Not Appearing
**Problem**: Checkbox selection doesn't trigger bulk action bar.

**Solution**: Ensure `TicketMain.css` is imported in `Tickets.jsx`:
```javascript
import '../CSS/TicketMain.css';
```

---

#### 2. Kanban Checkbox Not Working
**Problem**: Clicking checkbox triggers drag instead.

**Solution**: Add `e.stopPropagation()` to checkbox handler:
```javascript
<input
  type="checkbox"
  onClick={(e) => e.stopPropagation()}
  onChange={() => onToggleSelect(ticket.ticket_id)}
/>
```

---

#### 3. SQL Parameter Mismatch
**Problem**: "Column count doesn't match value count" error.

**Solution**: Ensure parameter count matches placeholder count:
```javascript
// ✅ GOOD: 4 placeholders, 4 values
const [result] = await pool.execute(
  'INSERT INTO table (a, b, c, d) VALUES (?, ?, ?, ?)',
  [val1, val2, val3, val4]
);
```

---

#### 4. CORS Error
**Problem**: Frontend can't connect to backend.

**Solution**: Ensure CORS is enabled in `server.js`:
```javascript
import cors from 'cors';
app.use(cors());
```

---

### Glossary

- **Lego Brick**: A self-contained, modular component or route
- **Idempotent**: An operation that produces the same result when called multiple times
- **Master Ticket**: A parent ticket that groups multiple child tickets
- **Ticket ID**: Unique identifier in format `TKT-YYYYMMDD-XXXX`
- **Group ID**: Master ticket identifier in format `GROUP-YYYYMMDD-XXXX`
- **ESM**: ES Modules (import/export syntax)
- **Glassmorphism**: UI design with frosted glass effect

---

### Contact & Support

**Developer**: Amando Zeus C. Millete
**Email**: aezymillete16@gmail.com
**GitHub**: @zeusgitDev16
**Organization**: Albay Electric Cooperative (ALECO)

---

**Last Updated**: March 16, 2026
**Version**: 1.0.0
**License**: Proprietary - ALECO Internal Use Only

---

## 🎉 Conclusion

The ALECO Power Interruption System (PIS) is a robust, modular, and scalable platform built with the **Lego Brick methodology**. While core features are fully functional, there are exciting opportunities for expansion in analytics, customer portals, and mobile applications.

**Key Achievements**:
- ✅ Modular architecture with strict separation of concerns
- ✅ Comprehensive ticket management with 3 view modes
- ✅ Ticket grouping system for efficient incident management
- ✅ User invitation system with role-based access control
- ✅ Crew dispatch system with SMS notifications
- ✅ GPS-based location tracking

**Next Steps**:
1. Implement History Logs
2. Implement Scheduled Interruptions
3. Complete Dashboard Analytics
4. Build Customer Portal

**Remember**: Every new feature must follow the **Lego Brick principles** - atomic, idempotent, replaceable, testable, and backwards compatible.

---

**Happy Coding! 🚀**


