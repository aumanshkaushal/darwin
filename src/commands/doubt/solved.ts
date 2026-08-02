import Eris from "eris";
import emojis from "../../secret/emoji.json";
import { Command } from "../../types/command";
import { databaseManager } from "../../lib/database";

export default (bot: Eris.Client): Command => ({
  name: "solved",
  description: "Mark a question as solved",
  type: "onMessage",
  async execute(msg: Eris.Message): Promise<void> {
    if (!msg.messageReference?.messageID) {
      return;
    }

    const originalMessage = await bot.getMessage(
      msg.messageReference.channelID,
      msg.messageReference.messageID,
    );

    if (originalMessage.author.id === bot.user.id) {
      return;
    }

    const args = msg.content.split(" ");
    let doubtId = args[1];

    if (!doubtId) {
      const lastDoubt = await databaseManager.getLastDoubtByUserId(
        msg.author.id,
      );
      if (!lastDoubt) {
        await msg.channel.createMessage("You have no open doubts.");
        return;
      }

      if (lastDoubt.status !== "open") {
        await msg.channel.createMessage(
          `Your last doubt with ID ${lastDoubt.id} is not open and cannot be marked as solved. Try specifying the doubt ID explicitly with \`!solved <doubtId>\`.`,
        );
        return;
      }

      doubtId = lastDoubt.id;
    }

    const doubt = await databaseManager.getDoubtById(doubtId);
    if (!doubt) {
      await msg.channel.createMessage(`Doubt with ID ${doubtId} not found.`);
      return;
    }

    if (doubt.status !== "open") {
      await msg.channel.createMessage(
        `Doubt with ID ${doubtId} is not open and cannot be marked as solved.`,
      );
      return;
    }

    try {
      await databaseManager.markDoubtAsSolved(
        doubtId,
        msg.author.id,
        msg.id,
        msg.channel.id,
      );
      await msg.channel.createMessage(
        `Doubt with ID ${doubtId} has been marked as solved.`,
      );
    } catch (error) {
      console.error(error);
      await msg.channel.createMessage(
        `Failed to mark doubt with ID ${doubtId} as solved. Please try again later.`,
      );
    }

    const origianalEmbedMessageID = doubt["message_id"];
    const originalEmbedChannelID = doubt["channel_id"];
    const originalEmbedMessage = await bot.getMessage(
      originalEmbedChannelID,
      origianalEmbedMessageID,
    );

    const updatedEmbed = originalEmbedMessage.embeds[0];
    updatedEmbed.color = 0x00ff00;
    updatedEmbed.description =
      `${updatedEmbed.description}\n<:green:${emojis.green}> **Solved by :** <@${originalMessage.author.id}>`.replace(
        new RegExp(`<:blue:${emojis.blue}>`, "g"),
        `<:green:${emojis.green}>`,
      );

    await bot.editMessage(originalEmbedChannelID, origianalEmbedMessageID, {
      embeds: [updatedEmbed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "View Answer",
              url: `https://discord.com/channels/${originalMessage.guildID}/${originalMessage.channel.id}/${originalMessage.id}`,
            },
          ],
        },
      ],
    });
  },
});
