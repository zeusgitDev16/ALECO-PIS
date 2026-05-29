# ALECO PIS Presentation Scenarios

## Flow Type Scenarios

### 1. Consumer Reports a Problem
- Consumer visits public report form
- Fills in personal information (name, phone, address)
- Describes the problem (brownout, damaged post, etc.)
- System auto-detects GPS location
- Consumer submits ticket
- System generates ticket ID (e.g., ALECO-XXXXX)
- Consumer receives SMS confirmation with ticket ID

### 2. Consumer Submits Ticket Without Map Pin
- Consumer reports problem manually
- Skips GPS location detection
- Selects municipality and district from dropdown
- Submits ticket with municipality center as default location
- Ticket created with approximate location
- Dispatcher can see location needs refinement

### 3. Consumer Tracks Ticket Status
- Consumer enters ticket ID in track form
- System shows current status (Pending, Ongoing, Restored, etc.)
- Displays service memo status (if created)
- Shows assigned crew and ETA (if dispatched)
- Displays resolution notes (if resolved)
- Shows map location with Google Maps link

### 4. Dispatcher Reviews New Tickets
- Dispatcher logs into dashboard
- Sees new tickets in Ticket Pool
- Reviews ticket details and location on map
- Checks for similar incidents in same area
- Decides to dispatch or group with other tickets

### 5. Dispatcher Creates Service Memo
- Dispatcher clicks "Create Service Memo" on ticket
- System generates control number (e.g., ALECO-SM-0001)
- Dispatcher assigns crew from pool
- Sets estimated time of arrival
- Adds dispatch notes for crew
- Submits memo → ticket status changes to Ongoing

### 6. Crew Receives Dispatch
- Crew sees assigned tickets in dashboard
- Views location on map with GPS coordinates
- Reads dispatch notes and instructions
- Navigates to incident location
- Updates status upon arrival

### 7. Lineman Updates Status On-Site
- Lineman arrives at location
- Updates ticket status with remarks
- Adds photos of damage/repairs
- Marks ticket as Restored or Unresolved
- System sends SMS update to consumer

### 8. Group Incident Handling
- Multiple consumers report same issue
- System detects similar incidents in same area
- Dispatcher creates group ticket
- Single service memo covers all child tickets
- Crew dispatched once for entire group
- All child tickets resolved together

### 9. Service Memo Closure
- Crew completes repairs
- Dispatcher closes service memo
- Ticket status changes to Restored
- Consumer sees final status in track ticket
- System logs all changes in history

### 10. Consumer Shares Power Advisory Link
- Consumer views power interruption advisory
- Clicks share button
- System generates shareable link
- Consumer shares link via social media
- Others can view advisory with Open Graph tags

## Tech Type Scenarios

### 1. Concurrent Edit Protection
- User A opens ticket for editing
- User B tries to edit same ticket simultaneously
- System detects version mismatch
- User B receives "Ticket was modified by another user" error
- User B must refresh to see latest changes
- No data loss or overwrite occurs

### 2. Real-Time Dashboard Updates
- Dispatcher updates ticket status
- All dashboard users see change instantly
- No page refresh needed
- Socket.io pushes updates in real-time
- All users see synchronized state across browsers

### 3. Audit Trail Logging
- Every ticket change is logged
- System records who changed what and when
- History shows complete timeline of actions
- Admin can view full audit trail
- No action is untraceable

### 4. Public API Security
- Consumer tracks ticket via public API
- System returns only consumer-safe fields
- Internal IDs and sensitive data hidden
- Memo endpoint shows status but not control number
- Confidential data protected from public access

### 5. GPS Location Validation
- Consumer uses GPS to auto-detect location
- System validates against ALECO service area
- If outside Albay, system rejects location
- If municipality not in scope, system prompts manual selection
- Prevents invalid location submissions

### 6. Duplicate Detection
- Consumer submits ticket with phone number
- System checks for recent duplicates
- If duplicate found, shows warning
- Consumer can confirm or cancel submission
- Prevents spam and duplicate reports

