// fetching environment variables
require('dotenv/config');

// loading dependencies
const { Client } = require('discord.js');
const { OpenAI } = require('openai');
const { moderateMessage } = require('./moderationManager');

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
const CHANNELS = ['1384200248645259315', '1384585158455332967'] // channel ids

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY
})

// parameters
let moderation = false;

// adding 'member' role to anyone who joins the server
// welcoming new user to the server
client.on('guildMemberAdd', async (member) => {
    const roleName = 'member';
    const welcomeChannelId = '1384585158455332967';

    // Find role by name (case-insensitive)
    const role = member.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) {
        console.error(`Role "${roleName}" not found in guild "${member.guild.name}"`);
        return;
    }

    // find welcome channel from id
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (!welcomeChannel || !welcomeChannel.isTextBased()) {
        console.error(`Welcome channel "${welcomeChannel}" not found in server`);
        return;
    }

    try {
        await member.roles.add(role);
        console.log(`Assigned role "${role.name}" to new member "${member.user.username}".`);
        welcomeChannel.send(`🎉 Welcome to the server, <@${member.id}>`);
    } catch (error) {
        console.error(`Failed to assign role to ${member.user.username}:`, error);
    }
});

// user warnings
const userWarnings = new Map();

// bot messaging functionality
client.on('messageCreate', async (message) => {
    console.log(message.content);

    // return conditions
    if (message.author.bot)
        return;
    if (!CHANNELS.includes(message.channelId) && !message.mentions.users.has(client.user.id))
        return;
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

    // enable or disable moderation commands
    if (message.content === '!enableModeration') {
        moderation = true;
        message.reply(`🚨 Moderation enabled`);
        clearInterval(sendTypingInterval);
        return;
    }
    else if (message.content === '!disableModeration') {
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
        clearInterval(sendTypingInterval);
        return;
    }


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


    // function to add or remove role
    async function modifyRole(message, action) {
        // must be server manager to run this command
        if (!message.member.permissions.has('ManageRoles') && !message.member.permissions.has('Administrator')) {
            message.reply("You don't have permission to modify roles.");
            return;
        }
        // action should be either 'add' or 'remove'
        const parts = message.content.split('-');
        if (parts.length !== 3) {
            message.reply(`Incorrect command format. Use: !${action}role-username-roleName`);
            clearInterval(sendTypingInterval);
            return;
        }

        // splitting string into username and role name
        const username = parts[1];
        const roleName = parts[2];

        // find member by username (case-sensitive)
        const member = message.guild.members.cache.find(m => m.user.username === username);
        if (!member) {
            message.reply(`User "${username}" not found.`);
            clearInterval(sendTypingInterval);
            return;
        }

        // find role by name (case-insensitive)
        const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (!role) {
            message.reply(`Role named "${roleName}" not found.`);
            clearInterval(sendTypingInterval);
            return;
        }

        try {
            if (action === 'add') {
                await member.roles.add(role);
                message.reply(`Role "${role.name}" added to user "${member.user.username}".`);
            } else if (action === 'remove') {
                await member.roles.remove(role);
                message.reply(`Role "${role.name}" removed from user "${member.user.username}".`);
            }
        } catch (error) {
            console.error(`Error ${action}ing role:`, error);
            message.reply(`Failed to ${action} role. Check my permissions and role hierarchy.`);
        }
        clearInterval(sendTypingInterval);
    };

    // command to add role
    if (message.content.startsWith('!addRole-')) {
        await modifyRole(message, 'add');
        return;
    };

    // command to remove role
    if (message.content.startsWith('!removeRole-')) {
        await modifyRole(message, 'remove');
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