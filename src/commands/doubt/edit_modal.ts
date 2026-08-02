import Eris from "eris";
import { blue } from "../../secret/emoji.json";
import { databaseManager } from "../../lib/database";
import { Command } from "../../types/command";
import channel from "../../secret/channels.json";
import fetch from "node-fetch";
import { generateNvidiaNim, cleanTitle } from "./nvidiaNim";

export default (bot: Eris.Client): Command => ({
  name: "doubt_edit_modal",
  description: "Handle editing doubt modal submission",
  type: "interactionCreate",
  bot,
  async execute(interaction: Eris.Interaction): Promise<void> {
    if (!(interaction instanceof Eris.ModalSubmitInteraction)) return;

    try {
      await interaction.defer(Eris.Constants.MessageFlags.EPHEMERAL);
      const message = await bot.getMessage(
        (await interaction.getOriginalMessage()).messageReference?.channelID!,
        (await interaction.getOriginalMessage()).messageReference?.messageID!,
      );

      const doubtId = message.embeds[0]?.footer?.text;
      if (!doubtId) {
        throw new Error("Invalid doubt ID in modal submission");
      }

      let doubt = await databaseManager.getDoubtById(doubtId);
      if (!doubt) {
        throw new Error("Doubt not found");
      }

      let newValue = (interaction.data.components[0] as any).components[0]
        .value;

      await databaseManager.editDoubtDescription(doubtId, newValue);
      let rawTitle =
        message.embeds[0]?.title ||
        `${interaction.member?.user.username} asks:`;
      try {
        rawTitle = await generateNvidiaNim({
          systemInstruction: `You generate concise, descriptive Discord forum titles.

              Output exactly one title.
              Do not include quotes, prefixes, suffixes, emojis, hashtags, or explanations.
              Do not mention the grade, subject, stream, or words like "doubt", "question", "help", "PCM11", or "Comm12" unless they are part of the actual question.
              Keep it under 50 characters.
              Write the title as if it were the question's topic.
              Do NOT answer, explain, or solve the student's question in the title. Only state the topic.`,
          prompt: `Create a concise Discord forum title for this student's question.

              Question:
              ${newValue}

              Context:
              - Grade: ${channel[doubt.subject]["grade"]}
              - Subject: ${channel[doubt.subject]["subject"]}

              Rules:
              - Output ONLY the title.
              - Maximum 50 characters.
              - Capture the actual topic or problem.
              - CRITICAL: Do NOT answer, solve, explain, or provide the result/formula/solution of the question in the title. The title must only state what the doubt is about (e.g., "Surface Tension on accelerating liquid", not "Angle of surface is tan(theta)").
              - Do not add "Grade ${channel[doubt.subject]["grade"]}", "${channel[doubt.subject]["subject"]}", "Doubt", "Question", "Help", or any extra labels.
              - Do not invent information.
              - Make it read like a natural forum thread title.`,
          imageUrl: doubt.image || undefined,
          maxTokens: 64,
        });
      } catch (aiError) {
        console.error(
          "AI Title generation failed during edit, using existing/fallback title:",
          aiError,
        );
      }

      const title = cleanTitle(rawTitle);

      await bot.editMessage(message.channel.id, message.id, {
        content: message.content,
        embeds: [
          {
            ...message.embeds[0],
            title: title,
            description: [
              `> ${newValue}\n`,
              `<:blue:${blue}> **Doubt asked by:** <@${interaction.member?.user.id}>`,
              `<:blue:${blue}> **Grade:** \`${channel[doubt.subject]["grade"]}\``,
            ].join("\n"),
          },
        ],

        components: message.components,
      });

      await interaction.createFollowup({
        content: `✅`,
      });
    } catch (error) {
      console.error("Error processing modal submission:", error);
      await interaction.createMessage({
        content: `❌ An error occurred while editing doubt: ${(error as Error).message}`,
        flags: Eris.Constants.MessageFlags.EPHEMERAL,
      });
    }
  },
});
