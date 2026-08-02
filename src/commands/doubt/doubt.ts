import Eris from "eris";
import { Command } from "../../types/command";
import { guildID, imgbbApiKey, geminiAPIKey } from "../../secret/config.json";
import roles from "../../secret/roles.json";
import fetch from "node-fetch";
import channels from "../../secret/channels.json";
import { databaseManager } from "../../lib/database";
import { blue } from "../../secret/emoji.json";
import fs from "fs";
import { generateNvidiaNim, cleanTitle } from "./nvidiaNim";

export default (bot: Eris.Client): Command =>
  ({
    name: "doubt",
    description: "Ask a doubt to the respective community",
    type: "interactionCreate",
    interactionType: Eris.Constants.ApplicationCommandTypes.CHAT_INPUT,
    bot,
    options: [
      {
        name: "subject",
        description: "Subject of the doubt",
        type: Eris.Constants.ApplicationCommandOptionTypes.STRING,
        autocomplete: true,
        required: true,
      },
      {
        name: "doubt",
        description: "Your doubt",
        type: Eris.Constants.ApplicationCommandOptionTypes.STRING,
        required: true,
      },
      {
        name: "attachment",
        description: "Attachment of the doubt",
        type: 11,
        required: false,
      },
    ],
    async execute(interaction: Eris.Interaction): Promise<void> {
      if (
        interaction.type !== Eris.Constants.InteractionTypes.APPLICATION_COMMAND
      )
        return;
      const commandInteraction = interaction as Eris.CommandInteraction;

      try {
        await commandInteraction.defer();

        const subjectOption = commandInteraction.data.options?.find(
          (opt) => opt.name === "subject",
        ) as Eris.InteractionDataOptionWithValue;
        const doubtOption = commandInteraction.data.options?.find(
          (opt) => opt.name === "doubt",
        ) as Eris.InteractionDataOptionWithValue;
        const attachmentOption = commandInteraction.data.options?.find(
          (opt) => opt.name === "attachment",
        ) as Eris.InteractionDataOptionWithValue | undefined;

        const subject = subjectOption?.value;
        const doubt = doubtOption?.value;
        const grade = await getGrade(
          bot,
          commandInteraction.member?.user.id || "",
        );

        let attachmentUrl: string | undefined = undefined;
        let mimeType = "image/png";
        let base64Image;
        if (attachmentOption && commandInteraction.data.resolved) {
          const resolved: any = commandInteraction.data.resolved;
          const discordUrl =
            resolved.attachments?.[attachmentOption.value as string]?.url;

          if (discordUrl) {
            const response = await fetch(discordUrl);
            if (!response.ok)
              throw new Error(`Failed to fetch image: ${response.statusText}`);
            const buffer = await Buffer.from(await response.arrayBuffer());
            base64Image = buffer.toString("base64");
            mimeType = response.headers.get("Content-Type") || "image/png";

            const formData = new URLSearchParams();
            formData.append("key", imgbbApiKey);
            formData.append("image", base64Image);

            const imgbbResponse = await fetch(
              "https://api.imgbb.com/1/upload",
              {
                method: "POST",
                body: formData,
              },
            );
            const imgbbData = (await imgbbResponse.json()) as {
              success: boolean;
              data: { url: string };
            };

            if (imgbbData.success) {
              attachmentUrl = imgbbData.data.url;
            } else {
              console.error("ImgBB upload failed:", imgbbData);
              attachmentUrl = undefined;
            }
          }
        }

        const channelID = channels[subject as string]["id"] as string;
        const channel = bot.guilds
          .get(guildID)
          ?.channels.get(channelID) as Eris.TextableChannel;
        if (!channel) {
          await commandInteraction.createFollowup({
            content: "Failed to find the channel for the subject.",
            flags: Eris.Constants.MessageFlags.EPHEMERAL,
          });
          return;
        }
        const subjectName = channels[subject as string]["subject"] as string;
        const gradeNum = channels[subject as string]["grade"] as string;

        const roleIDs = channels[subject as string]["helperrole"] as string[];

        const roleNames = roleIDs
          .map((id) => bot.guilds.get(guildID)?.roles.get(id)?.name)
          .filter((name) => name)
          .join(" ");
        const doubtId = await databaseManager.generateDoubtID();

        let rawTitle = `${commandInteraction.member?.user.username} asks:`;
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
              ${doubt}

              Context:
              - Grade: ${gradeNum}
              - Subject: ${subjectName}

              Rules:
              - Output ONLY the title.
              - Maximum 20 characters.
              - Capture the actual topic or problem.
              - CRITICAL: Do NOT answer, solve, explain, or provide the result/formula/solution of the question in the title. The title must only state what the doubt is about (e.g., "Surface Tension on accelerating liquid", not "Angle of surface is tan(theta)").
              - Do not add "Grade ${gradeNum}", "${subjectName}", "Doubt", "Question", "Help", or any extra labels.
              - Do not invent information.
              - Make it read like a natural forum thread title.
              - Do not output any commas or full stops in the title. Leave it as a phrase or a few words that describe the topic of the question.`,
            imageUrl: attachmentUrl,
            maxTokens: 64,
          });
        } catch (aiError) {
          console.error(
            "AI Title generation failed, using generic title:",
            aiError,
          );
        }

        const title = cleanTitle(rawTitle);
        //<@${commandInteraction.member?.user.id}> ${roleNames} | This message will be sent in <#${channelID}>
        const message = await bot.createMessage(commandInteraction.channel.id, {
          content: `||${roleNames}|| | <@${commandInteraction.member?.user.id}> asks:`,
          embed: {
            description: [
              `╭ Grade ${gradeNum} • **${title}** • Doubt ID: \`${doubtId}\``,
              `> ${doubt}`,
            ].join("\n"),
            image: {
              url: attachmentUrl ? attachmentUrl : undefined,
            },
            color: 0xffffff,
            footer: {
              text: `${doubtId}`,
            },
          },
          components: [
            {
              type: Eris.Constants.ComponentTypes.ACTION_ROW,
              components: [
                {
                  type: Eris.Constants.ComponentTypes.BUTTON,
                  style: Eris.Constants.ButtonStyles.DANGER,
                  custom_id: "doubt_delete",
                  emoji: {
                    id: null,
                    name: "🗑️",
                  },
                },
                {
                  type: Eris.Constants.ComponentTypes.BUTTON,
                  style: Eris.Constants.ButtonStyles.PRIMARY,
                  custom_id: "doubt_rotate_anticlockwise",
                  emoji: {
                    id: null,
                    name: "↪️",
                  },
                  disabled: !attachmentUrl,
                },
                {
                  type: Eris.Constants.ComponentTypes.BUTTON,
                  style: Eris.Constants.ButtonStyles.SECONDARY,
                  custom_id: "doubt_edit",
                  emoji: {
                    id: null,
                    name: "✏️",
                  },
                },
                {
                  type: Eris.Constants.ComponentTypes.BUTTON,
                  style: Eris.Constants.ButtonStyles.PRIMARY,
                  custom_id: "doubt_rotate_clockwise",
                  emoji: {
                    id: null,
                    name: "↩️",
                  },
                  disabled: !attachmentUrl,
                },
                {
                  type: Eris.Constants.ComponentTypes.BUTTON,
                  style: Eris.Constants.ButtonStyles.SUCCESS,
                  custom_id: "doubt_ai",
                  emoji: {
                    id: null,
                    name: "🤖",
                  },
                },
              ],
            },
          ],
        });

        const messageId = message.id;
        const channelId = message.channel.id;

        await databaseManager.addDoubt(
          doubtId,
          commandInteraction.member?.user.id || "",
          doubt as string,
          messageId,
          channelId,
          subject as string,
          grade as string,
          attachmentUrl ? attachmentUrl : undefined,
        );

        await commandInteraction.createFollowup({
          content: `Your doubt has been sent to <#${channelID}>! Check it out here`,
        });
      } catch (error) {
        console.error("Error asking doubt:", error);
        try {
          await commandInteraction.createFollowup({
            content: "Failed to ask doubt. Try again later!",
            flags: Eris.Constants.MessageFlags.EPHEMERAL,
          });
        } catch (followupError) {
          console.error("Error sending error message:", followupError);
        }
      }
    },
    autocomplete: async (interaction: Eris.AutocompleteInteraction) => {
      await interaction.acknowledge(
        await getSubjects(bot, interaction.member?.user.id || ""),
      );
    },
  }) as any;

