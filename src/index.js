// fetching environment variables
require('dotenv/config');

// loading dependencies
const { Client } = require('discord.js');
const { OpenAI } = require('openai');

// client configuration
const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']
});

// booting client
client.on('ready', () => {
    console.log('the bot is online');
});

// constants
const IGNORE_PREFIX = "#";
const CHANNELS = ['1384200248645259315'] // channel ids
const BOT_NAME = 'Blinky'; // bots name

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY
})

// bot messaging functionality
client.on('messageCreate', async (message) => {
    console.log(message.content);
    if (message.author.bot)
        return;
    if (message.content.startsWith(IGNORE_PREFIX))
        return;
    if (!CHANNELS.includes(message.channelId) && !message.mentions.users.has(client.user.id))
        return;
    if (!message.guild) 
        return;

    // clear all messages
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

    // typing effect
    await message.channel.sendTyping();
    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000);

    // fetching user roles
    const roles = message.member.roles.cache
        .filter(role => role.name !== '@everyone') // exclude @everyone
        .map(role => role.name);

    // configuring chatbot personality and conversation
    let conversation = [];
    conversation.push({
        role: 'system',
        content: `${BOT_NAME} is a helpful and friendly Discord bot developed by Alexander Philippopoulos using OpenAI's GPT model.
        It participates in conversations and uses public usernames only to make replies more personal.
        It does not attempt to access or infer private user data. 
        Here are the current user's roles: [${roles.join(', ')}]. 
        Only answer questions using this visible information.`
    })

    // fetching previous messages to chatbot memory
    let prevMessages = await message.channel.messages.fetch({ limit: 10 });
    prevMessages.reverse();

    prevMessages.forEach((msg) => {
        if (msg.author.bot && msg.author.id !== client.user.id)
            return;
        if (msg.content.startsWith(IGNORE_PREFIX))
            return;

        // fetching bot and username of the user
        const isBot = msg.author.id === client.user.id;
        const username = isBot ? BOT_NAME : msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');

        conversation.push({
            role: isBot ? 'assistant' : 'user',
            name: username,
            content: msg.content,
        });
    })

    // using openai api key for chatbots model
    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: conversation,
    }).catch((error) => console.error('Blinky Error:\n', error));

    // clearing typing interval after message has been generated
    clearInterval(sendTypingInterval);
    if (!response) {
        message.reply("I'm having some trouble processing your request");
        return;
    }

    // giving best response from gpt model
    const responseMessage = response.choices[0].message.content;
    const chunkSizeLimit = 2000;

    for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
        const chunk = responseMessage.substring(i, i + chunkSizeLimit);
        await message.channel.send(chunk);
    }
});

// using discord bot api token
client.login(process.env.TOKEN);