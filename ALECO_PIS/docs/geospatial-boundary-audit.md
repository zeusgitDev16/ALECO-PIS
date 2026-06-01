# Geospatial Boundary Audit - ALECO Service Area

## Purpose
Audit the current location validation system and identify gaps in preventing non-ALECO area reports. The system is designed for Albay residents only, but lacks geospatial boundary validation.

## Current System Behavior

### Location Validation (tickets.js)

**Current Validation Logic:**
```javascript
const ALECO_DISTRICT_MAP = {
    "First District (North Albay)": [
        "Bacacay", "Malilipot", "Malinao", "Santo Domingo", "Tabaco City", "Tiwi"
    ],
    "Second District (Central Albay)": [
        "Camalig", "Daraga", "Legazpi City", "Manito", "Rapu-Rapu"
    ],
    "Third District (South Albay)": [
        "Guinobatan", "Jovellar", "Libon", "Ligao City", "Oas", "Pio Duran", "Polangui"
    ]
};

const validateDistrictMunicipality = (district, municipality) => {
    if (!district || !municipality) return false;
    const validMunicipalities = ALECO_DISTRICT_MAP[district];
    if (!validMunicipalities) return false;
    return validMunicipalities.includes(municipality);
};
```

**What This Validates:**
- District-municipality relationship within Albay
- Ensures selected municipality belongs to selected district
- Only validates dropdown selections

**What This DOES NOT Validate:**
- GPS coordinates against Albay province boundaries
- GPS coordinates against selected municipality boundaries
- Whether the user is physically in Albay
- Whether GPS coordinates match the selected municipality

---

## Scenario 1: Manila User Reports with GPS Coordinates

**Real-World Scenario:**
- User from Manila (outside ALECO service area) accesses the public report form
- User's browser auto-detects GPS location (Manila coordinates: ~14.6°N, 121.0°E)
- User selects Albay municipality from dropdown (e.g., "Legazpi City")
- User submits ticket with Manila GPS but Albay municipality

**Frontend Flow:**
1. User visits public report form
2. Browser requests GPS permission
3. GPS returns Manila coordinates (14.6°N, 121.0°E)
4. User selects "Legazpi City" from municipality dropdown
5. User submits ticket

**Backend Flow (tickets.js POST /api/tickets/submit):**
1. Receives: reported_lat=14.6, reported_lng=121.0, municipality="Legazpi City", district="Second District (Central Albay)"
2. Validates district-municipality relationship: ✅ PASS (Legazpi City is in Second District)
3. **NO GPS coordinate validation against Albay boundaries**
4. Stores ticket with Manila GPS coordinates
5. Ticket created successfully

**Result:**
- Ticket created with inconsistent location data
- GPS shows Manila, but municipality shows Legazpi City
- Dispatcher sees confusing data on map
- Crew dispatched to wrong location (Legazpi City) based on municipality
- GPS coordinates point to Manila (useless for navigation)

**Current Issues:**
- 🔴 **CRITICAL BUG**: No GPS coordinate validation against Albay province boundaries
- 🔴 **CRITICAL BUG**: No GPS coordinate validation against selected municipality boundaries
- 🔴 **CRITICAL BUG**: Can create tickets with GPS coordinates outside service area
- 🔴 **CRITICAL BUG**: Inconsistent location data (GPS ≠ municipality)
- ⚠️ **BUG**: No warning to user that GPS location doesn't match selected municipality
- ⚠️ **BUG**: No distance calculation between GPS and municipality center

---

## Scenario 2: Manila User Reports Without GPS (Manual Location)

**Real-World Scenario:**
- User from Manila accesses public report form
- User denies GPS permission or browser doesn't support GPS
- User manually selects Albay municipality from dropdown
- User submits ticket with no GPS coordinates

**Frontend Flow:**
1. User visits public report form
2. Browser requests GPS permission
3. User denies permission or GPS not available
4. User selects "Legazpi City" from municipality dropdown
5. User submits ticket

**Backend Flow:**
1. Receives: reported_lat=NULL, reported_lng=NULL, municipality="Legazpi City"
2. Validates district-municipality relationship: ✅ PASS
3. **No way to verify user is actually in Legazpi City**
4. Stores ticket with no GPS coordinates
5. Ticket created successfully

**Result:**
- Ticket created with no location verification
- User could be anywhere (Manila, Cebu, etc.)
- System has no way to detect fraud
- Dispatcher must rely on address field only

**Current Issues:**
- 🔴 **CRITICAL BUG**: No way to verify user's actual location without GPS
- 🔴 **CRITICAL BUG**: No IP-based location validation as fallback
- 🔴 **CRITICAL BUG**: Manual location selection allows anyone to report for any municipality
- ⚠️ **BUG**: No warning that location could not be verified
- ⚠️ **BUG**: No flag for "location unverified" tickets

---

## Scenario 3: Albay User Reports with GPS Outside Selected Municipality

**Real-World Scenario:**
- User is in Albay but in wrong municipality
- User is in Daraga but selects "Legazpi City" (mistake or confusion)
- GPS shows Daraga coordinates, but dropdown shows Legazpi City

