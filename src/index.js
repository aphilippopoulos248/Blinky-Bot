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

// authorized roles for commands
const authorizedCmdRoles = ['Admin', 'Moderator'];
function userHasAuthorizedRole(member, roles) {
    return member.roles.cache.some(role =>
        roles.includes(role.name) || role.permissions.has('Administrator')
    );
}
function checkUserAuthorization(message, sendTypingInterval) {
    if (!userHasAuthorizedRole(message.member, authorizedCmdRoles)) {
        message.reply("⛔ You don't have permission to use this command.");
        clearInterval(sendTypingInterval);
        return false;
    }
    return true;
}

// commands
const clearCmd = '!clear';
const addRoleCmd = '!addRole';
const removeRoleCmd = '!removeRole';
const enableModerationCmd = '!enableModeration';
const disableModerationCmd = '!disableModeration';
const enableWelcomeCmd = '!enableWelcome';
const disableWelcomeCmd = '!disableWelcome';
const addNewMemberRoleCmd = '!addNewMemberRole';
const removeNewMemberRoleCmd = '!removeNewMemberRole';
const viewNewMemberRoleCmd = '!viewNewMemberRole';

// parameters
let moderation = false;

// function to welcome new member
const setUpWelcome = require('./welcomeMessages.js');
const welcomeHandler = setUpWelcome(client);

const setupAutoRole = require('./autoRoleManager.js');
const autoRoleHandler = setupAutoRole(client);

// bot messaging functionality
client.on('messageCreate', async (message) => {
    console.log(message.content);

    // return conditions
    if (message.author.bot) return;
    // if (!message.mentions.users.has(client.user.id)) return;
    if (!message.guild) return;

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

    //#region 
    // all authorized commands

    // clear all messages
    if (message.content === clearCmd) {
        if (!checkUserAuthorization(message, sendTypingInterval)) return;
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

    // enable and disable welcome messages
    if (message.content === enableWelcomeCmd) {
        if (!checkUserAuthorization(message, sendTypingInterval)) return;
        welcomeHandler.enable();
        message.reply(`🤗 Welcome enabled`);
        clearInterval(sendTypingInterval);
        return;
    }
    if (message.content === disableWelcomeCmd) {
        if (!checkUserAuthorization(message, sendTypingInterval)) return;
        welcomeHandler.disable();
        message.reply(`😢 Welcome disabled`);
        clearInterval(sendTypingInterval);
        return;
    }

    // add newcomer role command
    if (message.content.startsWith(addNewMemberRoleCmd)) {
        if (!checkUserAuthorization(message, sendTypingInterval)) return;
        const roleName = message.content.split('-').slice(1).join('-').trim();
        if (!roleName) {
            return message.reply('❗ Please specify a role name. Example: `!addNewMemberRole-Member`');
        }

        autoRoleHandler.enable(message.guild.id, roleName);
        message.reply(`✅ New members will now be assigned the role: **${roleName}**`);
        clearInterval(sendTypingInterval);
        return;
    }
    // remove newcomer role command
    if (message.content.startsWith(removeNewMemberRoleCmd)) {
        if (!checkUserAuthorization(message, sendTypingInterval)) return;
        const roleName = message.content.split('-').slice(1).join('-').trim();
        if (!roleName) {
            return message.reply('❗ Please specify a role name. Example: `!removeNewMemberRole-Member`');
        }

        autoRoleHandler.disable(message.guild.id, roleName);
        message.reply(`❌ New members will no longer be assigned the role: **${roleName}**`);
        clearInterval(sendTypingInterval);
        return;
    }
    // view newcomer role(s) command
    if (message.content === viewNewMemberRoleCmd) {
        if (!checkUserAuthorization(message, sendTypingInterval)) return;
        const newMemberRoles = autoRoleHandler.list(message.guild.id);
        message.reply(`Here are the following roles assigned to newcomers: **${newMemberRoles}**`);
        clearInterval(sendTypingInterval);
        return;
    }


    // enable or disable moderation commands
    if (message.content === enableModerationCmd) {
        if (!checkUserAuthorization(message, sendTypingInterval)) return;
        moderation = true;
        message.reply(`🚨 Moderation enabled`);
        clearInterval(sendTypingInterval);
        return;
    }
    if (message.content === disableModerationCmd) {
        if (!checkUserAuthorization(message, sendTypingInterval)) return;
        moderation = false;
        message.reply(`🚫 Moderation disabled`);
        clearInterval(sendTypingInterval);
        return;
    }

    // command to add or remove role
    if (message.content.startsWith(addRoleCmd)) {
        if (!checkUserAuthorization(message, sendTypingInterval)) return;
        await modifyRole(message, 'add');
        clearInterval(sendTypingInterval);
        return;
    };
    if (message.content.startsWith(removeRoleCmd)) {
        if (!checkUserAuthorization(message, sendTypingInterval)) return;
        await modifyRole(message, 'remove');
        clearInterval(sendTypingInterval);
        return;
    };
    //#endregion


    // moderating vulgar speach
    const moderationHandled = await moderateMessage(message, moderation);
    if (moderationHandled) {
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
        if (msg.author.bot && msg.author.id !== client.user.id){
            return;
        } 

        // fetching bot and username of the user
        const isBot = msg.author.id === client.user.id;
        const username = isBot ? BOT_NAME : msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');

        conversation.push({
            role: isBot ? 'assistant' : 'user',
            name: username,
            content: msg.content,
        });
    });

    // bot only responds to messages with the botPrefix in front
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