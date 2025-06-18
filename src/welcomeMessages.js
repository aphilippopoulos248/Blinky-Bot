const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

let welcomeEnabled = false;

module.exports = (client) => {
    // when newcomers join the server
    client.on('guildMemberAdd', async (member) => {
        if (!welcomeEnabled) 
            return;

        // finding welcome channel
        let welcomeChannel = member.guild.channels.cache.find(
            ch => ch.name === 'welcome' && ch.isTextBased?.()
        );
        if (!welcomeChannel) {
            const channels = await member.guild.channels.fetch();
            welcomeChannel = channels.find(ch => ch.name === 'welcome' && ch.isTextBased());
        }

        // creating welcome channel if it doesnt exist
        if (!welcomeChannel) {
            try {
                welcomeChannel = await member.guild.channels.create({
                    name: 'welcome',
                    type: 0,
                    reason: 'Channel for welcome and farewell messages',
                });
                console.log('Created channel #welcome');
            } catch (err) {
                console.error('Failed to create welcome channel:', err);
                return;
            }
        }

        try {
            // welcome messages
            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a Discord bot that generates fun, friendly, and creative welcome messages.'
                    },
                    {
                        role: 'user',
                        content: `Write a short welcome for <@${member.id}>.`
                    }
                ]
            });

            const welcomeMessage = completion.choices[0].message.content.trim();
            await welcomeChannel.send(welcomeMessage);
        } catch (e) {
            console.error('OpenAI error:', e);
            await welcomeChannel.send(`🎉 Welcome to the server, <@${member.id}>`);
        }
    });

    // when newcomers leave the server
    client.on('guildMemberRemove', async (member) => {
        if (!welcomeEnabled) 
            return;

        let welcomeChannel = member.guild.channels.cache.find(
            ch => ch.name === 'welcome' && ch.isTextBased?.()
        );
        if (!welcomeChannel) {
            const channels = await member.guild.channels.fetch();
            welcomeChannel = channels.find(ch => ch.name === 'welcome' && ch.isTextBased());
        }

        if (!welcomeChannel) {
            try {
                welcomeChannel = await member.guild.channels.create({
                    name: 'welcome',
                    type: 0,
                    reason: 'Channel for welcome and farewell messages',
                });
                console.log('Created channel #welcome');
            } catch (err) {
                console.error('Failed to create welcome channel:', err);
                return;
            }
        }

        try {
            // farewell messages
            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a Discord bot that generates fun, friendly, and creative farewell messages.'
                    },
                    {
                        role: 'user',
                        content: `Write a short farewell for <@${member.id}>.`
                    }
                ]
            });

            const farewellMessage = completion.choices[0].message.content.trim();
            await welcomeChannel.send(farewellMessage);
        } catch (e) {
            console.error('OpenAI error:', e);
            await welcomeChannel.send(`👋 <@${member.id}> has left the server.`);
        }
    });

    return {
        // function to enable welcome system
        enable: () => {
            welcomeEnabled = true;
            console.log('✅ Welcome system enabled');
        },
        // function to disable welcome system
        disable: () => {
            welcomeEnabled = false;
            console.log('❌ Welcome system disabled');
        }
    };
};
