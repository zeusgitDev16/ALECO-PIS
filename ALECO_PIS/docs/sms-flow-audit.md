# SMS Flow Audit - ALECO PIS System

## Purpose
Audit the SMS notification system, including outbound SMS (consumer/crew notifications) and inbound SMS (lineman status updates - now retired). Identify edge cases, bugs, and real-life scenarios.

## Current SMS Architecture

### SMS Provider: PhilSMS
- **API**: PhilSMS (https://dashboard.philsms.com/api/v3/sms/send)
- **Authentication**: Bearer token (PHILSMS_API_KEY)
- **Sender ID**: Configurable (PHILSMS_SENDER_ID, default: 'PhilSMS')
- **Phone Format**: 639XXXXXXXXX (12 digits, Philippines format)

### SMS Functions
- **sendPhilSMS()**: Main SMS sending function (backend/utils/sms.js)
- **normalizePhoneForSMS()**: Phone number normalization
- **renderLinemanSms()**: Template for crew dispatch SMS
- **renderConsumerDispatchSms()**: Template for consumer dispatch notification
- **renderConsumerConcernSms()**: Template for consumer status update

### SMS Triggers
1. **Ticket Creation**: Consumer receives SMS with ticket ID
2. **Ticket Dispatch**: Crew receives dispatch SMS, consumer optionally notified
3. **Status Change**: Consumer receives SMS when ticket moved to Ongoing

### Inbound SMS (RETIRED)
- **Status**: Retired as of recent update
- **Previous Function**: Linemen could send SMS keywords (fixed, unfixed, nofault, nores) to update ticket status
- **Current State**: Endpoint returns 200 OK but ignores all messages
- **Reason**: Status transitions now handled exclusively through admin UI

---

## Scenario 1: Consumer SMS on Ticket Creation

**Real-World Scenario:**
- Consumer submits ticket via public form
- System sends SMS confirmation with ticket ID
- Consumer receives SMS: "Your ticket ALECO-12345 has been received..."

**Backend Flow (tickets.js POST /api/tickets/submit):**
1. Ticket created in database
2. System calls `renderConsumerConcernSms({ ticket_id })`
3. System calls `sendPhilSMS(consumer_phone, message)`
4. PhilSMS API called with normalized phone number
5. SMS sent to consumer

**Current Issues:**
- 🔴 **CRITICAL BUG**: No retry mechanism if SMS fails
- 🔴 **CRITICAL BUG**: No SMS delivery status tracking
- 🔴 **CRITICAL BUG**: No indication in UI if SMS failed
- 🔴 **CRITICAL BUG**: Consumer may not receive ticket ID
- ⚠️ **BUG**: No manual resend option
- ⚠️ **BUG**: SMS failure doesn't block ticket creation (consumer doesn't know)
- ⚠️ **BUG**: No SMS sent if phone number invalid (silent failure)

**Edge Cases:**
- Consumer phone number invalid format
- Consumer phone number not in Philippines
- PhilSMS API down
- PhilSMS API key invalid
- Consumer phone number on DND (Do Not Disturb) list
- Consumer phone out of coverage
- Consumer phone turned off
- SMS exceeds character limit (PhilSMS may truncate)

**Real-Life Scenarios:**
1. **Consumer enters wrong phone number**: SMS sent to wrong person (privacy issue)
2. **Consumer enters landline**: SMS fails silently
3. **Consumer phone out of battery**: SMS not received
4. **Consumer in area with no signal**: SMS not received
5. **PhilSMS gateway down**: All SMS fail, no retry
6. **Consumer blocks SMS**: SMS not received, no indication
7. **Consumer changes phone number**: SMS sent to old number
8. **Duplicate submission**: Multiple SMS sent for same issue

---

## Scenario 2: Crew SMS on Ticket Dispatch

**Real-World Scenario:**
- Dispatcher dispatches ticket to crew
- System sends SMS to crew member
- Crew receives SMS: "You have been assigned to ticket ALECO-12345..."

**Backend Flow (tickets.js PUT /api/tickets/:ticketId/dispatch):**
1. Dispatcher selects crew and clicks dispatch
2. System calls `renderLinemanSms()` with ticket details
3. System calls `sendPhilSMS(lineman_phone, message)`
4. PhilSMS API called with crew phone number
5. SMS sent to crew

