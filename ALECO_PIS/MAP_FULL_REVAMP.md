# ALECO PIS: Full Map & Location Revamp Plan

## Executive Summary
This document outlines the strategy to achieve 100% precise geographic mapping for power interruption tickets. Currently, the system relies either on device GPS ("Find My Location") or broad municipality-level geocoding. This revamp introduces an interactive "Pin Drop" feature, allowing users to report precise locations remotely (e.g., reporting a home issue from work) without altering the existing, fully functional GPS logic.

---

## 1. Current State Analysis & Findings

I have scanned the codebase and database. Here are the key findings that make this revamp highly feasible without major structural changes:

*   **Database Readiness:** The `aleco_tickets` table already has `reported_lat` (decimal 10,8) and `reported_lng` (decimal 11,8) columns. **No database migrations are needed.**
*   **Existing GPS Logic:** `ReportaProblem.jsx` successfully uses the Google Maps Geocoding API to reverse-geocode browser coordinates and saves them to `reported_lat`/`lng` with `location_method = 'gps'`.
*   **The Inaccuracy Root Cause:** When users *don't* use GPS (the manual flow), they select a District and Municipality. The system likely falls back to `geocoder.js` which provides the *center point* of that municipality. Thus, all manual tickets stack on top of each other in the center of the town on the Admin Map.
*   **Existing Map Tech:** The admin dashboard already uses `react-leaflet` (OpenStreetMap) for the `CoverageMap.jsx`. We can leverage this free, existing library for the new frontend features.
*   **CoverageMap.jsx Constraints:** The current `CoverageMap.jsx` uses a complex string-matching algorithm (`getTicketPosition`) that tries to guess the `lat`/`lng` by parsing the text of `ticket.location` against `alecoScope.js`. **It currently ignores `ticket.reported_lat` and `ticket.reported_lng` entirely.** It also uses a "jitter" algorithm to prevent markers from stacking exactly on top of each other, which confirms that manual tickets are currently clumping at town centers.

---

## 2. Goals & Solutions

### Goal 1: Alternative to GPS in "Report a Problem" (Remote Reporting)
**Scenario:** User is at work but needs to report a sparking wire at their house.
**Solution: The Interactive "Pin Drop" Map Picker**
1.  **UI Addition:** In `ReportaProblem.jsx` (Step 4: Location), keep the existing "📍 Find My Location" button exactly as it is. Next to it, add a new button: **"🗺️ Pin Location on Map"**.
2.  **Interaction:** 
    *   Clicking the button opens a modal containing a `react-leaflet` map.
    *   The map initially centers on the user's selected Municipality (using your existing `geocoder.js` bounds).
    *   The user drags a marker to the exact street/house where the problem is.
    *   Clicking "Confirm Location" saves the marker's `lat` and `lng` to the form state.
3.  **Data Payload:** The submission payload will send these coordinates with `location_method: 'map_pin'` and `location_confidence: 'high'`.

### Goal 2: Precise Map Location in the Tickets Dashboard
**Scenario:** Dispatchers need to see the exact house/pole, not just the town center.
**Solution: Coordinate Prioritization in `CoverageMap.jsx`**
1.  **Prep Work:** Before adding the pin drop, `CoverageMap.jsx`'s `getTicketPosition()` function must be rewritten to check `ticket.reported_lat` and `ticket.reported_lng` first.
2.  **Fallback:** If the explicit coordinates are null, it should fall back to the existing string-matching algorithm that guesses the location based on the Barangay/Municipality name.
3.  **Visual Overhaul:** Since tickets will now have precise, scattered locations, we should implement **Marker Clustering** (`react-leaflet-cluster`). This prevents the map from becoming unreadable if there are 50 precise tickets in one subdivision.

### Goal 3: Exact Location in Ticket Detail View
**Scenario:** A lineman is looking at a specific ticket and needs directions.
**Solution: Mini-Map Integration**
1.  In `TicketDetailPane.jsx`, if `reported_lat` and `reported_lng` exist, display a small, read-only `LocationPreviewMap` (reusing the component you already have in `ReportaProblem`).
2.  Add a "View on Google Maps" button that opens a new tab: `https://maps.google.com/?q={lat},{lng}` for easy navigation by linemen.

