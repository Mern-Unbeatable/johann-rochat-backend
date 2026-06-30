import OpenAI from 'openai';
import { config } from '../../config/config.js';
import { BadRequestError } from '../../shared/globals/helpers/error-handler.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
const AI_MODEL = config.NODE_ENV === 'production' ? 'gpt-4o' : 'gpt-4o-mini';

class OpenAIService {

  // Format complete ad text
  formatCompleteAdText(result) {
    let text = ` ${result.title}\n\n`;
    text += ` ACCROCHE:\n${result.hook}\n\n`;
    text += ` DESCRIPTION:\n${result.description}\n\n`;
    text += ` POINTS FORTS:\n`;
    if (Array.isArray(result.highlights)) {
      result.highlights.forEach((h, i) => {
        text += `${i + 1}. ${h}\n`;
      });
    }
    text += `\n INFORMATIONS PRATIQUES:\n${result.practicalInfo || 'Non précisé'}\n`;

    if (result.suggestions && result.suggestions.length > 0) {
      text += `\n SUGGESTIONS:\n`;
      result.suggestions.forEach((s, i) => {
        text += `${i + 1}. ${s}\n`;
      });
    }

    return text;
  }

  async callOpenAI(userPrompt, meta = {}) {
    const start = Date.now();

    try {

      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        max_tokens: 1500,
        temperature: 0.72,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en rédaction d'annonces immobilières de luxe en Suisse romande.
              Tu maîtrises parfaitement le marché immobilier suisse et rédiges des annonces professionnelles,
              sobres et attractives dans le style suisse romand.
              Tu réponds TOUJOURS et UNIQUEMENT en JSON valide, sans au    cun texte avant ou après.`,
          },
          { role: 'user', content: userPrompt },
        ],
      });

      const duration = Date.now() - start;
      const text = response.choices[0]?.message?.content ?? '';

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      try {
        const parsed = JSON.parse(cleaned);
        return parsed;
      } catch {
        console.error(' JSON PARSE ERROR:\n', cleaned);
        throw new BadRequestError('AI returned invalid JSON. Please try again.');
      }

    } catch (error) {
      console.error(' OPENAI ERROR:', error.message);
      if (error instanceof BadRequestError || error instanceof InsufficientCreditsError) throw error;
      if (error?.status === 429) throw new BadRequestError('AI busy. Please try again.');
      if (error?.status === 401) throw new BadRequestError('Invalid API key.');
      if (error?.code === 'insufficient_quota') throw new BadRequestError('Quota exceeded.');
      throw new BadRequestError(`AI failed: ${error.message}`);
    }
  }
}

export const openaiService = new OpenAIService();