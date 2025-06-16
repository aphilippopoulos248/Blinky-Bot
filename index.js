require('dotenv/config');
console.log("DISCORD TOKEN:", process.env.TOKEN?.slice(0, 10) || "MISSING");

const { Client } = require('discord.js');
const { OpenAI } = require('openai');

const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']
});

client.on('ready', () => {
    console.log('the bot is online');
});

const IGNORE_PREFIX = "#";
const CHANNELS = ['1384200248645259315'] // channel ids
const BOT_NAME = 'Blinky'; // bots name
// const OWNER_ID  = '619991897196462090'
// const OWNER_NAME = 'aphilippopoulos'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY
})

client.on('messageCreate', async (message) => {
    console.log(message.content);
    if (message.author.bot) 
        return;
    if (message.content.startsWith(IGNORE_PREFIX))
        return;
    if (!CHANNELS.includes(message.channelId) && !message.mentions.users.has(client.user.id))
        return;

    if (message.content === '!clear') {
        const channel = message.channel;
        try {
            const messages = await channel.messages.fetch();
            const deletable = messages.filter(msg => (Date.now() - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000);

            await channel.bulkDelete(deletable, true);
            await channel.send(`🧹 Cleared all messages.`)
                .then(msg => setTimeout(() => msg.delete(), 3000));
        } catch (err) {
            console.error('Clear Error:', err);
            message.reply("❌ I couldn't delete messages.");
        }
    }

    await message.channel.sendTyping();
    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000);

    let conversation = [];
    conversation.push({
        role: 'system',
        // the personality of the chatbot
        content: `${BOT_NAME} is a friendly chatbot. 
        It always refers to itself as ${BOT_NAME} when talking to users.
        It was developed by Alexander Philippopoulos using OpenAI's gpt-3.5 model.
        It is implemented on your Discord server to assist its users.`
    })

    let prevMessages = await message.channel.messages.fetch({ limit: 10 });
    prevMessages.reverse();

    prevMessages.forEach((msg) => {
        if (msg.author.bot && msg.author.id !== client.user.id) 
            return;
        if (msg.content.startsWith(IGNORE_PREFIX)) 
            return;
        
        const isBot = msg.author.id === client.user.id;
        const username = isBot ? BOT_NAME : msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');

        //  // Check if the message is trying to teach the bot
        // const isTryingToTeach = /^blinky,?\s*(remember|learn|from now on|note|you should)/i.test(msg.content);

        //  // Block "learning" messages unless they are from you
        // if (isTryingToTeach && msg.author.name !== OWNER_NAME) {
        //     return message.reply("Sorry, I only learn new things from my creator.");
        // }

        conversation.push({
            role: isBot ? 'assistant' : 'user',
            name: username,
            content: msg.content,
        });
    })

    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: conversation,
    }).catch((error) => console.error('Blinky Error:\n', error));

    clearInterval(sendTypingInterval);
    if (!response) {
        message.reply("I'm having some trouble processing your request");
        return;
    }

    const responseMessage = response.choices[0].message.content;
    const chunkSizeLimit = 2000;

    for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
        const chunk = responseMessage.substring(i, i + chunkSizeLimit);
        await message.channel.send(chunk);
    }
});

client.login(process.env.TOKEN);