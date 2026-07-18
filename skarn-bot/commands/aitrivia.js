const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const SYSTEM_PROMPT = `You are a trivia question generator. Generate a single trivia question with 4 multiple choice answers (A, B, C, D). One answer must be correct. Return ONLY valid JSON in this exact format, nothing else:
{"question":"...","answers":["A. ...","B. ...","C. ...","D. ..."],"correct":0,"funFact":"..."}

The "correct" field is the index (0-3) of the correct answer. "funFact" is a short interesting fact about the answer.`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aitrivia')
    .setDescription('AI-powered trivia on any topic')
    .addStringOption(option =>
      option.setName('topic')
        .setDescription('Topic for questions (e.g. space, movies, history)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('difficulty')
        .setDescription('Difficulty level')
        .setRequired(false)
        .addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' },
        )),
  async execute(interaction) {
    const topic = interaction.options.getString('topic') || 'general knowledge';
    const difficulty = interaction.options.getString('difficulty') || 'medium';

    if (!process.env.OPENAI_API_KEY) {
      return interaction.reply({ content: 'AI is not configured. Add OPENAI_API_KEY.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Generate a ${difficulty} trivia question about: ${topic}. Return ONLY the JSON, no markdown, no code blocks.` },
        ],
        max_tokens: 300,
        temperature: 0.9,
      });

      let content = completion.choices[0].message.content.trim();
      // Strip markdown code blocks if present
      content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

      let trivia;
      try {
        trivia = JSON.parse(content);
      } catch {
        await interaction.editReply({ content: 'Failed to generate question. Try again.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Trivia — ${topic}`)
        .setDescription(trivia.question)
        .addFields(
          { name: difficulty.charAt(0).toUpperCase() + difficulty.slice(1), value: '\u200b', inline: true },
        )
        .setColor(0x00e5ff)
        .setFooter({ text: 'You have 30 seconds to answer!' });

      const rows = [];
      for (let i = 0; i < trivia.answers.length; i += 2) {
        const row = new ActionRowBuilder();
        for (let j = i; j < Math.min(i + 2, trivia.answers.length); j++) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`aitrivia_${j}`)
              .setLabel(trivia.answers[j])
              .setStyle(ButtonStyle.Secondary),
          );
        }
        rows.push(row);
      }

      const msg = await interaction.editReply({ embeds: [embed], components: rows });

      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });

      collector.on('collect', async i => {
        const answerIndex = parseInt(i.customId.split('_')[1]);
        const isCorrect = answerIndex === trivia.correct;

        const resultEmbed = new EmbedBuilder()
          .setTitle(isCorrect ? 'Correct!' : 'Wrong!')
          .setDescription(trivia.question)
          .addFields(
            { name: 'Your Answer', value: trivia.answers[answerIndex], inline: true },
            { name: 'Correct Answer', value: trivia.answers[trivia.correct], inline: true },
            { name: 'Fun Fact', value: trivia.funFact || 'N/A' },
          )
          .setColor(isCorrect ? 0x2ecc71 : 0xe74c3c);

        await i.update({ embeds: [resultEmbed], components: [] });
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          const timeEmbed = new EmbedBuilder()
            .setTitle("Time's up!")
            .setDescription(trivia.question)
            .addFields(
              { name: 'Correct Answer', value: trivia.answers[trivia.correct] },
              { name: 'Fun Fact', value: trivia.funFact || 'N/A' },
            )
            .setColor(0xf39c12);
          interaction.editReply({ embeds: [timeEmbed], components: [] });
        }
      });
    } catch (error) {
      console.error('AI trivia error:', error);
      await interaction.editReply({ content: 'Failed to generate trivia. Try again.', ephemeral: true });
    }
  },
};
