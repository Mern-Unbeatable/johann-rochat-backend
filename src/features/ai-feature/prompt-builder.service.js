import { FEATURE_INSTRUCTIONS } from "./feature_instruction.js";

class PromptBuilderService {

    buildFeaturePrompt(generation, feature, customPrompt = null) {
        const highlights = Array.isArray(generation.highlights)
            ? generation.highlights.map((h) => `- ${h}`).join('\n')
            : String(generation.highlights);

        const instruction = feature === 'CUSTOM' && customPrompt
            ? `Tu dois transformer cette annonce selon cette instruction exacte:
"${customPrompt}"
Respecte exactement cette instruction. Garde un style professionnel suisse romand.`
            : FEATURE_INSTRUCTIONS[feature];

        return `${instruction}

ANNONCE ACTUELLE À TRANSFORMER:
===
Titre: ${generation.title}
Accroche: ${generation.hook}
Description: ${generation.description}
Points forts:
${highlights}
Infos pratiques: ${generation.practicalInfo ?? 'Non précisé'}
===

RÉPONDS UNIQUEMENT avec ce JSON valide (sans markdown):
{
  "title": "Nouveau titre adapté (max 80 caractères)",
  "hook": "Nouvelle accroche percutante (1-2 phrases)",
  "description": "Nouvelle description transformée (150-250 mots)",
  "highlights": ["Point fort 1", "Point fort 2", "Point fort 3", "Point fort 4"],
  "practicalInfo": "Infos pratiques conservées ou légèrement adaptées"
}`;
    }

    // You can add other prompt building methods here
    buildGenerationPrompt(listingData) {
        // For initial ad generation
        return `Generate an ad for: ${JSON.stringify(listingData)}`;
    }

    buildImprovementPrompt(currentAd, feedback) {
        // For improving existing ads
        return `Improve this ad based on feedback: ${feedback}\n\nAd: ${currentAd}`;
    }
}

export const promptBuilderService = new PromptBuilderService();