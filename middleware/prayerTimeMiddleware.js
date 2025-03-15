const axios = require('axios');

async function fetchPrayerTimes(lat, long) {
    try {
        const zoneResponse = await axios.get(`https://api.waktusolat.app/zones/gps?lat=${lat}&long=${long}`);
        const { district } = zoneResponse.data;

        const prayerResponse = await axios.get(`https://api.waktusolat.app/v2/solat/gps/${lat}/${long}`);
        const { prayers } = prayerResponse.data;

        const today = new Date();
        const todayDay = today.getDate();
        const todayPrayer = prayers.find(prayer => prayer.day === todayDay);

        if (!todayPrayer) return { error: 'Prayer times not found for today' };

        const formatTime = (timestamp) => {
            const date = new Date(timestamp * 1000);
            return date.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
        };

        return { prayerTimesText: `
        🌟 *Assalamualaikum! Waktu Solat Dah Sampai!* 🌟
        📍 *Lokasi:* 🏡 ${district}
        📅 *Tarikh Hari Ini:* ${today.toLocaleDateString('ms-MY')}
        🗓️ *Tarikh Hijrah:* ${todayPrayer.hijri}
        🕌 *Waktu Solat Hari Ini* ⏳:
        ━━━━━━━━━━━━━━━
        🕋 *Subuh:*  ${formatTime(todayPrayer.fajr)}
        🌅 *Syuruk:*  ${formatTime(todayPrayer.syuruk)}
        🕌 *Zuhur:*  ${formatTime(todayPrayer.dhuhr)}
        🌇 *Asar:*  ${formatTime(todayPrayer.asr)}
        🌙 *Maghrib:*  ${formatTime(todayPrayer.maghrib)}
        🌌 *Isyak:*  ${formatTime(todayPrayer.isha)}
        ━━━━━━━━━━━━━━━
        🤲🏻 *Jangan lupa solat ya!* 😊
        ` };

    } catch (error) {
        console.error('❌ Error fetching prayer times:', error);
        return { error: 'Failed to fetch prayer times' };
    }
}

module.exports = { fetchPrayerTimes };
