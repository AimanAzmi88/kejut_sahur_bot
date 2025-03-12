const cron = require('node-cron');
const { sendMessagesWithDelay } = require('./messageMiddleware'); // Import message sending function

function scheduleWakeUpMessage(sender, hour, minute, conn, activeWakeUps, scheduledJobs, pendingTimeouts, pesan) {
    const job = cron.schedule(`${minute} ${hour} * * *`, async () => {
        if (!conn) return;

        activeWakeUps[sender] = true;

        const randomPesanFirst = [
            pesan.firstAttempt[Math.floor(Math.random() * pesan.firstAttempt.length)],
            pesan.firstAttempt[Math.floor(Math.random() * pesan.firstAttempt.length)],
            pesan.firstAttempt[Math.floor(Math.random() * pesan.firstAttempt.length)]
        ];
        await sendMessagesWithDelay(sender, randomPesanFirst, conn);

        const secondAttemptTimeout = setTimeout(async () => {
            const randomPesanSecond = [
                pesan.secondAttempt[Math.floor(Math.random() * pesan.secondAttempt.length)],
                pesan.secondAttempt[Math.floor(Math.random() * pesan.secondAttempt.length)],
                pesan.secondAttempt[Math.floor(Math.random() * pesan.secondAttempt.length)]
            ];
            await sendMessagesWithDelay(sender, randomPesanSecond, conn);

            const lastAttemptTimeout = setTimeout(async () => {
                const randomPesanLast = [
                    pesan.finalAttempt[Math.floor(Math.random() * pesan.finalAttempt.length)],
                    pesan.finalAttempt[Math.floor(Math.random() * pesan.finalAttempt.length)],
                    pesan.finalAttempt[Math.floor(Math.random() * pesan.finalAttempt.length)]
                ];
                await sendMessagesWithDelay(sender, randomPesanLast, conn);
            }, 180000);

            pendingTimeouts[sender].push(lastAttemptTimeout);
        }, 180000);

        pendingTimeouts[sender] = pendingTimeouts[sender] || [];
        pendingTimeouts[sender].push(secondAttemptTimeout);
    }, { timezone: 'Asia/Kuala_Lumpur' });

    scheduledJobs[sender] = job;
}

module.exports = { scheduleWakeUpMessage };