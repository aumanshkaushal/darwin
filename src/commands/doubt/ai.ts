import Eris from "eris";
import { Command } from "../../types/command";
import fetch from "node-fetch";
import { guildID } from "../../secret/config.json";
import { generateNvidiaNim } from "./nvidiaNim";
import roles from "../../secret/roles.json";
import { databaseManager } from "../../lib/database";
import channels from "../../secret/channels.json";

export default (bot: Eris.Client): Command => ({
  name: "doubt_ai",
  description: "Get AI-generated answers for your doubts",
  type: "interactionCreate",
  bot,
  async execute(interaction: Eris.Interaction): Promise<void> {
    if (
      !(interaction instanceof Eris.ComponentInteraction) ||
      interaction.data.component_type !== Eris.Constants.ComponentTypes.BUTTON
    )
      return;

    await interaction.defer(Eris.Constants.MessageFlags.EPHEMERAL);

    try {
      let doubt = await databaseManager.getDoubtById(
        interaction.message.embeds[0]?.footer?.text || "",
      );
      const finalImageUrl = doubt?.imageUrl || doubt?.image || undefined;
      const subjectName = (channels as any)[doubt.subject]?.subject || doubt.subject;

      const responseText = await generateNvidiaNim({
        systemInstruction: "You are a helpful and polite educational assistant.",
        prompt: `You are Darwin, a friendly and knowledgeable high school tutor.
A student in Grade ${doubt.grade} has submitted a doubt for the subject: ${subjectName}.

Here is the student's question:
"${doubt.description}"

Please explain the concept in the doubt clearly and educationally using simple language, analogies, and examples. Focus on helping the student understand the science/concept.

Rules:
- Keep the response concise, high-impact, and strictly educational.
- Do NOT include any unsafe, harmful, or inappropriate discussion.
- Format the response beautifully for Discord using Markdown:
  - Stay well within Discord's 4096-character limit.
  - Use bullet points and bold headers for clarity.
  - Keep paragraphs short and scannable.
  - Use code blocks only if they improve readability.`,
        imageUrl: finalImageUrl,
      });

      interaction.createFollowup({
        embeds: [
          {
            description: responseText,
            color: 0xffffff,
          },
        ],
      });
    } catch (error) {
      console.error("Error getting AI Response:", error);
      await interaction.editOriginalMessage({
        content: "❌ An error occurred while getting AI response.",
        components: [],
      });
    }
  },
});

async function getGrade(
  bot: Eris.Client,
  userID: string,
): Promise<string | null> {
  const guild = await bot.guilds.get(guildID);
  const member = await guild?.members.get(userID);
  if (!member) return null;

  for (const [grade, roleId] of Object.entries(roles)) {
    if (member.roles.includes(roleId)) return grade;
  }
  return null;
}
