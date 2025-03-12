async function sendMessagesWithDelay(sender, messages, conn) {
    for (const message of messages) {
        await conn.sendMessage(sender, { text: message });
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
    }
}

module.exports = { sendMessagesWithDelay };