---

## 3. Step-by-Step Implementation Guide

### Step 1: Create the `MapPinPicker` Component
*   Create `src/components/maps/MapPinPicker.jsx`.
*   Use `react-leaflet` (`MapContainer`, `TileLayer`, `Marker`, `useMapEvents`).
*   Implement a draggable marker. When dragged, update a local `lat/lng` state.

### Step 2: Integrate into `ReportaProblem.jsx`
*   Import `MapPinPicker`.
*   Add state `showMapPicker` (boolean).
*   Add the "🗺️ Pin Location on Map" button.
*   When the picker modal is confirmed, update `setGpsData` to simulate a lock:
    ```javascript
    setGpsData({
        lat: pickedLat,
        lng: pickedLng,
        accuracy: 5, // Manual pins are treated as highly accurate intent
        method: 'map_pin',
        isLocked: true
    });
    ```
*   *(Note: This seamlessly integrates with your existing validation and submission logic).*

### Step 3: Refactor `CoverageMap.jsx`
*   Install `react-leaflet-cluster` (if not already installed).
*   Update the marker plotting logic to use `reported_lat` and `reported_lng`.
*   Wrap the `<Marker>` components in a `<MarkerClusterGroup>` for a clean UI.

### Step 4: Enhance `TicketDetailPane.jsx`
*   Conditionally render `<LocationPreviewMap>` inside the ticket details if coordinates are present.
*   Add the Google Maps deep-link button.

---

## 4. AI Execution Prompt
*(Copy and paste this section to the AI when you are ready to execute the plan)*

**PROMPT:**
"Hello AI, please execute the Full Map & Location Revamp as outlined in this document. 

Here are your strict instructions:
1. **No Database Migrations:** Do not modify the `aleco_tickets` table schema. We are using the existing `reported_lat` and `reported_lng` columns.
2. **Library Installation:** First, check `package.json`. You MUST install `react-leaflet-cluster` via `npm install react-leaflet-cluster` because it is currently missing.
3. **MapPinPicker Component:** Create `src/components/maps/MapPinPicker.jsx`. It must be a modal containing a `MapContainer` from `react-leaflet`.
    - It must accept `initialLat`, `initialLng`, `onConfirm(lat, lng)`, and `onCancel()`.
    - Use the `useMapEvents` hook to allow the user to click the map to move the marker.
4. **ReportaProblem.jsx Integration:**
    - Import `MapPinPicker`.
    - In the Location Step (Step 4), add a new button: `🗺️ Pin Location on Map` next to the existing "Find My Location" button.
    - When clicked, open the `MapPinPicker`. Set its initial center using the user's selected Municipality. **You must import and use `ALECO_SCOPE` from `alecoScope.js`** to find the `lat`/`lng` of the selected municipality to use as the starting center point of the map.
    - When the user confirms the pin, update the `gpsData` state: `setGpsData({ lat: pickedLat, lng: pickedLng, accuracy: 5, method: 'map_pin', isLocked: true })`.
5. **CoverageMap.jsx Update:**
    - I have already prepped `getTicketPosition()` to accept precise coordinates.
    - You must wrap the `tickets.map(...)` rendering the markers inside a `<MarkerClusterGroup>` imported from `react-leaflet-cluster`. This is crucial to prevent the map from freezing when hundreds of tickets are loaded.
6. **TicketDetailPane.jsx Update:**
    - If a ticket has `reported_lat` and `reported_lng`, display the `LocationPreviewMap` component.
    - Add an anchor tag button: `<a href={\`https://maps.google.com/?q=${ticket.reported_lat},${ticket.reported_lng}\`} target="_blank" rel="noopener noreferrer">View on Google Maps</a>`.
7. **Constraints:** DO NOT alter the existing `navigator.geolocation` logic in `ReportaProblem.jsx`. Ensure all new UI elements follow the existing modular scaling CSS variables."

---

## 5. Conclusion
This plan is **100% non-destructive**. It requires zero database changes, leaves the existing GPS logic completely untouched, and reuses the existing `react-leaflet` library to prevent new dependency bloat. By adding the "Map Pin" fallback, ALECO will capture precise data for nearly all future tickets, making the dashboard maps highly accurate and actionable for linemen.