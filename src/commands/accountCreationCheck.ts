import Eris from 'eris';
import { Command } from '../types/command';

export default (bot: Eris.Client): Command => ({
    name: 'accountCreationCheck',
    description: 'Checks if the account is created less than a months ago',
    type: 'guildMemberAdd',

    async execute(guild: Eris.Guild, member: Eris.Member): Promise<void> {
        const created = new Date(member.createdAt);
        const now = new Date();
        const diff = now.getTime() - created.getTime();
        const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (diffDays < 30) {
            const userIds = [
                '1216795874877771806', // isoarisredux_
                '713588368033710080'   // rc.hq
            ];

            for (const userId of userIds) {
                const dmChannel = await bot.getDMChannel(userId);
                await dmChannel.createMessage({
                    embeds: [{
                        color: 0xffffff,
                        description: `<@${member.id}> (${member.username}) created their account <t:${Math.round(member.createdAt / 1000)}:R> (<t:${Math.round(member.createdAt / 1000)}:F>)`
                    }],
                    components: [{
                        type: Eris.Constants.ComponentTypes.ACTION_ROW,
                        components: [{
                            label: 'Visit Profile',
                            style: Eris.Constants.ButtonStyles.LINK,
                            type: Eris.Constants.ComponentTypes.BUTTON,
                            url: `https://discord.com/users/${member.id}`
                        }]
                    }]
                });
            }
        }
    }
});
