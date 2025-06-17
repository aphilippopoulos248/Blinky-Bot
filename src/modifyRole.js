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
        return;
    }

    // splitting string into username and role name
    const username = parts[1];
    const roleName = parts[2];

    // find member by username (case-sensitive)
    const member = message.guild.members.cache.find(m => m.user.username === username);
    if (!member) {
        message.reply(`User "${username}" not found.`);
        return;
    }

    // find role by name (case-insensitive)
    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) {
        message.reply(`Role named "${roleName}" not found.`);
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
};

module.exports = {
    modifyRole
};