const gradeSubjects: Record<string, string[]> = {
  "9": [
    "Mathematics",
    "Science",
    "Social Science",
    "English",
    "English Communicative",
    "Hindi A",
    "Hindi B",
    "Sanskrit",
    "Languages",
    "Computer Science",
    "Additional",
  ],
  "10": [
    "Mathematics",
    "Science",
    "Social Science",
    "English",
    "English Communicative",
    "Hindi A",
    "Hindi B",
    "Sanskrit",
    "Languages",
    "Computer Science",
    "Additional",
  ],
  pcm11: [
    "Mathematics",
    "Physics",
    "Chemistry",
    "English",
    "Hindi",
    "Languages",
    "Physical Education",
    "Computer Science",
    "Additional",
  ],
  pcb11: [
    "Biology",
    "Physics",
    "Chemistry",
    "English",
    "Hindi",
    "Languages",
    "Physical Education",
    "Computer Science",
    "Additional",
  ],
  commerce11: [
    "Business Studies",
    "Accountancy",
    "Economics",
    "English",
    "Hindi",
    "Languages",
    "Physical Education",
    "Computer Science",
    "Additional",
  ],
  humanities11: [
    "History",
    "Geography",
    "Political Science",
    "Economics",
    "Sociology",
    "English",
    "Hindi",
    "Languages",
    "Physical Education",
    "Computer Science",
    "Additional",
  ],
  pcm12: [
    "Mathematics",
    "Physics",
    "Chemistry",
    "English",
    "Hindi",
    "Languages",
    "Physical Education",
    "Computer Science",
    "Additional",
  ],
  pcb12: [
    "Biology",
    "Physics",
    "Chemistry",
    "English",
    "Hindi",
    "Languages",
    "Physical Education",
    "Computer Science",
    "Additional",
  ],
  commerce12: [
    "Business Studies",
    "Accountancy",
    "Economics",
    "English",
    "Hindi",
    "Languages",
    "Physical Education",
    "Computer Science",
    "Additional",
  ],
  humanities12: [
    "History",
    "Geography",
    "Political Science",
    "Economics",
    "Sociology",
    "English",
    "Hindi",
    "Languages",
    "Physical Education",
    "Computer Science",
    "Additional",
  ],
};

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

async function getSubjects(
  bot: Eris.Client,
  userID: string,
): Promise<Eris.ApplicationCommandOptionChoice<unknown>[]> {
  const grade = await getGrade(bot, userID);
  if (!grade || !gradeSubjects[grade]) return [];

  const gradeNum = grade.match(/\d+/)?.[0] || "";
  return gradeSubjects[grade].map((subject) => ({
    name: `${subject} (${gradeNum}th)`,
    value: `${subject.toLowerCase().replace(/\s+/g, "")}_${gradeNum}`,
  }));
}
