const fs = require('fs');

const WAKEUP_FILE = 'wake_up_times.json';

// Load wake-up times from file if it exists
let wakeUpTimes = fs.existsSync(WAKEUP_FILE) ? JSON.parse(fs.readFileSync(WAKEUP_FILE, 'utf8')) : {};

function saveWakeUpTimes() {
    fs.writeFileSync(WAKEUP_FILE, JSON.stringify(wakeUpTimes, null, 2));
}

function stopWakeUpAttempts(sender, scheduledJobs, pendingTimeouts, activeWakeUps) {
    if (scheduledJobs[sender]) {
        scheduledJobs[sender].stop();
        delete scheduledJobs[sender];
    }

    if (pendingTimeouts[sender]) {
        for (const timeout of pendingTimeouts[sender]) {
            clearTimeout(timeout);
        }
        delete pendingTimeouts[sender];
    }

    delete activeWakeUps[sender]; // ✅ Completely remove active wake-ups
}

function rescheduleWakeUpMessages(wakeUpTimes, conn, activeWakeUps, scheduledJobs, pendingTimeouts, pesan, convertTo24HourFormat, scheduleWakeUpMessage) {
    for (const sender in wakeUpTimes) {
        const time = convertTo24HourFormat(wakeUpTimes[sender]);
        if (time.valid) {
            scheduleWakeUpMessage(sender, time.hour24, time.minute, conn, activeWakeUps, scheduledJobs, pendingTimeouts, pesan);
        }
    }
}

module.exports = { saveWakeUpTimes, stopWakeUpAttempts, rescheduleWakeUpMessages, wakeUpTimes };