**Frontend Flow:**
1. User in Daraga accesses form
2. GPS returns Daraga coordinates (~13.15°N, 123.73°E)
3. User mistakenly selects "Legazpi City" from dropdown
4. User submits ticket

**Backend Flow:**
1. Receives: reported_lat=13.15, reported_lng=123.73, municipality="Legazpi City"
2. Validates district-municipality relationship: ✅ PASS
3. **No GPS-to-municipality boundary validation**
4. Stores ticket with Daraga GPS but Legazpi City municipality
5. Ticket created successfully

**Result:**
- Inconsistent location data within Albay
- Crew dispatched to Legazpi City based on municipality
- GPS points to Daraga (different location)
- Confusion for dispatcher and crew

**Current Issues:**
- 🔴 **CRITICAL BUG**: No GPS validation against selected municipality boundaries
- 🔴 **CRITICAL BUG**: No distance check between GPS and municipality center
- ⚠️ **BUG**: No warning to user that GPS doesn't match selected municipality
- ⚠️ **BUG**: No auto-correction suggestion based on GPS

---

## Scenario 4: GPS Coordinates Outside Philippines

**Real-World Scenario:**
- User outside Philippines (e.g., USA, Japan) accesses form
- GPS returns coordinates outside Philippines
- User selects Albay municipality from dropdown
- User submits ticket

**Backend Flow:**
1. Receives: reported_lat=35.6, reported_lng=139.7 (Tokyo), municipality="Legazpi City"
2. Validates district-municipality relationship: ✅ PASS
3. **No country-level validation**
4. Stores ticket with Tokyo coordinates
5. Ticket created successfully

**Result:**
- Ticket created with GPS coordinates in Tokyo
- Completely invalid location data
- Dispatcher sees Tokyo on map (confusing)
- System accepts clearly invalid data

**Current Issues:**
- 🔴 **CRITICAL BUG**: No country-level validation (Philippines only)
- 🔴 **CRITICAL BUG**: No bounding box validation for Philippines
- ⚠️ **BUG**: No validation that coordinates are reasonable for Philippines

---

## Proposed Solutions

### Solution 1: Albay Province Boundary Validation

**Approach:**
- Define Albay province boundary polygon (GeoJSON or coordinate bounds)
- Validate GPS coordinates against Albay boundary
- Reject coordinates outside Albay

**Implementation:**
```javascript
// Albay province bounding box (approximate)
const ALBAY_BOUNDS = {
    minLat: 12.8,
    maxLat: 13.8,
    minLng: 123.3,
    maxLng: 124.5
};

const validateAlbayBoundary = (lat, lng) => {
    if (!lat || !lng) return { valid: true, message: 'No GPS provided' }; // Allow manual entry
    if (lat < ALBAY_BOUNDS.minLat || lat > ALBAY_BOUNDS.maxLat) {
        return { valid: false, message: 'GPS coordinates are outside Albay province' };
    }
    if (lng < ALBAY_BOUNDS.minLng || lng > ALBAY_BOUNDS.maxLng) {
        return { valid: false, message: 'GPS coordinates are outside Albay province' };
    }
    return { valid: true, message: 'GPS within Albay' };
};
```

**Pros:**
- Simple to implement
- Catches most out-of-province reports
- Fast validation (bounding box)

**Cons:**
- Bounding box is approximate (may include nearby provinces)
- Doesn't validate against specific municipality

---

### Solution 2: Municipality Boundary Validation

**Approach:**
- Define boundary polygon for each municipality
- Validate GPS coordinates against selected municipality
- Warn or reject if GPS doesn't match municipality

**Implementation:**
```javascript
// Municipality center points (approximate)
const MUNICIPALITY_CENTERS = {
    "Legazpi City": { lat: 13.15, lng: 123.73, radius: 10 }, // 10km radius
    "Tabaco City": { lat: 13.35, lng: 123.73, radius: 10 },
    "Ligao City": { lat: 13.23, lng: 123.53, radius: 10 },
    // ... other municipalities
};

const validateMunicipalityBoundary = (lat, lng, municipality) => {
    if (!lat || !lng) return { valid: true, message: 'No GPS provided' };
    const center = MUNICIPALITY_CENTERS[municipality];
    if (!center) return { valid: true, message: 'Municipality not in database' };
    
    const distance = calculateDistance(lat, lng, center.lat, center.lng);
    if (distance > center.radius) {
        return { 
            valid: false, 
            message: `GPS is ${Math.round(distance)}km from ${municipality} center. Please verify your location.`,
            suggestedMunicipality: findNearestMunicipality(lat, lng)
        };
    }
    return { valid: true, message: 'GPS within municipality' };
};
```

**Pros:**
- More accurate validation
- Can suggest correct municipality
- Catches mistakes within Albay

**Cons:**
- Requires municipality boundary data
- More complex implementation
- Radius-based (not exact boundary)

---

### Solution 3: IP-Based Location Validation (Fallback)

**Approach:**
- Use IP geolocation as fallback when GPS not available
- Validate IP is within Philippines/Albay
- Flag tickets with unverified location

