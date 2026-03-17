import axios from 'axios';
import { normalizePhoneForSMS } from './phoneUtils.js';

export const sendPhilSMS = async (number, messageBody) => {
    const formattedNumber = normalizePhoneForSMS(number);
    if (!formattedNumber) {
        console.error(`❌ PhilSMS: Invalid phone number "${number}" - skipping send`);
        return false;
    }

    try {
        const url = 'https://app.philsms.com/api/v3/sms/send';
        const payload = {
            recipient: formattedNumber,
            message: messageBody,
            sender_id: process.env.PHILSMS_SENDER_ID || 'PhilSMS',
            type: 'plain'
        };
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.PHILSMS_API_KEY}`,
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
