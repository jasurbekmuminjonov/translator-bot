
require("dotenv").config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const app = express();
const port = 8080;
const bot = new TelegramBot(process.env.BOT_TOKEN);

bot.setWebHook('https://chatgpt-translator-bot.vercel.app/');
app.use(express.json());

app.get("/", (req, res) => {
    res.status(200).json({ message: "Hello world" })
})

app.post('/', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name;
    const telegramId = msg.from.id;

    bot.sendMessage(chatId, `👋Salom, ${userName}! ChatGPT Translator botga xush kelibsiz\nBot o'zbekchadan-ruschaga va ruschadan-o'zbekchaga tarjima qila oladi. Tarjima qilish uchun shunchaki matnni yuboring\n\n👋Привет, ${userName}! Добро пожаловать в ChatGPT Translator bot\nБот может переводить с узбекского на русский и с русского на узбекский. Для перевода просто отправьте текст`);
    try {
        const response = await axios.get('https://663f22bfe3a7c3218a4c2f6f.mockapi.io/users');
        const existingUser = response.data.find(user => user.telegram_id === telegramId);

        if (!existingUser) {
            await axios.post('https://663f22bfe3a7c3218a4c2f6f.mockapi.io/users', {
                telegram_id: telegramId,
                name: userName
            });
            console.log('New user saved:', userName);
        } else {
            console.log('User already exists:', userName);
        }
    } catch (error) {
        console.error('Error checking user:', error);
    }
});

async function translateText(userInput) {
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'if the text is in Uzbek, translate it into Russian, if it is in Russian, translate it into Uzbek. If a mistake occurs during translation and the desired result is not achieved, respond as follows: "🇺🇿Tarjima qilishda muammo yuzaga keldi\n🇷🇺Возникла проблема при переводе"'
                },
                {
                    role: 'user',
                    content: userInput
                }
            ],
            max_tokens: 4096
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        const translatedText = response.data.choices[0].message.content;
        return translatedText;
    } catch (error) {
        console.error('Error during translation:', error);
        throw error;
    }
}

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userInput = msg.text;

    if (msg.photo || msg.video || msg.document || msg.audio || msg.sticker) {
        bot.sendMessage(chatId, '🇺🇿Iltimos, botga faqat matn yuboring\n🇷🇺Пожалуйста, отправляйте боту только текст');
        return;
    }

    if (userInput && userInput !== '/start') {
        bot.sendMessage(chatId, '⏳', { caption: 'Loading...', parse_mode: 'Markdown' }).then((sentMessage) => {
            const loadingMessageId = sentMessage.message_id;

            translateText(userInput).then((translatedText) => {
                bot.deleteMessage(chatId, loadingMessageId);
                if (translatedText === '🇺🇿Tarjima qilishda muammo yuzaga keldi\n🇷🇺Возникла проблема при переводе') {
                    bot.sendMessage(chatId, translatedText);
                } else {
                    bot.sendMessage(chatId, `\`${translatedText}\``, {
                        parse_mode: 'MarkdownV2'
                    });
                }
            }).catch((error) => {
                bot.deleteMessage(chatId, loadingMessageId);
                bot.sendMessage(chatId, "🇺🇿Tarjima qilishda muammo yuzaga keldi\n🇷🇺Возникла проблема при переводе");
            });
        });
    }
});

app.listen(port, () => {
    console.log(`Server http://localhost:${port} manzilida ishlamoqda`);
});
