import axios from 'axios';
import { normalizePhoneForSMS } from './phoneUtils.js';

export const sendPhilSMS = async (number, messageBody) => {
    const formattedNumber = normalizePhoneForSMS(number);
    if (!formattedNumber) {
        console.error(`❌ PhilSMS: Invalid phone number "${number}" - skipping send`);
        return false;
    }

    try {
        const baseUrl = process.env.PHILSMS_API_URL || 'https://app.philsms.com';
        const url = `${baseUrl}/api/v3/sms/send`;
        const payload = {
            recipient: formattedNumber,
            message: messageBody,
            sender_id: process.env.PHILSMS_SENDER_ID || 'PhilSMS',
            type: 'plain'
        };
        const apiKey = (process.env.PHILSMS_API_KEY || '').trim();
        if (!apiKey) {
            console.error('❌ PhilSMS: PHILSMS_API_KEY is not set in .env');
            return false;
        }
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        if (response.data.status === 'success') {
            console.log(`✅ PhilSMS Success! Message sent to ${formattedNumber}`);
            return true;
        }
        console.warn(`⚠️ PhilSMS: Unexpected response`, response.data);
        return false;
    } catch (error) {
        console.error(`❌ PhilSMS Error:`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        return false;
    }
};
