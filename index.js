const TelegramBot = require('node-telegram-bot-api');

/* ===============================
   ENV
================================ */
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!TOKEN || !ADMIN_ID) {
  console.error('BOT_TOKEN yoki ADMIN_ID topilmadi');
  process.exit(1);
}

/* ===============================
   BOT INIT
================================ */
const bot = new TelegramBot(TOKEN, {
  polling: { interval: 300, autoStart: true }
});

console.log('Bot ishga tushdi');

/* ===============================
   XOTIRA STRUKTURALARI
================================ */
// Kanonik ID -> birinchi xabar
const topicIds = {};

// Raqam -> kanonik (harfli) ID
const numberAlias = {};

/* ===============================
   ID ANIQLASH
================================ */
function extractIds(text) {
  if (!text) return [];

  const results = new Set();
  const usedNumbers = new Set();

  // Harf + optional "-" + 4–6 raqam
  const letterRegex = /\b([A-Za-zА-Яа-я])[-–—]?\s*(\d{4,6})\b/g;
  // Faqat 4–6 xonali raqam
  const numberRegex = /\b\d{4,6}\b/g;

  // Kirill → lotin
  const cyrToLatMap = {
    'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H',
    'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T',
    'Х': 'X',
    'а': 'A', 'в': 'B', 'с': 'C', 'е': 'E', 'н': 'H',
    'к': 'K', 'м': 'M', 'о': 'O', 'р': 'P', 'т': 'T',
    'х': 'X'
  };

  let match;

  // 1️⃣ Harfli ID’lar
  while ((match = letterRegex.exec(text)) !== null) {
    let letter = match[1];
    const digits = match[2];

    if (cyrToLatMap[letter]) {
      letter = cyrToLatMap[letter];
    } else {
      letter = letter.toUpperCase();
    }

    results.add(letter + '-' + digits);
    usedNumbers.add(digits);
  }

  // 2️⃣ Faqat raqamli ID’lar (agar harfli bilan band bo‘lmasa)
  const numbers = text.match(numberRegex) || [];
  numbers.forEach(num => {
    if (!usedNumbers.has(num)) {
      results.add(num);
    }
  });

  return Array.from(results);
}

/* ===============================
   XABAR LINKI
================================ */
function getMessageLink(chatId, messageId) {
  const cleanChatId = String(chatId).replace('-100', '');
  return 'https://t.me/c/' + cleanChatId + '/' + messageId;
}

/* ===============================
   ASOSIY HANDLER
================================ */
bot.on('message', async (msg) => {
  try {
    if (!['group', 'supergroup'].includes(msg.chat.type)) return;
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;
    if (!topicId) return;

    // Xotirani tayyorlash
    if (!topicIds[chatId]) topicIds[chatId] = {};
    if (!topicIds[chatId][topicId]) topicIds[chatId][topicId] = {};

    if (!numberAlias[chatId]) numberAlias[chatId] = {};
    if (!numberAlias[chatId][topicId]) numberAlias[chatId][topicId] = {};

    const ids = extractIds(msg.text);
    if (!ids.length) return;

    for (let rawId of ids) {
      let canonicalId = rawId;

      /* ===============================
         1️⃣ Agar faqat raqam bo‘lsa,
            oldin harfli ID mavjudmi?
      ================================ */
      if (/^\d{4,6}$/.test(rawId) && numberAlias[chatId][topicId][rawId]) {
        canonicalId = numberAlias[chatId][topicId][rawId];
      }

      /* ===============================
         2️⃣ Agar harfli ID bo‘lsa,
            u ENG USTUN hisoblanadi
      ================================ */
      const match = canonicalId.match(/^([A-Z])-(\d{4,6})$/);
      if (match) {
        const digits = match[2];

        // Alias yozamiz
        numberAlias[chatId][topicId][digits] = canonicalId;

        // 🔥 MUHIM: agar oldin raqamli ID saqlangan bo‘lsa → ko‘chiramiz
        if (topicIds[chatId][topicId][digits]) {
          const firstMsgId = topicIds[chatId][topicId][digits];
          delete topicIds[chatId][topicId][digits];
          topicIds[chatId][topicId][canonicalId] = firstMsgId;
        }
      }

      /* ===============================
         3️⃣ TAKROR TEKSHIRUV
      ================================ */
      if (topicIds[chatId][topicId][canonicalId]) {
        const firstMessageId = topicIds[chatId][topicId][canonicalId];

        const alertMessage =
          '🚨 <b>TAKROR ID ANIQLANDI</b>\n\n' +
          '🆔: <b>' + canonicalId + '</b>\n\n' +
          '📌 <a href="' + getMessageLink(chatId, firstMessageId) + '">1-yuborilgan ID</a>\n\n' +
          '📌 <a href="' + getMessageLink(chatId, msg.message_id) + '">Takror yuborilgan ID</a>\n\n' +
          '👨🏻‍💻 <a href="tg://user?id=' + ADMIN_ID + '"><b>Admin</b></a>';

        await bot.sendMessage(chatId, alertMessage, {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id,
          message_thread_id: topicId
        });
      } else {
        // Birinchi marta kelgan ID
        topicIds[chatId][topicId][canonicalId] = msg.message_id;
      }
    }
  } catch (err) {
    console.error('Xato:', err);
  }
});

/* ===============================
   ERROR HANDLER
================================ */
bot.on('polling_error', (e) => {
  console.error('Polling error:', e.message);
});
