module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        const roleName = 'member';
        const welcomeChannelId = '1384585158455332967';

        // Find role by name (case-insensitive)
        const role = member.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (!role) {
            console.error(`Role "${roleName}" not found in guild "${member.guild.name}"`);
            return;
        }

        // find welcome channel from id or create welcome channel if it doesnt exist
        let welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
        if (!welcomeChannel || !welcomeChannel.isTextBased()) {
            try {
                welcomeChannel = await message.guild.channels.create({
                    name: 'welcome',
                    type: 0, // 0 = GUILD_TEXT
                    reason: 'Channel to welcome new users',
                });
                console.log('Created channel #welcome');
            } catch (err) {
                console.error('Failed to create welcome channel:', err);
                return true;
            }
        }

        try {
            await member.roles.add(role);
            console.log(`Assigned role "${role.name}" to new member "${member.user.username}".`);
            welcomeChannel.send(`🎉 Welcome to the server, <@${member.id}>`);
        } catch (error) {
            console.error(`Failed to assign role to ${member.user.username}:`, error);
        }
    });
}