### 7. SMS Notification System
- Ticket submitted → Consumer receives SMS with ticket ID
- Ticket dispatched → Consumer receives crew info
- Ticket resolved → Consumer receives status update
- System handles SMS delivery failures gracefully
- SMS content is configurable per environment

### 8. Database Connection Resilience
- Database connection temporarily fails
- Circuit breaker prevents cascading failures
- System returns 503 with clear error message
- Connection automatically retries when database recovers
- No data corruption during outage

### 9. Role-Based Access Control
- Admin users can access all features
- Employee users is prohibitted in history and manage site settings   only but other than that, they can also access the rest.
- Public users can only submit and track tickets
- Middleware enforces role permissions
- Unauthorized requests are blocked

### 10. CORS Configuration
- Frontend on Cloudflare Pages calls API
- Backend on Google Cloud VM
- CORS configured to allow specific origins
- Pre-flight requests handled correctly
- No CORS errors in production deployment

## Backend Mechanisms & Infrastructure

### 11. Database Heartbeat Monitoring
- System continuously monitors MySQL connection health
- Heartbeat checks run every 30 seconds
- Circuit breaker opens after 3 consecutive failures
- Prevents cascading failures when database is down
- Automatically recovers when database becomes available
- Returns 503 status with clear health check endpoint

### 12. Concurrency Control
- Every entity has `expected_updated_at` version field
- Updates check version before applying changes
- If version mismatch, update is rejected with error
- Prevents lost updates from concurrent edits
- User must refresh to see latest version
- Applied to tickets, service memos, and interruptions

### 13. Real-Time WebSocket Communication
- Socket.io server integrated with Express
- Broadcasts entity changes to all connected clients
- Dashboard updates instantly without page refresh
- Modules: tickets, service-memos, interruptions, b2b-mail
- Connection includes actor email for audit trail
- Automatic reconnection on network issues

### 14. Middleware Architecture
- `requireApiSession` - Session validation for protected routes
- `requireRole` - Role-based access control (admin/employee)
- `requireStaff` - Staff-only endpoints (admin + employee)
- Public route allowlist for consumer-facing features
- JWT token validation with version checking
- Legacy session header support for backward compatibility

### 15. Multi-Platform Deployment
- **Frontend**: Cloudflare Pages (global CDN, instant deployment)
- **Backend API**: Google Cloud e2-micro VM (Express server)
- **Poster Generation**: Cloud Run (Puppeteer for PDF/image generation)
- **Database**: Aiven MySQL free tier (managed MySQL service)
- **SMS Integration**: External SMS gateway API
- **File Storage**: Cloudinary (image uploads)

### 16. Job Queue System
- Heavy operations run asynchronously in background
- Ticket submission uses job queue for reliability
- Client polls job status every 2 seconds
- Jobs timeout after 2 minutes
- Prevents request timeouts on large operations
- Status tracking: pending, processing, completed, failed

### 17. Poster Worker Service
- Separate service for power interruption poster generation
- Uses Puppeteer on Cloud Run for headless browser
- Generates high-quality images for social media sharing
- Processes queue of poster generation requests
- Respects resource limits (1GB RAM constraint)
- Returns poster image URL for storage

### 18. Environment Configuration
- Separate configs for development and production
- Environment variables for sensitive data (API keys, DB credentials)
- CORS origins configurable per environment
- SMS templates customizable per deployment
- Feature flags for optional functionality
- Secure secret management

### 19. Error Handling & Logging
- Structured error responses with error codes
- Database timeout handling with 503 status
- Request validation with clear error messages
- Console logging for debugging (development)
- Production logging to monitoring service
- Graceful degradation on service failures

### 20. Performance Optimization
- Database connection pooling (max 10 connections)
- Query result caching where appropriate
- Lazy loading of large datasets
- Pagination for admin dashboard lists
- Image optimization via Cloudinary
- CDN delivery for static assets
