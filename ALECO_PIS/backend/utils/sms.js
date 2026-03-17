import axios from 'axios';

export const sendPhilSMS = async (number, messageBody) => {
    try {
        let formattedNumber = number.startsWith('0') ? '63' + number.substring(1) : number;
        const url = 'https://dashboard.philsms.com/api/v3/sms/send';
        const payload = {
            recipient: formattedNumber,
            message: messageBody,
            sender_id: process.env.PHILSMS_SENDER_ID || 'PhilSMS'
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
        return false;
    } catch (error) {
        console.error(`❌ PhilSMS Error:`, error.response?.data || error.message);
        return false;
    }
};
