# 🚀 Cursor AI Quick Reference Guide - ALECO PIS

## 📍 You Are Here

**Project**: ALECO Power Interruption System (PIS)  
**Developer**: Amando Zeus C. Millete (@zeusgitDev16)  
**Purpose**: Manage power outage tickets, crew dispatch, and customer communications  
**Status**: Core features implemented, analytics and history logs pending

---

## ⚡ Quick Start Checklist

Before touching ANY code:

- [ ] Read `.cursorrules` file
- [ ] Check `ALECO_PIS_COMPLETE_DOCUMENTATION.md` for context
- [ ] Verify database schema for affected tables
- [ ] Search codebase for similar implementations
- [ ] Plan changes with backwards compatibility in mind

---

## 🗄️ Database Quick Reference

### Critical Tables

```sql
-- Users (Authentication)
users: id, email, password, role, status

-- Tickets (Core System)
aleco_tickets: 
  - ticket_id VARCHAR(20) UNIQUE  ← Use this for logic!
  - id INT AUTO_INCREMENT          ← Only for DB internal use
  - parent_ticket_id VARCHAR(20)   ← For grouped tickets
  - status ENUM('Pending', 'Ongoing', 'Restored', 'Unresolved')  ← NO 'Resolved'!
  - category, concern, is_urgent, assigned_crew, etc.

-- Crews
aleco_personnel: id, crew_name UNIQUE, lead_lineman, status

-- Linemen
aleco_linemen_pool: id, full_name, designation, contact_no, status

-- Invitation Codes
access_codes: id, email, role_assigned, code UNIQUE, status
```

### Ticket ID Formats

```
Regular Ticket: TKT-20260316-0001
Master Ticket:  GROUP-20260316-0001
```

### Status Flow

```
Pending → Ongoing → Restored
   ↓         ↓
Unresolved ← ←
```

---

## 📁 File Structure Map

```
ALECO_PIS/
├── server.js                          # Backend entry point
├── .cursorrules                       # YOU ARE READING THIS!
├── ALECO_PIS_COMPLETE_DOCUMENTATION.md # FULL SYSTEM DOCS
├── CURSOR_QUICK_REFERENCE.md          # This file
├── backend/
│   ├── config/db.js                   # MySQL pool
│   └── routes/
│       ├── auth.js                    # Login, register
│       ├── tickets.js                 # Submit, track, dispatch
│       ├── ticket-routes.js           # Filtering, crews, linemen
│       ├── ticket-grouping.js         # Group tickets
│       └── user.js                    # Invite, manage users
├── src/
│   ├── components/
│   │   ├── Tickets.jsx                # MAIN TICKET PAGE ⭐
│   │   ├── Users.jsx                  # User management
│   │   ├── PersonnelManagement.jsx    # Crew management
│   │   ├── History.jsx                # ❌ NOT IMPLEMENTED
│   │   ├── Interruptions.jsx          # ❌ NOT IMPLEMENTED
│   │   └── tickets/
│   │       ├── TicketFilterBar.jsx    # Filters
│   │       ├── TicketListPane.jsx     # Grid view
│   │       ├── TicketTableView.jsx    # Table view
│   │       ├── TicketKanbanView.jsx   # Kanban view
│   │       ├── GroupIncidentModal.jsx # Bulk action bar
│   │       └── kanban/
│   │           ├── KanbanColumn.jsx
│   │           └── KanbanTicketCard.jsx
│   ├── CSS/                           # One component = one CSS file
│   ├── utils/
│   │   ├── useTickets.js              # Ticket data hook
│   │   └── useDraggable.js            # Drag-and-drop hook
│   └── api/axiosConfig.js             # Axios instance
└── package.json
```

---

## 🔥 Critical Code Patterns

### Backend: Parameterized Queries

```javascript
// ✅ ALWAYS DO THIS
const [rows] = await pool.execute(
  'SELECT * FROM aleco_tickets WHERE ticket_id = ? AND status = ?',
  [ticketId, status]
);

// ❌ NEVER DO THIS (SQL Injection!)
const [rows] = await pool.execute(
  `SELECT * FROM aleco_tickets WHERE ticket_id = '${ticketId}'`
);
```

### Backend: Error Handling

```javascript
router.post('/endpoint', async (req, res) => {
  try {
    // Your logic here
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

### Frontend: Event Propagation

```javascript
// ✅ Stop propagation for nested interactive elements
<div onClick={handleCardClick}>
  <input 
    type="checkbox"
    onClick={(e) => e.stopPropagation()}  // ← CRITICAL!
    onChange={() => onToggleSelect(id)}
  />
</div>
```

### Frontend: Kanban Sortable

```javascript
// ✅ CORRECT: Use ticket_id (VARCHAR)
const { attributes, listeners, setNodeRef } = useSortable({ 
  id: ticket.ticket_id  // ← Use this!
});

// ❌ WRONG: ticket.id doesn't exist in frontend
const { attributes, listeners, setNodeRef } = useSortable({ 
  id: ticket.id  // ← This breaks everything!
});
```

### Frontend: Drag Handle Isolation

```javascript
// ✅ CORRECT: Drag listeners on specific handle
<div className="kanban-ticket-card" ref={setNodeRef}>
  <input type="checkbox" onClick={(e) => e.stopPropagation()} />
  <div className="category-badge" {...listeners} {...attributes}>
    {ticket.category}
  </div>
</div>