**Current Issues:**
- 🔴 **CRITICAL BUG**: No retry mechanism if SMS fails
- 🔴 **CRITICAL BUG**: No SMS delivery status tracking
- 🔴 **CRITICAL BUG**: Crew may not receive dispatch notification
- 🔴 **CRITICAL BUG**: No fallback notification method
- ⚠️ **BUG**: No manual resend option
- ⚠️ **BUG**: Dispatch succeeds even if SMS fails
- ⚠️ **BUG**: No indication to dispatcher that SMS failed
- ⚠️ **BUG**: Crew phone number may be invalid

**Edge Cases:**
- Crew phone number invalid
- Crew phone not in database
- Crew phone changed (not updated in system)
- Multiple crew members assigned (only one gets SMS)
- Crew member on leave (SMS sent but not actionable)
- Crew member phone out of coverage
- PhilSMS API down
- SMS exceeds character limit

**Real-Life Scenarios:**
1. **Crew phone number outdated**: SMS sent to old number, crew not notified
2. **Crew member on sick leave**: SMS sent but crew can't respond
3. **Crew phone lost/stolen**: SMS received by wrong person
4. **Crew in area with no signal**: SMS not received
5. **Multiple crews assigned**: Only primary crew gets SMS
6. **Crew changed after dispatch**: SMS sent to wrong crew
7. **Crew blocks SMS**: Not received, no indication
8. **Dispatch at night**: SMS wakes up crew member

---

## Scenario 3: Consumer SMS on Dispatch (Optional)

**Real-World Scenario:**
- Dispatcher dispatches ticket with "Notify Consumer" toggle ON
- System sends SMS to consumer about dispatch
- Consumer receives SMS: "Your ticket ALECO-12345 has been dispatched..."

**Backend Flow:**
1. Dispatcher enables "Notify Consumer" toggle
2. System calls `renderConsumerDispatchSms({ ticket_id })`
3. System calls `sendPhilSMS(consumer_phone, message)`
4. SMS sent to consumer

**Current Issues:**
- 🔴 **CRITICAL BUG**: No retry mechanism
- 🔴 **CRITICAL BUG**: No SMS delivery status tracking
- ⚠️ **BUG**: Toggle may be forgotten (consumer not notified)
- ⚠️ **BUG**: No default setting for toggle
- ⚠️ **BUG**: No notification to dispatcher if SMS fails

**Edge Cases:**
- Consumer phone invalid
- Consumer phone changed since ticket creation
- Consumer opted out of SMS
- Dispatch at night (consumer disturbed)
- Multiple dispatches (multiple SMS sent)

**Real-Life Scenarios:**
1. **Toggle left OFF**: Consumer not notified about dispatch
2. **Consumer phone changed**: SMS sent to old number
3. **Dispatch at 2 AM**: Consumer disturbed by SMS
4. **Multiple dispatches**: Consumer receives multiple SMS for same ticket
5. **Consumer blocked SMS**: Not received, no indication

---

## Scenario 4: Phone Number Normalization Issues

**Real-World Scenario:**
- Consumer enters phone number in various formats
- System normalizes to 639XXXXXXXXX format
- Some formats may not normalize correctly

**Current Normalization Logic (phoneUtils.js):**
```javascript
function normalizePhoneForDB(phone) {
    // Remove non-digits
    let digits = sanitizePhoneDigits(phone);
    
    // Remove international prefix 00
    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }
    
    // Convert to 63 format
    if (digits.startsWith('63') && digits.length === 12) {
        normalized = digits;
    } else if (digits.startsWith('0') && digits.length === 11) {
        normalized = '63' + digits.substring(1);
    } else if (digits.startsWith('9') && digits.length === 10) {
        normalized = '63' + digits;
    }
}
```

**Current Issues:**
- 🔴 **CRITICAL BUG**: No validation that phone is Philippines number
- 🔴 **CRITICAL BUG**: International numbers (non-Philippines) accepted
- 🔴 **CRITICAL BUG**: Invalid formats may return null (silent failure)
- ⚠️ **BUG**: No format hint to user
- ⚠️ **BUG**: No client-side validation before submission

**Edge Cases:**
- User enters: 09171234567 (valid)
- User enters: +639171234567 (valid)
- User enters: 639171234567 (valid)
- User enters: 9171234567 (valid)
- User enters: 00639171234567 (valid)
- User enters: 1234567890 (invalid - not Philippines)
- User enters: 614123456789 (invalid - Australia)
- User enters: abc123 (invalid - letters)
- User enters: 0917 (invalid - too short)
- User enters: 09171234567890 (invalid - too long)

