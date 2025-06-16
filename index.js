require('dotenv/config');
const { Client } = require('discord.js');
const { OpenAI } = require('openai');

const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']
});

client.on('ready', () => {
    console.log('the bot is online');
});

const IGNORE_PREFIX = "!";
const CHANNELS = ['1384200248645259315'] // channel ids
const BOT_NAME = 'Blinky'; // bots name
const OWNER_ID  = '619991897196462090'

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
        It is implemented on your Discord server to assist its users.
        It only learns new things from ${OWNER_NAME}.`
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
        await message.reply(chunk);
    }
});

client.login(process.env.TOKEN);