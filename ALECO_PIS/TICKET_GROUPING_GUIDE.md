# 🔗 Ticket Grouping System - Implementation Guide

## 📋 Overview

The Ticket Grouping System allows you to group similar tickets under a single **Main Ticket ID**, enabling unified resolution and status management for multiple related incidents.

---

## 🎯 Key Features

1. **Main Ticket ID Generation**: Automatically generates unique group IDs (Format: `GROUP-YYYYMMDD-XXXX`)
2. **Bulk Selection**: Select multiple tickets using checkboxes
3. **Draggable Bulk Action Bar**: Floating action bar that appears when tickets are selected
4. **One-Click Resolution**: Resolve all grouped tickets with a single action
5. **Status Synchronization**: Updating the group status updates all member tickets

---

## 🛠️ Setup Instructions

### Step 1: Run Database Migration

Execute the SQL migration to create the required tables:

```bash
# Navigate to the backend directory
cd ALECO_PIS/backend

# Run the migration script
mysql -u your_username -p your_database < migrations/create_ticket_grouping_tables.sql
```

This creates:
- `aleco_ticket_groups` - Stores main ticket group records
- `aleco_ticket_group_members` - Links individual tickets to groups
- Adds `is_grouped` and `group_id` columns to `aleco_tickets`

### Step 2: Restart the Server

The grouping routes are already integrated into `server.js`. Simply restart:

```bash
npm start
```

---

## 📖 How to Use

### 1. Select Tickets

- Navigate to the Tickets page
- Use checkboxes on ticket cards to select multiple tickets
- The **Bulk Action Bar** will appear at the bottom of the screen

### 2. Group Tickets

- Click the **"Group"** button in the Bulk Action Bar
- The **Group Incident Modal** will open
- Fill in the required fields:
  - **Master Category**: Select the main category for the group
  - **Incident Title/Location**: Descriptive title (e.g., "Blown Transformer - Brgy Rawis")
  - **Initial Remarks**: Optional notes about the incident
- Click **"Confirm & Group"**

### 3. Main Ticket ID

- A unique Main Ticket ID is generated (e.g., `GROUP-20260316-0001`)
- All selected tickets are linked to this ID
- Individual tickets are marked as `is_grouped = 1`

### 4. Manage Grouped Tickets

- View all groups via the API: `GET /api/tickets/groups`
- Update group status: `PUT /api/tickets/group/:mainTicketId/status`
- When you update a group's status, all member tickets are updated automatically

### 5. Bulk Resolve

- Select multiple tickets (grouped or ungrouped)
- Click the **"Resolve"** button in the Bulk Action Bar
- Confirm the action
- All selected tickets are marked as "Resolved"

---

## 🔌 API Endpoints

### Create Ticket Group
```http
POST /api/tickets/group/create
Content-Type: application/json

{
  "title": "Blown 50kVA Transformer - Brgy Rawis",
  "category": "PRIMARY LINE NO POWER",
  "remarks": "Lineman Team Alpha dispatched",
  "ticketIds": ["ALECO-ABC123", "ALECO-ABC124", "ALECO-ABC125"]
}
```

**Response:**
```json
{
  "success": true,
  "mainTicketId": "GROUP-20260316-0001",
  "message": "Successfully grouped 3 tickets under GROUP-20260316-0001"
}
```

### Get All Groups
```http
GET /api/tickets/groups
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "main_ticket_id": "GROUP-20260316-0001",
      "title": "Blown 50kVA Transformer - Brgy Rawis",
      "category": "PRIMARY LINE NO POWER",
      "status": "Pending",
      "ticket_count": 3,
      "tickets": [...]
    }
  ]
}
```

### Update Group Status
```http
PUT /api/tickets/group/GROUP-20260316-0001/status
Content-Type: application/json

{
  "status": "Resolved"
}
```

### Bulk Resolve Tickets
```http
PUT /api/tickets/bulk/resolve
Content-Type: application/json

{
  "ticketIds": ["ALECO-ABC123", "ALECO-ABC124"]
}
```

---

## 🎨 UI Components

### Bulk Action Bar
- **Location**: Fixed at bottom center of screen
- **Trigger**: Appears when `selectedIds.length > 0`
- **Features**:
  - Draggable (can be moved around the screen)
  - Shows count of selected tickets
  - Three action buttons: Group, Resolve, Cancel

### Group Incident Modal
- **Trigger**: Click "Group" button in Bulk Action Bar
- **Features**:
  - Draggable modal
  - Shows summary of selected tickets
  - Form for group details
  - Validation for required fields

---

## 🧪 Testing Checklist

- [ ] Select 2+ tickets and verify Bulk Action Bar appears
- [ ] Drag the Bulk Action Bar around the screen
- [ ] Click "Group" and verify modal opens
- [ ] Submit group form and verify Main Ticket ID is generated
- [ ] Verify all member tickets are marked as `is_grouped = 1`
- [ ] Update group status and verify all member tickets update
- [ ] Select tickets and click "Resolve" to test bulk resolve
- [ ] Verify "Cancel" button clears selection

---

## 📁 File Locations

### Backend
- **Routes**: `ALECO_PIS/backend/routes/ticket-grouping.js`
- **Migration**: `ALECO_PIS/backend/migrations/create_ticket_grouping_tables.sql`
- **Server Integration**: `ALECO_PIS/server.js`

### Frontend
- **Main Component**: `ALECO_PIS/src/components/Tickets.jsx`
- **Group Modal**: `ALECO_PIS/src/components/tickets/GroupIncidentModal.jsx`
- **Bulk Action CSS**: `ALECO_PIS/src/CSS/TicketMain.css`

---

## ✅ Benefits

1. **Efficiency**: Resolve multiple related tickets with one action
2. **Organization**: Group similar incidents for better tracking
3. **Traceability**: Main Ticket ID provides clear audit trail
4. **Flexibility**: Can group tickets or resolve individually
5. **Professional**: Clean, modern UI with smooth animations

---

## 🚀 Next Steps

1. Run the database migration
2. Restart the server
3. Test the grouping functionality
4. Consider adding a "Grouped Tickets" view to display all groups
5. Add filtering/searching for grouped tickets

---

**Created**: 2026-03-16  
**Version**: 1.0.0  
**Status**: Production Ready ✅

