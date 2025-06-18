const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

const userWarnings = new Map();
const WARNING_LIMIT = 3;
const FLAGGED_ROLE_NAME = 'Flagged';

// function for moderating appropriate chat
async function moderateMessage(message, moderationEnabled) {
    if (!moderationEnabled) return false;

    // creating moderator
    const moderator = await openai.moderations.create({
        input: message.content
    });
    const flagged = moderator.results[0].flagged;
    const categories = moderator.results[0].categories;

    // filtered content
    const isHarassment = categories.harassment;
    const isNSFW = categories.sexual || categories["sexual/minors"];
    const isHate = categories.hate || categories['hate/threatening'];
    const isViolent = categories.violence || categories['violence/graphic'];
    const isSelfHarm = categories['self-harm'];

    if (!flagged || !(isHarassment || isNSFW || isHate || isViolent || isSelfHarm)) {
        return false;
    }

    // fetching user id and username
    const userId = message.author.id;
    const username = message.author.username;

    // user data model that manages warnings and saves flagged messages
    let userData = userWarnings.get(userId) || { count: 0, messages: [] };
    userData.count++;
    if (userData.messages.length < WARNING_LIMIT) {
        userData.messages.push(message.content);
    }
    userWarnings.set(userId, userData);

    await message.reply(`⚠️ This message violates our server policies. Please avoid harassing language. This is warning ${userData.count}.`);

    // log to #moderation channel
    let logChannel = message.guild.channels.cache.find(
        ch => ch.name === 'moderation' && ch.isTextBased?.()
    );

    // create warning-messages if channel doesnt exist
    if (!logChannel) {
        try {
            logChannel = await message.guild.channels.create({
                name: 'moderation',
                type: 0, // 0 = GUILD_TEXT
                reason: 'Channel to log moderation warnings',
            });
            console.log('Created channel #moderation');
        } catch (err) {
            console.error('Failed to create log channel:', err);
            return true;
        }
    }

    // if warnings exceeds warning limit
    if (userData.count >= WARNING_LIMIT) {
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
                await message.reply(`🚩 <@${userId}> has been flagged. Further actions may be taken.`);
            }
        } catch (err) {
            console.error(`Failed to assign flagged role to ${username}:`, err);
        }

        // log all first 3 flagged messages together
        try {
            let combinedMessages = userData.messages
                .map((msg, idx) => `**${idx + 1}.** ${msg}`)
                .join('\n');
            await logChannel.send({
                content: `🚩 **User has been Flagged**
**User:** <@${userId}>
**Warnings:** ${userData.count}
**Flagged Messages:**
${combinedMessages}\n\n`
            });
            userWarnings.delete(userId);
        } catch (err) {
            console.error('Failed to log moderation message:', err);
        }
    } else {
        // If not at warning limit yet, log this warning as usual
        try {
            await logChannel.send({
                content: `🚨 **Moderation Triggered**
**User:** <@${userId}>
**Warnings:** ${userData.count}
**Message:** ${message.content}\n\n`
            });
        } catch (err) {
            console.error('Failed to log moderation message:', err);
        }
    }

    // delete the user's message
    try {
        await message.delete();
    } catch (err) {
        console.error(`Failed to delete message from ${message.author.username}:`, err);
    }

    return true;
}

module.exports = {
    moderateMessage
};