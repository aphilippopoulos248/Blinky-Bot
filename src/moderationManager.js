const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

const userWarnings = new Map();
const WARNING_LIMIT = 3;
const FLAGGED_ROLE_NAME = 'Flagged';

async function moderateMessage(message, moderationEnabled) {
    if (!moderationEnabled)
        return false;

    // creating moderator
    const moderator = await openai.moderations.create({
        input: message.content
    });
    const flagged = moderator.results[0].flagged;
    const categories = moderator.results[0].categories;

    if (!flagged || !categories.harassment)
        return false;

    // fetching user id and username
    const userId = message.author.id;
    const username = message.author.username;

    // managing warnings
    let warnings = userWarnings.get(userId) || 0;
    warnings++;
    userWarnings.set(userId, warnings);

    await message.reply(`⚠️ Please avoid harassing language. This is warning ${warnings}.`);

    // log to #warning-messages channel
    let logChannel = message.guild.channels.cache.find(
        ch => ch.name === 'warning-messages' && ch.isTextBased?.()
    );

    // create warning-messages if channel doesnt exist
    if (!logChannel) {
        try {
            logChannel = await message.guild.channels.create({
                name: 'warning-messages',
                type: 0, // 0 = GUILD_TEXT
                reason: 'Channel to log moderation warnings',
            });
            console.log('Created channel #warning-messages');
        } catch (err) {
            console.error('Failed to create log channel:', err);
            return true;
        }
    }

    // if warnings exceeds warning limit
    if (warnings >= WARNING_LIMIT) {
        // fetching flagged role
        let flaggedRole = message.guild.roles.cache.find(
            r => r.name.toLowerCase() === FLAGGED_ROLE_NAME.toLowerCase()
        );

        // create flagged role
        if (!flaggedRole) {
            try {
                flaggedRole = await message.guild.roles.create({
                    name: FLAGGED_ROLE_NAME,
                    color: 'Red',
                    reason: 'Assigned to users who surpassed harassment warnings'
                });
                console.log(`Created role "${FLAGGED_ROLE_NAME}"`);
            } catch (error) {
                console.error(`Failed to create role:`, error);
                return true;
            }
        }

        try {
            // flagging user based on user id
            const member = await message.guild.members.fetch(userId);
            if (!member.roles.cache.has(flaggedRole.id)) {
                await member.roles.add(flaggedRole);
                await message.reply(`🚩 ${username} has been flagged. Further actions may be taken.`);
            }
        } catch (err) {
            console.error(`Failed to assign flagged role to ${username}:`, err);
        }
    }

    try {
        await logChannel.send({
            content: `🚨 **Moderation Triggered**\n**User:** <@${userId}> (${username})\n**Message:** ${message.content}\n**Warnings:** ${warnings}`
        });
    } catch (err) {
        console.error('Failed to log moderation message:', err);
    }

    return true;
}

module.exports = {
    moderateMessage
};