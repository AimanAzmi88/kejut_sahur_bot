const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { sendMessagesWithDelay } = require('./messageMiddleware'); // Import message sending function

async function scheduleWakeUpMessage(sender, hour, minute, conn, activeWakeUps, scheduledJobs, pendingTimeouts, pesan) {
    const job = cron.schedule(`${minute} ${hour} * * *`, async () => {
        if (!conn) return;

        activeWakeUps[sender] = true;

        // Select 3 random messages from firstAttempt
        const randomPesanFirst = [
            pesan.firstAttempt[Math.floor(Math.random() * pesan.firstAttempt.length)],
            pesan.firstAttempt[Math.floor(Math.random() * pesan.firstAttempt.length)],
            pesan.firstAttempt[Math.floor(Math.random() * pesan.firstAttempt.length)]
        ];

        // 📢 Send the text messages
        await sendMessagesWithDelay(sender, randomPesanFirst, conn);

        // 🎵 Fix the audio file path
        try {
            const audioPath = path.join(__dirname, '..', 'public', 'audio', 'sahur.mp3');
        
            if (!fs.existsSync(audioPath)) {
                console.log(`❌ Audio file not found: ${audioPath}`);
                return;
            }
        
            const audioStream = fs.createReadStream(audioPath); // Use stream instead of buffer
        
            console.log(`🎶 Sending audio file: ${audioPath}`);
        
            await conn.sendMessage(sender, { 
                audio: { stream: audioStream }, // Use stream instead of buffer
                mimetype: 'audio/mpeg', 
                ptt: true 
            });
        
            console.log(`✅ Audio sent successfully`);
        } catch (error) {
            console.error(`❌ Error sending audio:`, error);
        }
        

        // ⏳ Second Attempt after 3 minutes (180000ms)
        const secondAttemptTimeout = setTimeout(async () => {
            const randomPesanSecond = [
                pesan.secondAttempt[Math.floor(Math.random() * pesan.secondAttempt.length)],
                pesan.secondAttempt[Math.floor(Math.random() * pesan.secondAttempt.length)],
                pesan.secondAttempt[Math.floor(Math.random() * pesan.secondAttempt.length)]
            ];
            await sendMessagesWithDelay(sender, randomPesanSecond, conn);
                    // 🎵 Fix the audio file path
        try {
            const audioPath = path.join(__dirname, '..', 'public', 'audio', 'sahur2.mp3');
        
            if (!fs.existsSync(audioPath)) {
                console.log(`❌ Audio file not found: ${audioPath}`);
                return;
            }
        
            const audioStream = fs.createReadStream(audioPath); // Use stream instead of buffer
        
            console.log(`🎶 Sending audio file: ${audioPath}`);
        
            await conn.sendMessage(sender, { 
                audio: { stream: audioStream }, // Use stream instead of buffer
                mimetype: 'audio/mpeg', 
                ptt: true 
            });
        
            console.log(`✅ Audio sent successfully`);
        } catch (error) {
            console.error(`❌ Error sending audio:`, error);
        }

            // ⏳ Final Attempt after another 3 minutes
            const lastAttemptTimeout = setTimeout(async () => {
                const randomPesanLast = [
                    pesan.finalAttempt[Math.floor(Math.random() * pesan.finalAttempt.length)],
                    pesan.finalAttempt[Math.floor(Math.random() * pesan.finalAttempt.length)],
                    pesan.finalAttempt[Math.floor(Math.random() * pesan.finalAttempt.length)]
                ];
                await sendMessagesWithDelay(sender, randomPesanLast, conn);
            }, 300000);

            pendingTimeouts[sender].push(lastAttemptTimeout);
        }, 300000);

        pendingTimeouts[sender] = pendingTimeouts[sender] || [];
        pendingTimeouts[sender].push(secondAttemptTimeout);
    }, { timezone: 'Asia/Kuala_Lumpur' });

    scheduledJobs[sender] = job;
}

module.exports = { scheduleWakeUpMessage };
