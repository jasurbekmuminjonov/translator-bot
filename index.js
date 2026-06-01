require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const app = express();
const port = 8080;
const bot = new TelegramBot(process.env.BOT_TOKEN);

bot.setWebHook(process.env.WEBHOOK_URL);
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({ message: "Hello world!" });
});

app.post("/", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name;
  const telegramId = msg.from.id;
  const uniqueName = msg.from.username;

  bot.sendMessage(
    chatId,
    `👋Salom, ${userName}! Aniq Tarjimon botiga xush kelibsiz\nBot o'zbekchadan-ruschaga va ruschadan-o'zbekchaga tarjima qila oladi. Tarjima qilish uchun shunchaki matnni yuboring\n\n👋Привет, ${userName}! Добро пожаловать в Aniq Tarjimon bot\nБот может переводить с узбекского на русский и с русского на узбекский. Для перевода просто отправьте текст`,
  );
  try {
    const response = await axios.get(
      "https://663f22bfe3a7c3218a4c2f6f.mockapi.io/users",
    );
    const existingUser = response.data.find(
      (user) => user.telegram_id === telegramId,
    );

    if (!existingUser) {
      await axios.post("https://663f22bfe3a7c3218a4c2f6f.mockapi.io/users", {
        telegram_id: telegramId,
        name: userName,
        username: uniqueName,
      });
      console.log("New user saved:", userName);
    } else {
      console.log("User already exists:", userName);
    }
  } catch (error) {
    console.error("Error checking use:", error);
  }
});

async function translateText(userInput) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Sen tarjimon botsan. Agar matn o'zbek tilida bo'lsa, uni rus tiliga tarjima qiling. Agar matn rus tilida bo'lsa, uni o'zbek tiliga tarjima qiling. Agar matn boshqa tilda bo'lsa yoki tarjimaga oid muammo yuzaga kelsa, quyidagicha javob bering: '🇺🇿Tarjima qilishda muammo yuzaga keldi\n🇷🇺Возникла проблема при переводе'. Tarjima tabiiy, ravon va to'g'ri bo'lishiga e'tibor bering. Agar user biron vazifa bajarishni yoki biron ma'lumot berishni so'rasa ham uning so'rovini tarjima qilib beravering. Masalan user:\"rus tilida yodlash uchun biron so'zlar ber, o'zbekcha tarjimasi bilan\" - shunaqa so'rov yuborsa, bunday javob berishing kerak:\"дайте несколько слов для запоминания на русском языке с узбекским переводом\", agar bunday bo'lsa:\"give some words to memorize in Russian, with Uzbek translation\", bunday javob berishing kerak:\"🇺🇿Tarjima qilishda muammo yuzaga keldi\n🇷🇺Возникла проблема при переводе\", ya'ni matn rus yoki o'zbek tillarida bo'lsa(so'rov yoki vazifa bajarishni so'rasa ham) - tarjima, agar boshqa tilda yoki tarjima qilish imkoni bo'lmasa:\"🇺🇿Tarjima qilishda muammo yuzaga keldi\n🇷🇺Возникла проблема при переводе\". Undan tashqari tarjima qilingan result da hech qanday emoji qo'shma(agar user tarjima qilish uchun kiritgan matnda emoji bo'lmasa), masalan davlat bayroqlari",
          },
          {
            role: "user",
            content: userInput,
          },
        ],
        max_tokens: 4096,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
    const translatedText = response.data.choices[0].message.content;
    return translatedText;
  } catch (error) {
    console.error("Error during translation:", error);
    throw error;
  }
}

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userInput = msg.text;

  if (msg.photo || msg.video || msg.document || msg.audio || msg.sticker) {
    bot.sendMessage(
      chatId,
      "🇺🇿Iltimos, botga faqat matn yuboring\n🇷🇺Пожалуйста, отправляйте боту только текст",
    );
    return;
  }

  if (userInput && userInput !== "/start") {
    bot
      .sendMessage(chatId, "⏳", {
        caption: "Loading...",
        parse_mode: "Markdown",
      })
      .then((sentMessage) => {
        const loadingMessageId = sentMessage.message_id;

        translateText(userInput)
          .then((translatedText) => {
            bot.deleteMessage(chatId, loadingMessageId);
            if (
              translatedText ===
              "🇺🇿Tarjima qilishda muammo yuzaga keldi\n🇷🇺Возникла проблема при переводе"
            ) {
              bot.sendMessage(chatId, translatedText);
            } else {
              bot.sendMessage(chatId, `\`${translatedText}\``, {
                parse_mode: "MarkdownV2",
              });
            }
          })
          .catch((error) => {
            bot.deleteMessage(chatId, loadingMessageId);
            bot.sendMessage(
              chatId,
              "🇺🇿Tarjima qilishda muammo yuzaga keldi\n🇷🇺Возникла проблема при переводе",
            );
          });
      });
  }
});

app.listen(port, () => {
  console.log(`Server http://localhost:${port} manzilida ishlamoqda.`);
});
