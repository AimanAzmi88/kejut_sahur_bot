const { useMultiFileAuthState, makeWASocket } = require('@whiskeysockets/baileys');
const cron = require('node-cron');
const fs = require('fs');
const pino = require('pino');
const { v4: uuidv4 } = require('uuid');
const pesan = require('./pesan'); // Import messages

const WAKEUP_FILE = 'wake_up_times.json';
const USERS_FILE = 'users.json';
const ADMIN_NUMBER = '@s.whatsapp.net'; // Admin WhatsApp ID

if (!fs.existsSync(USERS_FILE) || fs.readFileSync(USERS_FILE, 'utf8').trim() === '') {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
}

let wakeUpTimes = fs.existsSync(WAKEUP_FILE) ? JSON.parse(fs.readFileSync(WAKEUP_FILE, 'utf8')) : {};
let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
let conn;
const activeWakeUps = {};
const scheduledJobs = {};
const pendingTimeouts = {};
const uuidRequests = {}; // Track users asked for UUID input

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function ensureUser(sender) {
    if (!users[sender]) {
        users[sender] = { cycles: 0, uuid: uuidv4(), unlocked: false };
        saveUsers();
        console.log(`✅ New user added: ${sender}, UUID: ${users[sender].uuid}`);
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
            rescheduleWakeUpMessages();
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

            if (sender === ADMIN_NUMBER && text === 'data') {
                const usersData = JSON.stringify(users, null, 2);
                await conn.sendMessage(sender, { text: `📂 *Users Data:*\n\`\`\`${usersData}\`\`\`` });
                return;
            }

            if (users[sender].cycles >= 3 && !users[sender].unlocked) {
                if (!uuidRequests[sender]) {
                    uuidRequests[sender] = true;
                    await conn.sendMessage(sender, { 
                        text: `🚀 Nak guna tanpa had? Jom support projek ni dengan buat *donation* kat *Sociobuzz*!  
                        💖 Berapa pun tak kisah, yang penting ikhlas!  
                        🔗 *Link:* https://sociabuzz.com/aimanazmi  
                    
                        📩 Dah donate? Hantar bukti derma kat sini, nanti saya bagi *key* untuk unlock penggunaan tanpa had! Terima kasih sebab support! 🙌`
                    });
                    
                    return;
                }
                if (text === users[sender].uuid) {
                    users[sender].unlocked = true;
                    saveUsers();
                    delete uuidRequests[sender];
                    await conn.sendMessage(sender, { text: '✅ Penggunaan tanpa had telah dibuka untuk anda! 🎉' });
                }
                return;
            }

            if (activeWakeUps[sender]) {
                stopWakeUpAttempts(sender);
                delete wakeUpTimes[sender];
                saveWakeUpTimes();

                users[sender].cycles += 1;
                saveUsers();

                const randomPesanOk = pesan.okResponse[Math.floor(Math.random() * pesan.okResponse.length)];
                await conn.sendMessage(sender, { text: randomPesanOk });

                delete activeWakeUps[sender]; // ✅ Ensure wake-ups are stopped
                return;
            }

            if (text.includes('hye') || text.includes('hello')) {
                await conn.sendMessage(sender, { text: 'Hye awak, mesti nak saya kejut sahur la tu. nak kejut pukul berapa? (e.g., 1:20 atau 5:00)' });
            } else if (/^\d{1,2}:\d{2}$/.test(text)) {
                const time = convertTo24HourFormat(text);
                if (!time.valid) {
                    await conn.sendMessage(sender, { text: '⚠️ Format salah! Contoh: 1:20 atau 5:00.' });
                    return;
                }

                wakeUpTimes[sender] = time.formattedTime;
                saveWakeUpTimes();
                await conn.sendMessage(sender, { text: `Ok awak, pukul ${time.formattedTime} nanti saya kejut! 💖` });
                scheduleWakeUpMessage(sender, time.hour24, time.minute);
            }
        }
    });
}

function convertTo24HourFormat(time12h) {
    const match = time12h.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return { valid: false };

    let hour = parseInt(match[1]);
    const minute = parseInt(match[2]);

    return {
        valid: true,
        hour24: hour,
        minute,
        formattedTime: `${match[1]}:${match[2]}`
    };
}

async function sendMessagesWithDelay(sender, messages) {
    for (const message of messages) {
        await conn.sendMessage(sender, { text: message });
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

function scheduleWakeUpMessage(sender, hour, minute) {
    const job = cron.schedule(`${minute} ${hour} * * *`, async () => {
        if (!conn) return;

        activeWakeUps[sender] = true;

        const randomPesanFirst = [
            pesan.firstAttempt[Math.floor(Math.random() * pesan.firstAttempt.length)],
            pesan.firstAttempt[Math.floor(Math.random() * pesan.firstAttempt.length)],
            pesan.firstAttempt[Math.floor(Math.random() * pesan.firstAttempt.length)]

        ];
        await sendMessagesWithDelay(sender, randomPesanFirst);

        const secondAttemptTimeout = setTimeout(async () => {
            const randomPesanSecond = [
                pesan.secondAttempt[Math.floor(Math.random() * pesan.secondAttempt.length)],
                pesan.secondAttempt[Math.floor(Math.random() * pesan.secondAttempt.length)],
                pesan.secondAttempt[Math.floor(Math.random() * pesan.secondAttempt.length)]
            ];
            await sendMessagesWithDelay(sender, randomPesanSecond);

            const lastAttemptTimeout = setTimeout(async () => {
                const randomPesanLast = [
                    pesan.finalAttempt[Math.floor(Math.random() * pesan.finalAttempt.length)],
                    pesan.finalAttempt[Math.floor(Math.random() * pesan.finalAttempt.length)],
                    pesan.finalAttempt[Math.floor(Math.random() * pesan.finalAttempt.length)]
                ];
                await sendMessagesWithDelay(sender, randomPesanLast);
            }, 180000);

            pendingTimeouts[sender].push(lastAttemptTimeout);
        }, 180000);

        pendingTimeouts[sender] = pendingTimeouts[sender] || [];
        pendingTimeouts[sender].push(secondAttemptTimeout);
    }, { timezone: 'Asia/Kuala_Lumpur' });

    scheduledJobs[sender] = job;
}

function stopWakeUpAttempts(sender) {
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

function rescheduleWakeUpMessages() {
    for (const sender in wakeUpTimes) {
        const time = convertTo24HourFormat(wakeUpTimes[sender]);
        if (time.valid) scheduleWakeUpMessage(sender, time.hour24, time.minute);
    }
}

function saveWakeUpTimes() {
    fs.writeFileSync(WAKEUP_FILE, JSON.stringify(wakeUpTimes, null, 2));
}

startBot();
