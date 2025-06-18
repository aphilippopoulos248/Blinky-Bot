const activeGuilds = new Set();

module.exports = (client, roleName, guildId) => {
    if (activeGuilds.has(guildId)) return; // avoid duplicate listeners
    activeGuilds.add(guildId);
    
    client.on('guildMemberAdd', async (member) => {
        // find role by name (case-insensitive)
        const role = member.guild.roles.cache.find(
            r => r.name.toLowerCase() === roleName.toLowerCase()
        );
        if (!role) {
            console.error(`Role "${roleName}" not found in guild "${member.guild.name}"`);
            return;
        }

        try {
            // add member role to new user
            await member.roles.add(role);
            console.log(`Assigned role "${role.name}" to new member "${member.user.username}".`);
        } catch (error) {
            console.error(`Failed to assign role to ${member.user.username}:`, error);
        }
    });
}