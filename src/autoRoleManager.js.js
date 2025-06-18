// map for storing state
const guildRoleSettings = new Map();

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        const settings = guildRoleSettings.get(member.guild.id);
        if (!settings?.enabled || !settings.roleName) {
            console.log(`Auto-role is disabled for ${member.guild.name}.`);
            return;
        }

        const role = member.guild.roles.cache.find(
            r => r.name.toLowerCase() === settings.roleName.toLowerCase()
        );

        if (!role) {
            console.error(`Role "${settings.roleName}" not found in "${member.guild.name}".`);
            return;
        }

        try {
            await member.roles.add(role);
            console.log(`✅ Assigned role "${role.name}" to ${member.user.username}.`);
        } catch (err) {
            console.error(`❌ Failed to assign role:`, err);
        }
    });

    return {
        enable(guildId, roleName) {
            guildRoleSettings.set(guildId, { enabled: true, roleName });
        },
        disable(guildId, roleName) {
            const settings = guildRoleSettings.get(guildId);
            if (settings?.roleName?.toLowerCase() === roleName.toLowerCase()) {
                guildRoleSettings.set(guildId, { ...settings, enabled: false });
            }
        }
    };
};