**Real-Life Scenarios:**
1. **Tourist enters foreign number**: SMS sent to foreign number (wastes credits)
2. **User enters incomplete number**: SMS fails silently
3. **User enters landline**: SMS fails (PhilSMS may still try)
4. **User enters office number**: SMS sent to wrong person
5. **User enters area code only**: SMS fails

---

## Scenario 5: SMS Template Issues

**Real-World Scenario:**
- SMS templates may have issues
- Message too long
- Missing variables
- Incorrect information

**Current Templates (smsTemplate.js):**
- **Consumer Concern SMS**: Includes ticket ID, status
- **Consumer Dispatch SMS**: Includes ticket ID, crew info
- **Lineman SMS**: Includes ticket ID, location, consumer info

**Current Issues:**
- ⚠️ **BUG**: No character limit validation (PhilSMS may truncate)
- ⚠️ **BUG**: No template versioning
- ⚠️ **BUG**: No A/B testing for templates
- ⚠️ **BUG**: No multilingual support
- ⚠️ **BUG**: Variables may be null (e.g., crew name missing)

**Edge Cases:**
- Ticket ID missing (should not happen but possible)
- Crew name missing
- Consumer name missing
- Location missing
- Message exceeds 160 characters (PhilSMS may split or truncate)

**Real-Life Scenarios:**
1. **Message too long**: Truncated, consumer sees incomplete info
2. **Crew name missing**: SMS shows "You have been assigned to ticket ALECO-12345 by crew" (incomplete)
3. **Location missing**: SMS shows "Location: " (empty)
4. **Special characters in message**: May not render correctly
5. **Emoji in message**: May not display on older phones

---

## Scenario 6: PhilSMS API Failures

**Real-World Scenario:**
- PhilSMS API down
- API key invalid
- Rate limit exceeded
- Account out of credits

**Current Error Handling (sms.js):**
```javascript
try {
    const response = await axios.post(url, payload, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        }
    });
    if (response.data?.status === 'success') {
        return { success: true };
    }
    return { success: false, reason: 'unexpected_response' };
} catch (error) {
    return { success: false, reason: 'network_error' };
}
```

**Current Issues:**
- 🔴 **CRITICAL BUG**: No retry mechanism
- 🔴 **CRITICAL BUG**: No exponential backoff
- 🔴 **CRITICAL BUG**: No fallback SMS provider
- 🔴 **CRITICAL BUG**: No alert to admin on API failure
- ⚠️ **BUG**: Error logged but not actionable
- ⚠️ **BUG**: No queue for failed SMS

**Edge Cases:**
- API returns 401 Unauthorized (API key invalid)
- API returns 429 Too Many Requests (rate limit)
- API returns 500 Internal Server Error
- Network timeout
- DNS resolution failure
- SSL certificate error

**Real-Life Scenarios:**
1. **API key expired**: All SMS fail silently
2. **Account out of credits**: All SMS fail, no alert
3. **PhilSMS down**: All SMS fail, no retry
4. **Rate limit exceeded**: SMS fail during peak hours
5. **Network issue**: SMS fail temporarily

---

## Scenario 7: SMS Rate Limiting

**Real-World Scenario:**
- Multiple tickets created in short time
- System sends SMS for each
- PhilSMS may rate limit
- Some SMS fail

**Current Behavior:**
- No rate limiting on outbound SMS
- System sends SMS immediately for each ticket
- PhilSMS may have rate limits (unknown)

**Current Issues:**
- 🔴 **CRITICAL BUG**: No rate limiting on outbound SMS
- 🔴 **CRITICAL BUG**: May exceed PhilSMS rate limits
- ⚠️ **BUG**: No queue for SMS (throttling)
- ⚠️ **BUG**: No batching of SMS

**Edge Cases:**
- 100 tickets created in 1 minute
- Bulk dispatch of 50 tickets
- System sends 50 SMS in 1 second

**Real-Life Scenarios:**
1. **Bulk ticket creation**: SMS sent rapidly, may trigger rate limit
2. **Bulk dispatch**: Crew receives 50 SMS in 1 second (overwhelming)
3. **Peak hour**: PhilSMS rate limit exceeded

---

## Scenario 8: SMS Delivery Tracking

**Real-World Scenario:**
- SMS sent but delivery status unknown
- Did consumer receive it?
- Did crew receive it?
- No way to track

**Current Behavior:**
- No delivery status tracking
- No delivery receipts
- No way to know if SMS was delivered

**Current Issues:**
- 🔴 **CRITICAL BUG**: No SMS delivery status tracking
- 🔴 **CRITICAL BUG**: No delivery receipts from PhilSMS
- 🔴 **CRITICAL BUG**: No way to retry failed SMS
- ⚠️ **BUG**: No SMS sent/failed flag in database

