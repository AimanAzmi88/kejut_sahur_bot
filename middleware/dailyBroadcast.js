const schedule = require('node-schedule');
const { getTodayQuote } = require('../pesan');
const fs = require('fs');

// Function to send daily Good Morning messages
function scheduleDailyBroadcast(conn, users) {
    // Schedule at 8:00 AM Malaysia/Kuala Lumpur time (UTC+8)
    const job = schedule.scheduleJob({ hour: 8, minute: 0, tz: 'Asia/Kuala_Lumpur' }, async function () {
        if (!conn) {
            console.log('❌ Connection not available. Cannot send daily broadcast.');
            return;
        }

        console.log(`🌅 Sending Good Morning messages to ${Object.keys(users).length} users...`);
        
        let successCount = 0;
        let failedCount = 0;
        
        try {
            // Get the daily quote
            const quote = await getTodayQuote(); // 🔥 Ensure this is awaited if it's async
            
            for (const user in users) {
                console.log(`📩 Sending "Good Morning" to ${user}...`);
                try {
                    await conn.sendMessage(user, { text: `🌞 *Selamat Pagi Awak* \n\n${quote}` });
                    successCount++;
                    console.log(`✅ Sent to ${user}`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay to prevent spam detection
                } catch (error) {
                    console.error(`❌ Failed to send to ${user}:`, error);
                    failedCount++;
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to get daily quote:', error);
        }

        console.log(`📤 Daily Broadcast completed: ${successCount} successful, ${failedCount} failed`);
    });

    console.log('✅ Daily Good Morning message scheduled at 8 AM Malaysia/Kuala Lumpur time.');
}

module.exports = { scheduleDailyBroadcast };
