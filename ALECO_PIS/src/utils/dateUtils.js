import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// We only need the UTC plugin to ensure it reads the database correctly
dayjs.extend(utc);

export const formatToPhilippineTime = (dateString) => {
    if (!dateString) return "Time unavailable";

    try {
        // 1. dayjs.utc(): Locks the raw string to UTC (2:29 AM)
        // 2. .add(8, 'hour'): Manually forces it forward by 8 hours (10:29 AM)
        // 3. .format(): Prints it out beautifully
        
        return dayjs.utc(dateString).add(8, 'hour').format('MMMM D, YYYY [at] h:mm A');
        
    } catch (error) {
        console.error("Day.js formatting error:", error);
        return "Time unavailable";
    }
};