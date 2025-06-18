// map for storing state
const guildRoleSettings = new Map();

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        const settings = guildRoleSettings.get(member.guild.id);
        if (!settings?.enabled || !settings.roleNames?.length) {
            console.log(`Auto-role is disabled for ${member.guild.name}.`);
            return;
        }

        // adds 1 or more roles to newcomers
        for (const roleName of settings.roleNames) {
            // locates roles from the roles list
            const role = member.guild.roles.cache.find(
                r => r.name.toLowerCase() === roleName.toLowerCase()
            );

            if (!role) {
                console.error(`Role "${roleName}" not found in "${member.guild.name}".`);
                continue;
            }

            // adds roles to newcomers
            try {
                await member.roles.add(role);
                console.log(`✅ Assigned role "${role.name}" to ${member.user.username}.`);
            } catch (err) {
                console.error(`❌ Failed to assign role "${role.name}":`, err);
            }
        }
    });

    return {
        // adds role to roleNames list
        enable(guildId, roleName) {
            const existing = guildRoleSettings.get(guildId) || { 
                enabled: true, 
                roleNames: [] 
            };
            const updatedRoles = new Set(existing.roleNames.map(r => r.toLowerCase()));
            updatedRoles.add(roleName.toLowerCase());
            guildRoleSettings.set(guildId, {
                enabled: true,
                roleNames: [...updatedRoles],
            });
        },
        // removes role from roleNames list
        disable(guildId, roleName) {
            const existing = guildRoleSettings.get(guildId);
            if (!existing) return;

            const updatedRoles = existing.roleNames.filter(
                r => r.toLowerCase() !== roleName.toLowerCase()
            );

            guildRoleSettings.set(guildId, {
                enabled: updatedRoles.length > 0,
                roleNames: updatedRoles,
            });
        },
        // returns the current list of roleNames
        list(guildId) {
            const settings = guildRoleSettings.get(guildId);
            return settings?.roleNames || [];
        }
    };
};