**Proposed Solution:**
- Add sms_sent flag to tickets table
- Add sms_delivery_status field (pending, sent, delivered, failed)
- Add sms_delivery_timestamp
- Add sms_error_message
- Implement delivery receipt webhook (if PhilSMS supports)
- Add retry queue for failed SMS

---

## Scenario 9: Inbound SMS (Retired)

**Current State:**
- Inbound SMS webhook retired
- Linemen can no longer update status via SMS
- Endpoint returns 200 OK but ignores messages

**Previous Functionality (Retired):**
- Linemen could send SMS with keywords: fixed, unfixed, nofault, nores
- System would parse SMS and update ticket status
- Bulk updates: all fixed, all unfixed, etc.

**Why Retired:**
- Status transitions now handled through admin UI
- More control and audit trail
- Less error-prone

**Current Issues:**
- ⚠️ **BUG**: No indication to lineman that SMS is ignored
- ⚠️ **BUG**: Lineman may still try to use SMS (confusion)
- ⚠️ **BUG**: No feedback message sent back to lineman

**Proposed Solution:**
- Send feedback SMS: "SMS status updates are retired. Please use admin UI."
- Update lineman training materials
- Remove SMS keywords from documentation

---

## Scenario 10: SMS Security Issues

**Real-World Scenario:**
- SMS contains sensitive information
- SMS intercepted
- SMS sent to wrong number
- SMS spoofing

**Current Security:**
- SMS contains ticket ID (public info)
- SMS contains consumer name (may be sensitive)
- SMS contains location (may be sensitive)
- No encryption of SMS content

**Current Issues:**
- 🔴 **SECURITY**: SMS contains consumer name (privacy concern)
- 🔴 **SECURITY**: SMS contains location (privacy concern)
- 🔴 **SECURITY**: No SMS encryption
- 🔴 **SECURITY**: No verification of recipient
- ⚠️ **BUG**: No opt-out mechanism for consumers
- ⚠️ **BUG**: No consent for SMS

**Edge Cases:**
- SMS sent to wrong number (privacy breach)
- SMS intercepted (unlikely but possible)
- SMS spoofing (someone sends fake SMS from system)

**Real-Life Scenarios:**
1. **Wrong phone number entered**: SMS sent to wrong person (privacy breach)
2. **Phone number changed**: SMS sent to new owner of old number
3. **Shared phone**: Multiple people see SMS (privacy issue)
4. **SMS forwarded**: Consumer forwards SMS (may not be issue)

---

## Scenario 11: SMS Cost Management

**Real-World Scenario:**
- Each SMS costs money
- Need to track SMS usage
- Need to optimize SMS costs
- Need to prevent abuse

**Current Behavior:**
- No SMS cost tracking
- No SMS usage analytics
- No cost optimization
- No abuse prevention

**Current Issues:**
- 🔴 **MISSING FEATURE**: No SMS cost tracking
- 🔴 **MISSING FEATURE**: No SMS usage analytics
- 🔴 **MISSING FEATURE**: No cost optimization
- ⚠️ **BUG**: No limit on SMS per ticket
- ⚠️ **BUG**: No abuse detection (spam)

**Proposed Solution:**
- Add sms_cost field to track costs
- Add sms_count field to track usage
- Add daily/monthly SMS limits
- Add SMS analytics dashboard
- Implement SMS batching to reduce costs

---

## Scenario 12: SMS Opt-Out and Preferences

**Real-World Scenario:**
- Consumer doesn't want SMS notifications
- Consumer wants SMS only for certain events
- Consumer wants SMS at certain times only

**Current Behavior:**
- No opt-out mechanism
- No preference management
- All consumers receive SMS

**Current Issues:**
- 🔴 **MISSING FEATURE**: No opt-out mechanism
- 🔴 **MISSING FEATURE**: No SMS preferences
- 🔴 **MISSING FEATURE**: No time-based SMS scheduling
- ⚠️ **BUG**: May violate privacy regulations (no consent)

**Proposed Solution:**
- Add sms_opt_out field to tickets/consumers
- Add sms_preferences field (dispatch, status, resolution)
- Add sms_time_preference field (business hours only)
- Add consent management
- Add unsubscribe keyword (STOP)

---

## Scenario 13: SMS for Different Events

**Current SMS Events:**
1. Ticket creation (consumer)
2. Ticket dispatch (crew)
3. Ticket dispatch (consumer, optional)
4. Status change to Ongoing (consumer)

