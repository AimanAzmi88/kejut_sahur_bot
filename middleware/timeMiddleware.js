function convertTo24HourFormat(time12h) {
    const match = time12h.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return { valid: false };

    let hour = parseInt(match[1]);
    const minute = parseInt(match[2]);

    // Ensure hour is in 24-hour format
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return { valid: false };
    }

    return {
        valid: true,
        hour24: hour,
        minute,
        formattedTime: `${hour}:${minute.toString().padStart(2, '0')}`
    };
}

module.exports = { convertTo24HourFormat };