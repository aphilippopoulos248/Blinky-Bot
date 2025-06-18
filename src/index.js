// fetching environment variables
require('dotenv/config');

// loading dependencies
const { Client } = require('discord.js');
const { OpenAI } = require('openai');
const { moderateMessage } = require('./moderationManager');
const { modifyRole } = require('./modifyRole');

// client configuration
const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']
});

// booting client
client.on('ready', () => {
    console.log('the bot is online');
});

// constants
const BOT_NAME = 'Blinky'; // bots name
// const CHANNELS = ['1384200248645259315', '1384585158455332967'] // channel ids

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY
})

// commands
const clearCmd = '!clear';
const addRoleCmd = '!addRole-';
const removeRoleCmd = '!removeRole-';
const enableModerationCmd = '!enableModeration';
const disableModerationCmd = '!disableModeration';
const enableWelcomeCmd = '!enableWelcome';
const disableWelcomeCmd = '!disableWelcome';

// parameters
let moderation = false;
let welcome = false;

// function for when a new user joins
const memberJoinedHandler = require('./memberJoined');
if (welcome) {
    memberJoinedHandler(client);
}

// bot messaging functionality
client.on('messageCreate', async (message) => {
    console.log(message.content);

    // return conditions
    if (message.author.bot)
        return;
    // if (!CHANNELS.includes(message.channelId) && !message.mentions.users.has(client.user.id))
    //     return;
    if (!message.guild)
        return;

    // prefix needed to speak to speak to bot
    const botPrefix = message.content.startsWith('!');

    // typing effect
    let sendTypingInterval;
    if (botPrefix) {
        await message.channel.sendTyping();
        sendTypingInterval = setInterval(() => {
            message.channel.sendTyping();
        }, 5000);
    }

    // enable welcome messages
    if (message.content === enableWelcomeCmd) {
        welcome = true;
        message.reply(`🤗 Welcome enabled`);
        clearInterval(sendTypingInterval);
        return;
    }
    else if (message.content === disableWelcomeCmd) {
        welcome = false;
        message.reply(`😢 Welcome disabled`);
        clearInterval(sendTypingInterval);
        return;
    }

    // enable or disable moderation commands
    if (message.content === enableModerationCmd) {
        moderation = true;
        message.reply(`🚨 Moderation enabled`);
        clearInterval(sendTypingInterval);
        return;
    }
    else if (message.content === disableModerationCmd) {
        moderation = false;
        message.reply(`🚫 Moderation disabled`);
        clearInterval(sendTypingInterval);
        return;
    }

    // moderating vulgar speach
    const moderationHandled = await moderateMessage(message, moderation);
    if (moderationHandled) {
        clearInterval(sendTypingInterval);
        return;
    }


    // clear all messages
    if (message.content === clearCmd) {
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
        clearInterval(sendTypingInterval);
        return;
    }


    // fetching user roles
    const roles = message.member.roles.cache
        .filter(role => role.name !== '@everyone') // exclude @everyone
        .map(role => role.name);


    // configuring chatbot personality and conversation
    const userMention = `<@${message.author.id}>`;
    let conversation = [];
    conversation.push({
        role: 'system',
        content: `${BOT_NAME} is a helpful and friendly Discord bot developed by Alexander Philippopoulos using OpenAI's GPT model.
        When addressing the user, refer to them as "${userMention}" to make replies more personal.
        It does not attempt to access or infer private user data. 
        Here are the current user's roles: [${roles.join(', ')}]. 
        Only answer questions using this visible information.
        Can manage server roles. 
        Can moderate hate speech. Does not tolerate racism, sexism, homophobism, xenophobism, and any kind of hate speech.`
    })


    // fetching previous messages to chatbot memory
    let prevMessages = await message.channel.messages.fetch({ limit: 10 });
    prevMessages.reverse();

    prevMessages.forEach((msg) => {
        if (msg.author.bot && msg.author.id !== client.user.id)
            return;

        // fetching bot and username of the user
        const isBot = msg.author.id === client.user.id;
        const username = isBot ? BOT_NAME : msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');

        conversation.push({
            role: isBot ? 'assistant' : 'user',
            name: username,
            content: msg.content,
        });
    });

    // command to add role
    if (message.content.startsWith(addRoleCmd)) {
        await modifyRole(message, 'add');
        clearInterval(sendTypingInterval);
        return;
    };

    // command to remove role
    if (message.content.startsWith(removeRoleCmd)) {
        await modifyRole(message, 'remove');
        clearInterval(sendTypingInterval);
        return;
    };

    if (botPrefix) {
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
    }
    else {
        clearInterval(sendTypingInterval);
    }
});

// using discord bot api token
client.login(process.env.TOKEN);