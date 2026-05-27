import pool from '../config/db.js';

// Default SMS templates
const DEFAULT_TEMPLATES = {
  lineman: `Hi crew/linemen {crew_name} this is your assigned ticket:

{ticket_id}
name of consumer: {consumer_name}
address: {address}
concern: {concern}
action desired: {action_desired}
phone number: {phone}

keep safe!`,
  
  consumer_dispatch: `Good day! This is ALECO. Your ticket {ticket_id} is now under dispatch. Our service crew/linemen are scheduled to arrive at your location to address your concern. Please stay available for coordination, and you may track updates using your ticket ID.

You can enter this ticket to track:
{ticket_id}`,
  
  consumer: `Good day! This is ALECO. Your ticket {ticket_id} has been endorsed for concern resolution and is now in progress. Our support team is reviewing your concern and will provide updates accordingly. Thank you for your patience and cooperation.`,
  
  consumer_group: `Greetings! This is from ALECO! Your ticket {ticket_id} is currently grouped. Master ticket id is {main_ticket_id} and is now being processed. Please be in touch or visit our website to track your ticket and for follow ups.

You can enter these tickets to track:
{ticket_id}
{main_ticket_id}`
};

// Default char limits
const DEFAULT_CHAR_LIMITS = {
  concern: 60,
  action: 120
};

// Default field inclusion flags (all true by default)
const DEFAULT_FIELD_FLAGS = {
  ticket_id: true,
  crew_name: true,
  consumer_name: true,
  address: true,
  concern: true,
  action_desired: true,
  phone: true
};

/**
 * Fetch SMS settings from database
 */
async function fetchSmsSettings() {
  try {
    const [rows] = await pool.execute(
      'SELECT setting_key, setting_value FROM aleco_site_settings WHERE setting_key LIKE ?',
      ['sms_%']
    );
    const settings = {};
    rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    return settings;
  } catch (error) {
    console.error('[smsTemplate] Failed to fetch SMS settings:', error);
    return {};
  }
}

/**
 * Get SMS template with fallback to default
 */
async function getTemplate(type) {
  const settings = await fetchSmsSettings();
  const key = `sms_${type}_template`;
  return settings[key] || DEFAULT_TEMPLATES[type] || '';
}

/**
 * Get char limit for a field
 */
async function getCharLimit(field) {
  const settings = await fetchSmsSettings();
  const key = `sms_${field}_max_chars`;
  const value = settings[key];
  return value ? parseInt(value, 10) : DEFAULT_CHAR_LIMITS[field] || null;
}

/**
 * Get field inclusion flag
 */
async function getFieldFlag(field) {
  const settings = await fetchSmsSettings();
  const key = `sms_include_${field}`;
  const value = settings[key];
  return value === 'false' ? false : DEFAULT_FIELD_FLAGS[field] !== false;
}

/**
 * Truncate text to max length
 */
function truncateText(text, maxLength) {
  if (!text || !maxLength) return text;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

/**
 * Render SMS template with placeholders
 */
async function renderTemplate(template, data) {
  let rendered = template;
  
  // Get field inclusion flags
  const includeTicketId = await getFieldFlag('ticket_id');
  const includeCrewName = await getFieldFlag('crew_name');
  const includeConsumerName = await getFieldFlag('consumer_name');
  const includeAddress = await getFieldFlag('address');
  const includeConcern = await getFieldFlag('concern');
  const includeActionDesired = await getFieldFlag('action_desired');
  const includePhone = await getFieldFlag('phone');
  
  // Get char limits
  const concernLimit = await getCharLimit('concern');
  const actionLimit = await getCharLimit('action');
  
  // Build replacement map based on inclusion flags
  const replacements = {
    '{ticket_id}': includeTicketId ? (data.ticket_id || 'N/A') : '',
    '{crew_name}': includeCrewName ? (data.crew_name || 'N/A') : '',
    '{consumer_name}': includeConsumerName ? (data.consumer_name || 'N/A') : '',
    '{address}': includeAddress ? (data.address || 'N/A') : '',
    '{concern}': includeConcern ? truncateText(data.concern || 'N/A', concernLimit) : '',
    '{action_desired}': includeActionDesired ? truncateText(data.action_desired || 'N/A', actionLimit) : '',
    '{phone}': includePhone ? (data.phone || 'N/A') : '',
    '{main_ticket_id}': data.main_ticket_id || 'N/A'
  };
  
  // Replace placeholders
  for (const [placeholder, value] of Object.entries(replacements)) {
    rendered = rendered.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return rendered;
}

/**
 * Render lineman SMS
 */
export async function renderLinemanSms(data) {
  const template = await getTemplate('lineman');
  return renderTemplate(template, data);
}

/**
 * Render consumer dispatch SMS
 */
export async function renderConsumerDispatchSms(data) {
  const template = await getTemplate('consumer_dispatch');
  return renderTemplate(template, data);
}

/**
 * Render consumer concern SMS
 */
export async function renderConsumerConcernSms(data) {
  const template = await getTemplate('consumer');
  return renderTemplate(template, data);
}

/**
 * Render consumer group SMS
 */
export async function renderConsumerGroupSms(data) {
  const template = await getTemplate('consumer_group');
  return renderTemplate(template, data);
}

/**
 * Get char limits for frontend validation
 */
export async function getSmsCharLimits() {
  const settings = await fetchSmsSettings();
  return {
    concern: settings.sms_concern_max_chars ? parseInt(settings.sms_concern_max_chars, 10) : DEFAULT_CHAR_LIMITS.concern,
    action: settings.sms_action_max_chars ? parseInt(settings.sms_action_max_chars, 10) : DEFAULT_CHAR_LIMITS.action
  };
}

/**
 * Get all SMS settings for frontend
 */
export async function getSmsSettings() {
  const settings = await fetchSmsSettings();
  return {
    templates: {
      lineman: settings.sms_lineman_template || DEFAULT_TEMPLATES.lineman,
      consumer_dispatch: settings.sms_consumer_dispatch_template || DEFAULT_TEMPLATES.consumer_dispatch,
      consumer_concern: settings.sms_consumer_template || DEFAULT_TEMPLATES.consumer,
      consumer_group: settings.sms_consumer_group_template || DEFAULT_TEMPLATES.consumer_group
    },
    charLimits: {
      concern: settings.sms_concern_max_chars ? parseInt(settings.sms_concern_max_chars, 10) : DEFAULT_CHAR_LIMITS.concern,
      action: settings.sms_action_max_chars ? parseInt(settings.sms_action_max_chars, 10) : DEFAULT_CHAR_LIMITS.action
    },
    fieldFlags: {
      ticket_id: settings.sms_include_ticket_id !== 'false',
      crew_name: settings.sms_include_crew_name !== 'false',
      consumer_name: settings.sms_include_consumer_name !== 'false',
      address: settings.sms_include_address !== 'false',
      concern: settings.sms_include_concern !== 'false',
      action_desired: settings.sms_include_action_desired !== 'false',
      phone: settings.sms_include_phone !== 'false'
    }
  };
}

/**
 * Reset SMS settings to defaults
 */
export async function resetSmsSettings() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Delete all SMS-related settings
    await conn.execute(
      "DELETE FROM aleco_site_settings WHERE setting_key LIKE 'sms_%'"
    );
    
    await conn.commit();
    return { success: true };
  } catch (error) {
    await conn.rollback();
    console.error('[smsTemplate] Failed to reset SMS settings:', error);
    throw error;
  } finally {
    conn.release();
  }
}
