import Eris from "eris";
import { Command } from "../../types/command";
import fetch from "node-fetch";
import { guildID } from "../../secret/config.json";
const staffRoleIDs: string[] = require("../../secret/config.json").staffRoleIDs;
import roles from "../../secret/roles.json";
import { databaseManager } from "../../lib/database";
import { red, blue } from "../../secret/emoji.json";

export default (bot: Eris.Client): Command => ({
  name: "doubt_edit",
  description: "Edit your doubt",
  type: "interactionCreate",
  bot,
  async execute(interaction: Eris.Interaction): Promise<void> {
    if (
      !(interaction instanceof Eris.ComponentInteraction) ||
      interaction.data.component_type !== Eris.Constants.ComponentTypes.BUTTON
    )
      return;

    try {
      let doubtId = interaction.message.embeds[0]?.footer?.text || "";
      let doubt = await databaseManager.getDoubtById(doubtId);

      if (!doubt) {
        throw new Error("Doubt not found in the database");
      }

      const hasPermission = (interaction.member?.roles as string[]).some(
        (role) => staffRoleIDs.includes(role),
      );
      if (interaction.member?.id !== doubt.author && !hasPermission) {
        await interaction.createMessage({
          content: `❌ You can't edit this doubt!`,
          flags: Eris.Constants.MessageFlags.EPHEMERAL,
        });
        return;
      }

      await interaction.createModal({
        title: "Edit Doubt",
        custom_id: `doubt_edit_modal`,
        components: [
          {
            type: Eris.Constants.ComponentTypes.ACTION_ROW,
            components: [
              {
                type: Eris.Constants.ComponentTypes.TEXT_INPUT,
                custom_id: "description",
                label: "Enter the edited doubt:",
                style: Eris.Constants.TextInputStyles.SHORT,
                required: true,
                placeholder: doubt.description,
                value: doubt.description,
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error("Error editing doubt:", error);
      await interaction.editOriginalMessage({
        content: "❌ An error occurred while editing doubt.",
        components: [],
      });
    }
  },
});