**Missing SMS Events:**
- 🔴 **MISSING**: Ticket resolved (consumer)
- 🔴 **MISSING**: Ticket unresolved (consumer)
- 🔴 **MISSING**: Ticket reassigned (crew)
- 🔴 **MISSING**: ETA update (consumer)
- 🔴 **MISSING**: Crew arrival notification (consumer)
- 🔴 **MISSING**: Follow-up reminder (crew)

**Proposed SMS Events:**
- Ticket resolved: "Your ticket ALECO-12345 has been resolved."
- Ticket unresolved: "Your ticket ALECO-12345 could not be resolved. We will follow up."
- Crew reassigned: "Ticket ALECO-12345 reassigned to new crew."
- ETA update: "Crew ETA for ticket ALECO-12345 updated to 2:00 PM."
- Crew arrival: "Crew has arrived for ticket ALECO-12345."
- Follow-up reminder: "Reminder: Follow up on ticket ALECO-12345."

---

## Scenario 14: SMS Localization

**Real-World Scenario:**
- Consumers may prefer local language (Bikol, Tagalog)
- Current SMS only in English
- Some consumers may not understand English

**Current Behavior:**
- All SMS in English
- No localization
- No language preference

**Current Issues:**
- 🔴 **MISSING FEATURE**: No SMS localization
- 🔴 **MISSING FEATURE**: No language preference
- ⚠️ **BUG**: Non-English speakers may not understand SMS

**Proposed Solution:**
- Add language preference field
- Create SMS templates in multiple languages (English, Tagalog, Bikol)
- Auto-detect language based on municipality
- Allow consumer to select language

---

## Scenario 15: SMS Template Management

**Current Behavior:**
- SMS templates hardcoded in code
- No admin interface to edit templates
- No template versioning
- No A/B testing

**Current Issues:**
- 🔴 **MISSING FEATURE**: No admin interface for templates
- 🔴 **MISSING FEATURE**: No template versioning
- 🔴 **MISSING FEATURE**: No A/B testing
- ⚠️ **BUG**: Requires code deployment to change templates

**Proposed Solution:**
- Add sms_templates table
- Add admin UI for template editing
- Add template versioning
- Add A/B testing capability
- Add template preview

---

## Scenario 16: SMS Queue and Retry

**Current Behavior:**
- SMS sent immediately (synchronous)
- No queue
- No retry
- No prioritization

**Current Issues:**
- 🔴 **CRITICAL BUG**: No retry mechanism
- 🔴 **CRITICAL BUG**: No queue for failed SMS
- 🔴 **CRITICAL BUG**: No prioritization (urgent vs normal)
- ⚠️ **BUG**: SMS failure blocks nothing (silent)

**Proposed Solution:**
- Add SMS queue (Redis or database)
- Add retry mechanism with exponential backoff
- Add priority levels (urgent, normal, low)
- Add dead letter queue for failed SMS
- Add retry limit (e.g., 3 attempts)

---

## Scenario 17: SMS Analytics and Reporting

**Current Behavior:**
- No SMS analytics
- No SMS reporting
- No delivery rate tracking
- No cost tracking

**Current Issues:**
- 🔴 **MISSING FEATURE**: No SMS analytics
- 🔴 **MISSING FEATURE**: No SMS reporting
- 🔴 **MISSING FEATURE**: No delivery rate tracking
- 🔴 **MISSING FEATURE**: No cost tracking

**Proposed Solution:**
- Add SMS analytics dashboard
- Track delivery rates
- Track costs
- Track failure reasons
- Generate SMS reports

---

## Summary of Critical Issues

**Critical Bugs (Must Fix):**
1. No retry mechanism for failed SMS
2. No SMS delivery status tracking
3. No indication in UI if SMS failed
4. No fallback notification method
5. No rate limiting on outbound SMS
6. No validation that phone is Philippines number
7. No SMS opt-out mechanism (privacy concern)
8. No consent for SMS (privacy concern)

**Missing Features (Should Add):**
1. SMS delivery status tracking
2. SMS retry queue
3. SMS opt-out mechanism
4. SMS preferences
5. SMS for more events (resolved, unresolved, etc.)
6. SMS localization
7. SMS template management
8. SMS analytics and reporting

**Medium Priority:**
1. Better error handling for PhilSMS failures
2. Admin alert on SMS API failure
3. SMS cost tracking
4. SMS A/B testing
5. SMS time-based scheduling

**Low Priority:**
1. SMS template versioning
2. SMS fallback provider
3. SMS encryption
4. SMS delivery receipts webhook
