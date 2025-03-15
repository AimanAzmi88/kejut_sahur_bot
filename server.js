const { useMultiFileAuthState, makeWASocket } = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');
require('dotenv').config();
const pesan = require('./pesan');
const { convertTo24HourFormat } = require('./middleware/timeMiddleware');
const { scheduleWakeUpMessage } = require('./middleware/scheduleMiddleware');
const { scheduleDailyBroadcast } = require('./middleware/dailyBroadcast');
const { sendBroadcastMessage } = require('./middleware/broadcastMiddleware');
const { saveWakeUpTimes, stopWakeUpAttempts, rescheduleWakeUpMessages, wakeUpTimes } = require('./middleware/wakeUpMiddleware');
const { fetchPrayerTimes } = require('./middleware/prayerTimeMiddleware');

const USERS_FILE = 'users.json';
const COMMENTS_FILE = 'comment.json';
const ADMIN_NUMBER = process.env.ADMIN_NUMBER;

// Ensure JSON files exist
if (!fs.existsSync(USERS_FILE) || fs.readFileSync(USERS_FILE, 'utf8').trim() === '') {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
}

if (!fs.existsSync(COMMENTS_FILE) || fs.readFileSync(COMMENTS_FILE, 'utf8').trim() === '') {
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify([], null, 2));
}

let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
let comments = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf8'));
let conn;
const activeWakeUps = {};
const scheduledJobs = {};
const pendingTimeouts = {};
const userContext = {};
const waitingForLocation = {};

// Save users to JSON
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Save comments to JSON
function saveComments() {
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));
}

// Ensure a user is registered
function ensureUser(sender) {
    if (sender !== ADMIN_NUMBER && !users[sender]) {
        users[sender] = {};
        saveUsers();
        console.log(`✅ New user added: ${sender}`);
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const logger = pino({ level: 'silent' });

    conn = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: logger
    });

    conn.ev.on('creds.update', saveCreds);
    conn.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
            console.log('✅ Connected to WhatsApp!');
            rescheduleWakeUpMessages(wakeUpTimes, conn, activeWakeUps, scheduledJobs, pendingTimeouts, pesan, convertTo24HourFormat, scheduleWakeUpMessage);
            scheduleDailyBroadcast(conn, users);
        }
        if (update.connection === 'close') {
            console.log('❌ Connection closed. Reconnecting...');
            startBot();
        }
    });

    conn.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message.key.fromMe) {
            const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').toLowerCase();
            const sender = message.key.remoteJid;

            ensureUser(sender);

            // 🟢 Handle admin broadcast command
            if (text === 'broadcast' && sender === ADMIN_NUMBER) {
                userContext[sender] = 'waitingForBroadcastMessage';
                await conn.sendMessage(sender, { text: '📢 Sila masukkan mesej yang ingin dihantar kepada semua pengguna.' });
                return;
            }

            // 🟢 Handle admin's broadcast message
            if (userContext[sender] === 'waitingForBroadcastMessage' && sender === ADMIN_NUMBER) {
                delete userContext[sender];
                const broadcastMessage = text.trim();

                if (!broadcastMessage) {
                    await conn.sendMessage(sender, { text: '❌ Mesej tidak boleh kosong. Sila hantar semula !broadcast.' });
                    return;
                }

                await sendBroadcastMessage(conn, users, broadcastMessage);
                return;
            }

            // 🟢 Handle admin request for users.json
            if (text === 'data' && sender === ADMIN_NUMBER) {
                const usersString = JSON.stringify(users, null, 2);
                await conn.sendMessage(sender, { text: `📂 *Users Data:*\n\n\`\`\`${usersString}\`\`\`` });
                return;
            }

            // 🟢 Handle location messages for prayer times
            if (waitingForLocation[sender] && message.message?.locationMessage) {
                delete waitingForLocation[sender];

                const lat = message.message.locationMessage.degreesLatitude;
                const long = message.message.locationMessage.degreesLongitude;

                const { prayerTimesText, error } = await fetchPrayerTimes(lat, long);

                if (error) {
                    await conn.sendMessage(sender, { text: '❌ Maaf, saya tak dapat cari waktu solat untuk lokasi ini.' });
                } else {
                    await conn.sendMessage(sender, { text: prayerTimesText });
                }
                return;
            }

            // 🟢 Handle comments (!komen <review>)
            if (text.startsWith('!komen ')) {
                const review = text.replace('!komen ', '').trim();
                if (review.length === 0) {
                    await conn.sendMessage(sender, { text: '❌ Komen tidak boleh kosong. Sila cuba lagi.' });
                    return;
                }

                // Save the comment
                const newComment = { sender, review, timestamp: new Date().toISOString() };
                comments.push(newComment);
                saveComments();

                await conn.sendMessage(sender, { text: '✅ Terima kasih atas komen anda! Kami sangat menghargainya. 😊' });

                // Forward the comment to the admin
                await conn.sendMessage(ADMIN_NUMBER, { 
                    text: `📩 *Komen baru diterima:*\n\n📌 *Pengguna:* ${sender}\n💬 *Komen:* ${review}` 
                });
                return;
            }

            // 🟢 Handle greeting messages
            if (text.includes('hye') || text.includes('hi') || text.includes('hello') || text.includes('awak') || text.includes('hai')) {
                const greeting = pesan.greetingsResponses[Math.floor(Math.random() * pesan.greetingsResponses.length)];
                const followUp = pesan.followUpResponses[Math.floor(Math.random() * pesan.followUpResponses.length)];
                const stopMsg = pesan.stopReminder[Math.floor(Math.random() * pesan.stopReminder.length)];

                await conn.sendMessage(sender, { text: greeting });
                await new Promise(resolve => setTimeout(resolve, 1000));
                await conn.sendMessage(sender, { text: followUp });
                await new Promise(resolve => setTimeout(resolve, 1000));
                await conn.sendMessage(sender, { text: stopMsg });

                userContext[sender] = 'waitingForChoice';
                return;
            }

            // 🟢 Handle stop command
            if (text === '!stop') {
                delete users[sender];
                saveUsers();
                if (wakeUpTimes[sender]) {
                    delete wakeUpTimes[sender];
                    saveWakeUpTimes();
                }
                await conn.sendMessage(sender, { text: '🥺 Sehingga kita berjumpa lagi' });
                await conn.sendMessage(sender, { text: 'Kalau awak perlukan, saya sentiasa ada 😉' });
                await conn.sendMessage(sender, { text: 'Type "Hai" je tau 😊' });
                return;
            }
        }
    });
}

startBot();
