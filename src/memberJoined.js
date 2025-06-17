const { OpenAI } = require('openai');
const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY
});

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        const roleName = 'member';

        // find role by name (case-insensitive)
        const role = member.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (!role) {
            console.error(`Role "${roleName}" not found in guild "${member.guild.name}"`);
            return;
        }

        // find welcome channel from id
        let welcomeChannel = member.guild.channels.cache.find(
            ch => ch.name === 'welcome' && ch.isTextBased?.()
        );

        // if still not found, create one
        if (!welcomeChannel) {
            try {
                welcomeChannel = await member.guild.channels.create({
                    name: 'welcome',
                    type: 0, // GUILD_TEXT
                    reason: 'Channel to welcome new users',
                });
                console.log('Created channel #welcome');
            } catch (err) {
                console.error('Failed to create welcome channel:', err);
                return;
            }
        }

        try {
            // add member role to new user
            await member.roles.add(role);
            console.log(`Assigned role "${role.name}" to new member "${member.user.username}".`);
            try {
                const completion = await openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a Discord bot that generates fun, friendly, and creative welcome messages for new users joining a server.'
                        },
                        {
                            role: 'user',
                            content: `Write a short, casual welcome message for a new user joining the server. Their mention is <@${member.id}>. Use it in the message naturally. Do not use any placeholders like [User], @user, or similar — only use <@${member.id}>.`
                        }
                    ]
                });

                const welcomeMessage = completion.choices[0].message.content.trim();
                await welcomeChannel.send(welcomeMessage);

            } catch (aiError) {
                console.error('OpenAI failed to generate a welcome message:', aiError);
                // fallback
                await welcomeChannel.send(`🎉 Welcome to the server, <@${member.id}>`);
            }
        } catch (error) {
            console.error(`Failed to assign role to ${member.user.username}:`, error);
        }
    });
    client.on('guildMemberRemove', async (member) => {
        // Find the welcome channel (same as your existing code)
        let welcomeChannel = member.guild.channels.cache.find(
            ch => ch.name === 'welcome' && ch.isTextBased?.()
        );

        if (!welcomeChannel) {
            try {
                welcomeChannel = await member.guild.channels.create({
                    name: 'welcome',
                    type: 0, // GUILD_TEXT
                    reason: 'Channel for welcome and farewell messages',
                });
                console.log('Created channel #welcome');
            } catch (err) {
                console.error('Failed to create welcome channel:', err);
                return;
            }
        }

        // Send a farewell message
        try {
            try {
                const completion = await openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a Discord bot that generates fun, friendly, and creative welcome messages for new users joining a server.'
                        },
                        {
                            role: 'user',
                            content: `Write a short, casual farewell message for a new user leaving the server. Their mention is <@${member.id}>. Use it in the message naturally. Do not use any placeholders like [User], @user, or similar — only use <@${member.id}>.`
                        }
                    ]
                });

                const welcomeMessage = completion.choices[0].message.content.trim();
                await welcomeChannel.send(welcomeMessage);

            } catch (aiError) {
                console.error('OpenAI failed to generate a welcome message:', aiError);
                // fallback
                await welcomeChannel.send(`🎉 Welcome to the server, <@${member.id}>`);
            }
        } catch (error) {
            console.error('Failed to send farewell message:', error);
        }
    });
}