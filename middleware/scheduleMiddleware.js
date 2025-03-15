const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { sendMessagesWithDelay } = require('./messageMiddleware'); // Import message sending function

async function scheduleWakeUpMessage(sender, hour, minute, conn, activeWakeUps, scheduledJobs, pendingTimeouts, pesan) {
    try {
        const job = cron.schedule(`${minute} ${hour} * * *`, async () => {
            if (!conn) {
                console.error("❌ Connection is not established.");
                return;
            }

            activeWakeUps[sender] = true;
            pendingTimeouts[sender] = pendingTimeouts[sender] || []; // ✅ Ensure array exists

            // ✅ Check if pesan data exists before selecting messages
            if (!pesan.firstAttempt || !pesan.secondAttempt || !pesan.finalAttempt) {
                console.error("❌ 'pesan' data is missing or undefined.");
                return;
            }

            const getRandomMessages = (messageArray) => {
                if (!messageArray || messageArray.length < 1) return [];
                return [
                    messageArray[Math.floor(Math.random() * messageArray.length)],
                    messageArray[Math.floor(Math.random() * messageArray.length)],
                    messageArray[Math.floor(Math.random() * messageArray.length)]
                ];
            };

            // 📢 Send first attempt messages
            const randomPesanFirst = getRandomMessages(pesan.firstAttempt);
            await sendMessagesWithDelay(sender, randomPesanFirst, conn);

            // 🎵 Send first audio file
            await sendAudioMessage(sender, conn, 'sahur.mp3');

            // ⏳ Second Attempt after 3 minutes
            const secondAttemptTimeout = setTimeout(async () => {
                const randomPesanSecond = getRandomMessages(pesan.secondAttempt);
                await sendMessagesWithDelay(sender, randomPesanSecond, conn);
                await sendAudioMessage(sender, conn, 'sahur2.mp3');

                // ⏳ Final Attempt after another 5 minutes
                const lastAttemptTimeout = setTimeout(async () => {
                    const randomPesanLast = getRandomMessages(pesan.finalAttempt);
                    await sendMessagesWithDelay(sender, randomPesanLast, conn);
                }, 300000);

                pendingTimeouts[sender].push(lastAttemptTimeout);
            }, 300000);

            pendingTimeouts[sender].push(secondAttemptTimeout);
        }, { timezone: 'Asia/Kuala_Lumpur' });

        scheduledJobs[sender] = job;
    } catch (error) {
        console.error("❌ Error in scheduleWakeUpMessage:", error);
    }
}

// ✅ Function to send audio messages with error handling
async function sendAudioMessage(sender, conn, filename) {
    try {
        const audioPath = path.join(__dirname, '..', 'public', 'audio', filename);

        if (!fs.existsSync(audioPath)) {
            console.log(`❌ Audio file not found: ${audioPath}`);
            return;
        }

        const audioStream = fs.createReadStream(audioPath);
        console.log(`🎶 Sending audio file: ${audioPath}`);

        await conn.sendMessage(sender, {
            audio: { stream: audioStream },
            mimetype: 'audio/mpeg',
            ptt: true
        });

        console.log(`✅ Audio sent successfully`);
    } catch (error) {
        console.error(`❌ Error sending audio:`, error);
    }
}

module.exports = { scheduleWakeUpMessage };