**Implementation:**
```javascript
const validateIPLocation = async (ip) => {
    // Use IP geolocation service (e.g., ip-api.com, maxmind)
    const location = await getIPLocation(ip);
    if (location.country !== 'PH') {
        return { valid: false, message: 'IP address is outside Philippines' };
    }
    if (location.region !== 'Albay') {
        return { valid: false, message: 'IP address is outside Albay province' };
    }
    return { valid: true, message: 'IP within Albay' };
};
```

**Pros:**
- Provides fallback when GPS unavailable
- Catches VPN/proxy users
- Additional layer of validation

**Cons:**
- IP geolocation not always accurate
- Requires external API
- Privacy concerns

---

### Solution 4: Frontend Map Boundary Visualization

**Approach:**
- Display Albay province boundary on map
- Show municipality boundaries
- Warn user if they pin location outside boundary
- Prevent pinning outside boundary

**Implementation:**
- Use Google Maps or Leaflet with GeoJSON overlay
- Add Albay boundary polygon to map
- Restrict marker placement to within boundary
- Show warning if user tries to pin outside

**Pros:**
- Visual feedback to user
- Prevents incorrect pinning
- Better UX

**Cons:**
- Requires map library integration
- More complex frontend
- May need GeoJSON data

---

### Solution 5: Multi-Layer Validation (Recommended)

**Approach:**
- Combine multiple validation methods
- Albay boundary validation (GPS)
- Municipality boundary validation (GPS)
- IP-based validation (fallback)
- Frontend map boundary visualization
- Graded warnings (error vs warning)

**Validation Flow:**
1. **Frontend:**
   - Show Albay boundary on map
   - Restrict pinning to within Albay
   - Warn if GPS doesn't match selected municipality
   - Suggest correct municipality based on GPS

2. **Backend:**
   - Validate GPS against Albay bounds (reject if outside)
   - Validate GPS against selected municipality (warn if mismatch)
   - Validate IP location if GPS unavailable (flag if outside)
   - Set location_verified flag based on validation

**Status Effects:**
- Tickets with valid GPS: location_verified = 'gps_verified'
- Tickets with GPS mismatch: location_verified = 'gps_mismatch' (warning)
- Tickets with no GPS: location_verified = 'ip_verified' or 'unverified'
- Tickets with invalid GPS: Rejected

---

## Database Changes Needed

```sql
-- Add location verification fields
ALTER TABLE aleco_tickets ADD COLUMN location_verified ENUM('gps_verified', 'gps_mismatch', 'ip_verified', 'unverified', 'invalid') DEFAULT 'unverified';
ALTER TABLE aleco_tickets ADD COLUMN location_verification_details TEXT;
ALTER TABLE aleco_tickets ADD COLUMN ip_address VARCHAR(45); -- IPv6 compatible
ALTER TABLE aleco_tickets ADD COLUMN ip_location_country VARCHAR(2);
ALTER TABLE aleco_tickets ADD COLUMN ip_location_region VARCHAR(100);
ALTER TABLE aleco_tickets ADD COLUMN distance_to_municipality_center DECIMAL(10, 2); -- in km

-- Add indexes
ALTER TABLE aleco_tickets ADD INDEX idx_location_verified (location_verified);
ALTER TABLE aleco_tickets ADD INDEX idx_ip_address (ip_address);
```

---

## Priority Recommendations

**Immediate (Critical):**
1. Add Albay province boundary validation (GPS coordinates)
2. Reject tickets with GPS coordinates outside Albay
3. Add location_verified field to track validation status

**Short-term (High):**
4. Add municipality boundary validation with distance check
5. Warn user if GPS doesn't match selected municipality
6. Suggest correct municipality based on GPS

**Medium-term:**
7. Add IP-based location validation as fallback
8. Frontend map boundary visualization
9. Display location verification status to dispatcher

**Long-term:**
10. Implement exact municipality boundary polygons (GeoJSON)
11. Add geospatial analytics (heat maps, coverage analysis)
12. Integrate with official government boundary data

---

## Testing Scenarios

**Test Case 1: Manila GPS with Albay Municipality**
- Input: GPS (14.6, 121.0), Municipality "Legazpi City"
- Expected: REJECT - GPS outside Albay bounds
- Current: ACCEPTS - BUG

**Test Case 2: Daraga GPS with Legazpi Municipality**
- Input: GPS (13.15, 123.73), Municipality "Legazpi City"
- Expected: WARN - GPS doesn't match municipality, suggest Daraga
- Current: ACCEPTS - BUG

**Test Case 3: Legazpi GPS with Legazpi Municipality**
- Input: GPS (13.15, 123.73), Municipality "Legazpi City"
- Expected: ACCEPT - GPS within municipality
- Current: ACCEPTS - OK

**Test Case 4: No GPS with Albay Municipality**
- Input: GPS NULL, Municipality "Legazpi City"
- Expected: ACCEPT with WARNING - location unverified, use IP validation
- Current: ACCEPTS - No warning

**Test Case 5: Tokyo GPS with Albay Municipality**
- Input: GPS (35.6, 139.7), Municipality "Legazpi City"
- Expected: REJECT - GPS outside Philippines
- Current: ACCEPTS - BUG
