require('dotenv').config(); // Load environment variables
const ADMIN_NUMBER = process.env.ADMIN_NUMBER; // Load Admin Number from .env

async function sendBroadcastMessage(conn, users, message) {
    if (!conn) {
        console.log('❌ Connection not available. Cannot send broadcast.');
        return;
    }

    console.log(`📤 Starting broadcast to ${Object.keys(users).length} users...`);
    let successCount = 0;
    let failedCount = 0;

    for (const user in users) {
        console.log(`📩 Sending broadcast to ${user}...`);
        try {
            await conn.sendMessage(user, { text: `📢 *Message daripada Admin:*\n\n${message}` });
            successCount++;
            console.log(`✅ Broadcast sent to ${user}`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Delay to avoid spam detection
        } catch (error) {
            console.error(`❌ Failed to send broadcast to ${user}:`, error);
            failedCount++;
        }
    }

    console.log(`📤 Broadcast completed: ${successCount} successful, ${failedCount} failed`);
    
    // Notify the admin about the broadcast result
    await conn.sendMessage(ADMIN_NUMBER, {
        text: `✅ Broadcast completed!\n\n` +
              `📩 *Sent to:* ${successCount} users\n` +
              `❌ *Failed to send to:* ${failedCount} users`
    });
}

module.exports = { sendBroadcastMessage };
