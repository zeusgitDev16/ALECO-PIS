# Phone Number System – Database Scan Report

**Date:** March 16, 2026  
**Purpose:** Pre-revamp confirmation – live database schema and data analysis  
**Database:** `defaultdb` (Aiven MySQL)  
**Method:** MCP tool `user-aleco_db` → `mysql_query`

---

## 1. Tables in Database

| Table | Exists |
|-------|--------|
| access_codes | ✅ |
| aleco_crew_members | ✅ |
| aleco_export_log | ✅ |
| aleco_incidents | ✅ |
| aleco_linemen_pool | ✅ |
| aleco_personnel | ✅ |
| aleco_ticket_logs | ✅ |
| aleco_tickets | ✅ |
| password_resets | ✅ |
| users | ✅ |
| aleco_ticket_groups | ❌ (not created) |
| aleco_ticket_group_members | ❌ (not created) |
| **aleco_contact_numbers** | ❌ (does not exist – to be created) |

---

## 2. Phone-Related Columns (Live Schema)

### 2.1 `aleco_tickets`

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|------|
| **phone_number** | varchar(20) | NO | NULL | Consumer contact – NOT NULL but 5 rows have empty string |

**Indexes:** No index on `phone_number` (duplicate check does full table scan).

**Status enum:** `Pending`, `Ongoing`, `Restored`, `Unresolved`, `NoFaultFound`, `AccessDenied`

**Other columns present:** hold_reason, hold_since, dispatched_at, group_type, visit_order, deleted_at, GPS fields, etc.

---

### 2.2 `aleco_personnel`

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|------|
| **phone_number** | varchar(20) | NO | NULL | Crew dispatch hotline |

**Status enum:** `Available`, `On-Task`, `Offline` (differs from docs: `Deployed` → `On-Task`)

---

### 2.3 `aleco_linemen_pool`

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|------|
| **contact_no** | varchar(20) | NO | NULL | Lineman personal contact |

**Status enum:** `Active`, `Inactive`, `Leave`

**Leave columns:** leave_start, leave_end, leave_reason ✅

---

## 3. Live Data Analysis

### 3.1 `aleco_tickets.phone_number`

| Metric | Value |
|--------|-------|
| Total tickets | 44 |
| Empty string (`''`) | 5 |
| Non-empty | 39 |

**Distinct phone formats observed:**

| phone_number | Length | Format |
|--------------|--------|--------|
| 09453268052 | 11 | 09XX (mobile) |
| 09615218321 | 11 | 09XX (mobile) |
| 09943917653 | 11 | 09XX (mobile) |
| 09974767844 | 11 | 09XX (mobile) |
| 09987292745 | 11 | 09XX (mobile) |

**Conclusion:** All non-empty ticket phones are Philippine mobile (09XX). No landlines in current data.

---

### 3.2 `aleco_personnel.phone_number`

| phone_number | Format |
|--------------|--------|
| 639453268052 | 63XXXXXXXXX (12 digits) |
| 639987292745 | 63XXXXXXXXX (12 digits) |

**Conclusion:** Personnel phones stored in international format (63 prefix). Different from tickets (09XX).

---

### 3.3 `aleco_linemen_pool.contact_no`

| contact_no | Format |
|------------|--------|
| 639453268052 | 63XXXXXXXXX |
| 639987292745 | 63XXXXXXXXX |

**Conclusion:** Same as personnel – international format.

---

## 4. Format Inconsistency Summary

| Table | Column | Current Storage | Backend Expects |
|-------|--------|-----------------|-----------------|
| aleco_tickets | phone_number | 09XXXXXXXXX (11) or `''` | 63XXXXXXXXX (normalized on submit) |
| aleco_personnel | phone_number | 63XXXXXXXXX (12) | 63XXXXXXXXX |
| aleco_linemen_pool | contact_no | 63XXXXXXXXX (12) | 63XXXXXXXXX |

**Note:** Backend `normalizePhoneForDB()` converts 09xx → 63xx before insert. So tickets may be stored as 09xx if an older path was used, or 63xx if current submit flow is used. Live data shows 09xx in tickets – possible legacy or different code path.

---

## 5. Revamp Impact – Confirmed

### 5.1 Tables to Modify

| Table | Action |
|-------|--------|
| **aleco_tickets** | Add `phone_type` enum (optional), optionally `alternate_phone`; consider index on `phone_number` for duplicate check |
| **aleco_contact_numbers** | **CREATE** – new table for hotlines/business numbers |

### 5.2 Tables Unchanged (for Phase 1)

| Table | Reason |
|-------|--------|
| aleco_personnel | Keep as-is; crew hotlines already work |
| aleco_linemen_pool | Keep as-is |

### 5.3 Data Migration

- **5 tickets with empty `phone_number`:** Decide policy (allow NULL vs require phone, or backfill).
- **Existing ticket phones:** All 09XX mobile; no migration needed if we keep mobile-only for now.
- **Personnel/Linemen:** No change; format is already correct.

---

## 6. Proposed `aleco_contact_numbers` Schema (for confirmation)

```sql
CREATE TABLE aleco_contact_numbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('hotline', 'business', 'emergency') NOT NULL,
  label VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active_order (is_active, display_order)
);
```

---

## 7. Optional: Index for Duplicate Check

```sql
-- Improves duplicate check performance (WHERE phone_number = ? AND ...)
ALTER TABLE aleco_tickets ADD INDEX idx_phone_created (phone_number, created_at);
```

---

## 8. Summary

| Item | Status |
|------|--------|
| Database scanned | ✅ |
| Phone columns identified | ✅ (3 tables, 3 columns) |
| Data format analyzed | ✅ (tickets: 09xx; personnel/linemen: 63xx) |
| Empty phone records | ✅ (5 tickets) |
| aleco_contact_numbers | ❌ Does not exist |
| phone_type column | ❌ Does not exist |
| Index on phone_number | ❌ Does not exist |

**Ready for revamp:** Yes. Schema and data are understood; no blocking issues found.