// ❌ WRONG: Drag listeners on entire card (blocks checkbox)
<div className="kanban-ticket-card" ref={setNodeRef} {...listeners} {...attributes}>
  <input type="checkbox" />  {/* Can't click this! */}
</div>
```

---

## 🎯 Common Tasks

### Task: Add New API Endpoint

1. **Create route in appropriate brick**:
   ```javascript
   // backend/routes/tickets.js
   router.post('/tickets/new-action', async (req, res) => {
     try {
       const { param1, param2 } = req.body;
       const [result] = await pool.execute('...', [param1, param2]);
       res.json({ success: true, data: result });
     } catch (error) {
       console.error('❌ Error:', error);
       res.status(500).json({ success: false, message: 'Error' });
     }
   });
   ```

2. **No need to modify server.js** (route already mounted!)

3. **Test**:
   ```bash
   curl -X POST http://localhost:5000/api/tickets/new-action \
     -H "Content-Type: application/json" \
     -d '{"param1":"value1","param2":"value2"}'
   ```

### Task: Add New React Component

1. **Create component file**:
   ```javascript
   // src/components/NewFeature.jsx
   import React from 'react';
   import '../CSS/NewFeature.css';
   
   const NewFeature = () => {
     return <div className="new-feature">Content</div>;
   };
   
   export default NewFeature;
   ```

2. **Create CSS file**:
   ```css
   /* src/CSS/NewFeature.css */
   .new-feature {
     /* styles */
   }
   ```

3. **Import in parent**:
   ```javascript
   import NewFeature from './components/NewFeature';
   ```

### Task: Modify Database Schema

1. **Create migration file**:
   ```sql
   -- backend/migrations/add_new_column.sql
   ALTER TABLE aleco_tickets 
   ADD COLUMN new_field VARCHAR(100) DEFAULT NULL;
   ```

2. **Test on local DB first**

3. **Document in ALECO_PIS_COMPLETE_DOCUMENTATION.md**

4. **Update affected queries**

---

## 🐛 Debugging Checklist

### Frontend Not Showing Data?

- [ ] Check browser console for errors
- [ ] Verify API endpoint is correct
- [ ] Check network tab for failed requests
- [ ] Ensure state is being updated
- [ ] Check if CSS file is imported

### Backend Returning Errors?

- [ ] Check server console for error messages
- [ ] Verify SQL query syntax
- [ ] Count SQL placeholders vs parameters
- [ ] Check database connection
- [ ] Verify table/column names

### Kanban Not Working?

- [ ] Using `ticket.ticket_id` not `ticket.id`?
- [ ] Drag listeners on handle, not entire card?
- [ ] Checkbox has `e.stopPropagation()`?
- [ ] `selectedIds` and `onToggleSelect` passed down?

### Bulk Action Bar Not Appearing?

- [ ] `TicketMain.css` imported in `Tickets.jsx`?
- [ ] `selectedIds.length > 0`?
- [ ] Check z-index conflicts
- [ ] Verify state updates

---

## 📚 Where to Find Information

| Question | Look Here |
|----------|-----------|
| How does the system work? | `ALECO_PIS_COMPLETE_DOCUMENTATION.md` |
| What are the rules? | `.cursorrules` |
| Database schema? | Documentation Section 4 |
| API endpoints? | Documentation Section 8 |
| How to deploy? | Documentation Section 10 |
| What's not implemented? | Documentation Section 7 |
| Ticket grouping? | `TICKET_GROUPING_GUIDE.md` |

---

## 🚨 Emergency Fixes

### SQL Parameter Mismatch Error

```javascript
// ❌ WRONG: 4 placeholders, 5 values
await pool.execute(
  'INSERT INTO table (a, b, c, d) VALUES (?, ?, ?, ?)',
  [v1, v2, v3, 'hardcoded', v4]  // 5 values!
);

// ✅ FIX: Remove hardcoded value from array OR add to SQL
await pool.execute(
  'INSERT INTO table (a, b, c, d) VALUES (?, ?, ?, ?)',
  [v1, v2, v3, v4]  // 4 values
);
```

### Kanban Drag Not Working

```javascript
// ✅ FIX: Change this
useSortable({ id: ticket.id })

// To this
useSortable({ id: ticket.ticket_id })
```

### Checkbox Triggers Drag

```javascript
// ✅ FIX: Add stopPropagation
<input 
  type="checkbox"
  onClick={(e) => e.stopPropagation()}
  onChange={handler}
/>
```

---

## 💡 Pro Tips

1. **Always check documentation first** - It's comprehensive!
2. **Use existing patterns** - Don't reinvent the wheel
3. **Test immediately** - Don't stack changes
4. **Ask when unsure** - Better than breaking things
5. **Follow Lego Brick method** - Keep it modular
6. **Maintain idempotency** - Safe to re-run
7. **Preserve backwards compatibility** - Don't break existing features

---

## 🎓 Key Learnings from Past Bugs

1. **User Invitation Bug**: Always match SQL parameter count
2. **Kanban Checkbox Bug**: Use correct ID (`ticket_id` not `id`)
3. **Bulk Bar Invisible**: Import required CSS files
4. **Drag Handle Issue**: Isolate drag listeners to specific element

---

## 🎯 Your Mission

Make ALECO PIS better while following the Lego Brick methodology. Every change should be:

- ✅ Atomic and focused
- ✅ Idempotent and safe
- ✅ Backwards compatible
- ✅ Well-documented
- ✅ Thoroughly tested

---

**Good luck! You've got this! 🚀**

*Last updated: March 16, 2026*
