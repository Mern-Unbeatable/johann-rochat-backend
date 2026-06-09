
import OpenAI from 'openai';
import { prisma } from '../../config/db.js';
import { config } from '../../config/config.js';
import { Logger } from '../../config/logger.js';
import {
  NotFoundError,
  BadRequestError,
  InsufficientCreditsError,
  ForbiddenError,
} from '../../shared/globals/helpers/error-handler.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
const AI_MODEL = config.NODE_ENV === 'production' ? 'gpt-4o' : 'gpt-4o-mini';

export const FEATURE_CREDIT_COST = {
  WARMER_TONE: 1,
  SHORTEN_TEXT: 1,
  HIGHLIGHT_LOCATION: 1,
  OPTIMIZE_INVESTORS: 1,
  OPTIMIZE_AIRBNB: 1,
  MAKE_PREMIUM: 1,
  REGENERATE: 1,
};

const FEATURE_INSTRUCTIONS = {
  WARMER_TONE: `Réécris cette annonce immobilière suisse avec une tonalité plus chaleureuse et humaine.
     Rends-la plus émotionnellement engageante et accueillante, tout en restant professionnel.
     Garde TOUTES les informations factuelles (prix, surface, localisation).`,
  SHORTEN_TEXT: `Raccourcis cette annonce immobilière suisse d'environ 30-40%.
     Garde uniquement les informations essentielles: prix, surface, localisation, points clés.
     Chaque mot doit avoir de la valeur. Style professionnel suisse conservé.`,
  HIGHLIGHT_LOCATION: `Réécris cette annonce en mettant FORTEMENT en valeur la localisation et le quartier.
     Commence par valoriser l'adresse, le quartier, les transports, commerces, écoles à proximité.
     La localisation doit être le point central et le plus attractif de l'annonce.`,
  OPTIMIZE_INVESTORS: `Réécris cette annonce pour cibler spécifiquement les investisseurs immobiliers.
     Mets en avant: rendement locatif potentiel, valeur patrimoniale, stabilité du marché suisse.
     Utilise un vocabulaire financier et d'investissement. Quantifie les avantages quand possible.`,
  OPTIMIZE_AIRBNB: `Réécris cette annonce pour cibler la location courte durée Airbnb.
     Mets en avant: expérience, attractions touristiques proches, confort, équipements, accessibilité.
     Style dynamique et accueillant type "expérience voyageur". Souligne le potentiel de revenus.`,
  MAKE_PREMIUM: `Réécris cette annonce dans un style PREMIUM et luxueux, comme une grande agence suisse (Sotheby's).
     Utilise un vocabulaire élégant et distinctif. Chaque détail doit paraître exceptionnel.
     Mets en avant le prestige, l'exclusivité et la qualité supérieure du bien.`,
  REGENERATE: `Génère une version COMPLÈTEMENT NOUVELLE et créative de cette annonce.
     Utilise une structure narrative différente avec un angle totalement nouveau.
     Mets en avant des aspects différents du bien. Garde TOUTES les infos factuelles.`,
};

class GenerationService {
  constructor() {
    this.log = new Logger('GenerationService');
  }

  _getSystemPrompt() {
    return `Tu es un expert en rédaction d'annonces immobilières de luxe en Suisse romande.
Tu maîtrises parfaitement le marché immobilier suisse et rédiges des annonces professionnelles,
sobres et attractives dans le style suisse romand.
Tu réponds TOUJOURS et UNIQUEMENT en JSON valide, sans aucun texte avant ou après.`;
  }

  _formatCompleteAdText(generation) {
    let text = ` ${generation.title}\n\n`;
    text += ` ACCROCHE:\n${generation.hook}\n\n`;
    text += ` DESCRIPTION:\n${generation.description}\n\n`;
    text += ` POINTS FORTS:\n`;
    if (Array.isArray(generation.highlights)) {
      generation.highlights.forEach((h, i) => {
        text += `${i + 1}. ${h}\n`;
      });
    }
    text += `\nℹ INFORMATIONS PRATIQUES:\n${generation.practicalInfo || 'Non précisé'}\n`;
    
    if (generation.suggestions && generation.suggestions.length > 0) {
      text += `\n SUGGESTIONS:\n`;
      generation.suggestions.forEach((s, i) => {
        text += `${i + 1}. ${s}\n`;
      });
    }
    
    return text;
  }

  _buildAdPrompt(listing) {
    const propertyTypeLabels = {
      APARTMENT: 'Appartement', HOUSE: 'Maison',
      STUDIO: 'Studio', OTHER: 'Autre bien',
    };
    const conditionLabels = {
      NEW: 'Neuf', GOOD: 'Bon état',
      RENOVATED: 'Rénové', TO_RENOVATE: 'À rénover',
    };
    const exposureLabels = {
      NORTH: 'Nord', SOUTH: 'Sud',
      EAST: 'Est', WEST: 'Ouest', MIXED: 'Mixte',
    };

    return `Génère une annonce immobilière professionnelle en FRANÇAIS pour ce bien en Suisse.

DONNÉES DU BIEN:
- Type: ${propertyTypeLabels[listing.propertyType] ?? listing.propertyType}
- Localisation: ${listing.location}
- Surface: ${listing.surface ? listing.surface + ' m²' : 'Non précisé'}
- Nombre de pièces: ${listing.rooms ?? 'Non précisé'}
- Étage: ${listing.floor ?? 'Non précisé'}
- Ascenseur: ${listing.hasElevator === true ? 'Oui' : listing.hasElevator === false ? 'Non' : 'Non précisé'}
- Loyer mensuel: CHF ${listing.rent}.-${listing.charges ? ` + CHF ${listing.charges}.- de charges` : ''}
- Parking: ${listing.parkingPrice ? `CHF ${listing.parkingPrice}.-/mois` : 'Non inclus'}
- État: ${conditionLabels[listing.condition] ?? listing.condition}
- Exposition: ${exposureLabels[listing.exposure] ?? listing.exposure}
- Équipements: ${listing.equipment ?? 'Standard'}
- Disponible dès: ${listing.availableFrom ? new Date(listing.availableFrom).toLocaleDateString('fr-CH') : 'Immédiatement'}
- Animaux: ${listing.petsAllowed === true ? 'Acceptés' : listing.petsAllowed === false ? 'Non acceptés' : 'À discuter'}
- À proximité: ${listing.proximity ?? 'Non précisé'}
- Infos complémentaires: ${listing.additionalInfo ?? 'Aucune'}

RÉPONDS UNIQUEMENT avec ce JSON (sans markdown):
{
  "title": "Titre accrocheur max 80 caractères",
  "hook": "Phrase d'accroche 1-2 phrases",
  "description": "Description complète 150-250 mots style suisse romand",
  "highlights": ["Point fort 1", "Point fort 2", "Point fort 3", "Point fort 4"],
  "practicalInfo": "Loyer CHF X.- + charges CHF Y.-, disponible dès [date]",
  "score": 78,
  "suggestions": ["Conseil 1 si données manquantes"]
}`;
  }

  _buildFeaturePrompt(generation, feature, customPrompt = null) {
    const highlights = Array.isArray(generation.highlights)
      ? generation.highlights.map((h) => `- ${h}`).join('\n')
      : JSON.stringify(generation.highlights);

    const instruction = feature === 'CUSTOM' && customPrompt
      ? `Tu dois transformer cette annonce selon cette instruction spécifique de l'utilisateur:
"${customPrompt}"
Respecte exactement cette instruction tout en gardant un style professionnel suisse romand.
Garde toutes les informations factuelles importantes.`
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
  "title": "Nouveau titre (max 80 caractères)",
  "hook": "Nouvelle accroche (1-2 phrases)",
  "description": "Nouvelle description transformée (150-250 mots)",
  "highlights": ["Point fort 1", "Point fort 2", "Point fort 3", "Point fort 4"],
  "practicalInfo": "Infos pratiques conservées ou adaptées",
  "suggestions": ["Suggestions optionnelles"]
}`;
  }

  async _callOpenAI(userPrompt, meta = {}) {
    const start = Date.now();
    this.log.info('OpenAI request started', {
      feature: meta.feature || 'BASE',
      listingId: meta.listingId || null,
      generationId: meta.generationId || null,
    });

    try {
      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        max_tokens: 1500,
        temperature: 0.72,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: this._getSystemPrompt() },
          { role: 'user', content: userPrompt },
        ],
      });

      const duration = Date.now() - start;
      const text = response.choices[0]?.message?.content ?? '';

      this.log.info('OpenAI completed', { duration });

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      try {
        const parsed = JSON.parse(cleaned);
        return parsed;
      } catch (err) {
        this.log.error('JSON parse failed', { raw: cleaned.substring(0, 500) });
        throw new BadRequestError('AI returned invalid JSON. Please try again.');
      }
    } catch (error) {
      this.log.error('OpenAI error', error);
      throw new BadRequestError(`AI generation failed: ${error.message}`);
    }
  }

  _buildListingDataString(listing) {
    const lines = [
      `Type: ${listing.propertyType}`,
      `Localisation: ${listing.location}`,
      `Loyer: CHF ${listing.rent}.-`,
    ];
    if (listing.surface) lines.push(`Surface: ${listing.surface} m²`);
    if (listing.rooms) lines.push(`Pièces: ${listing.rooms}`);
    if (listing.floor) lines.push(`Étage: ${listing.floor}`);
    if (listing.hasElevator != null) lines.push(`Ascenseur: ${listing.hasElevator ? 'Oui' : 'Non'}`);
    if (listing.charges) lines.push(`Charges: CHF ${listing.charges}.-`);
    if (listing.parkingPrice) lines.push(`Parking: CHF ${listing.parkingPrice}.-/mois`);
    if (listing.condition) lines.push(`État: ${listing.condition}`);
    if (listing.exposure) lines.push(`Exposition: ${listing.exposure}`);
    if (listing.equipment) lines.push(`Équipements: ${listing.equipment}`);
    if (listing.availableFrom) lines.push(`Disponible: ${new Date(listing.availableFrom).toLocaleDateString('fr-CH')}`);
    if (listing.petsAllowed != null) lines.push(`Animaux: ${listing.petsAllowed ? 'Acceptés' : 'Non acceptés'}`);
    if (listing.proximity) lines.push(`Proximité: ${listing.proximity}`);
    if (listing.additionalInfo) lines.push(`Info: ${listing.additionalInfo}`);
    return lines.join('\n');
  }

  async generateAd(listingId, userId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { generations: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!listing) throw new NotFoundError('Listing not found');
    if (listing.userId !== userId) throw new BadRequestError('Access denied');
    if (listing.status !== 'UNLOCKED') {
      throw new BadRequestError('Payment required. Please unlock this listing first.');
    }

    const nextVersion = (listing.generations[0]?.version ?? 0) + 1;

    const template = await prisma.promptTemplate.findFirst({
      where: { isActive: true },
      select: { id: true, content: true },
    });

    const userPrompt = template?.content
      ? template.content.replace('{LISTING_DATA}', this._buildListingDataString(listing))
      : this._buildAdPrompt(listing);

    const aiResult = await this._callOpenAI(userPrompt, { listingId });
    
    const fullText = this._formatCompleteAdText(aiResult);

    const generation = await prisma.generation.create({
      data: {
        listingId,
        title: aiResult.title ?? 'Annonce immobilière',
        hook: aiResult.hook ?? '',
        description: aiResult.description ?? '',
        highlights: Array.isArray(aiResult.highlights) ? aiResult.highlights : [],
        practicalInfo: aiResult.practicalInfo ?? null,
        score: typeof aiResult.score === 'number' ? Math.min(100, Math.max(0, aiResult.score)) : 70,
        suggestions: Array.isArray(aiResult.suggestions) ? aiResult.suggestions : [],
        version: nextVersion,
        isUnlocked: true,
        promptTemplateId: template?.id ?? null,
        generatedText: fullText, 
      },
    });

    await prisma.listing.update({
      where: { id: listingId },
      data: { score: generation.score, title: generation.title },
    });

    return generation;
  }

  async useAiFeature(userId, listingId, generationId, feature, customPrompt = null) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true },
    });
    if (!user) throw new NotFoundError('User not found');

    const creditCost = FEATURE_CREDIT_COST[feature] ?? 1;
    if (user.credits < creditCost) {
      throw new InsufficientCreditsError(
        `Insufficient credits. Need ${creditCost} credit. Please purchase a package.`
      );
    }

    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
      include: { listing: { select: { userId: true, id: true } } },
    });
    if (!generation) throw new NotFoundError('Generation not found');
    if (generation.listing.userId !== userId) throw new BadRequestError('Access denied');
    if (generation.listingId !== listingId) throw new BadRequestError('Generation mismatch');

    if (feature === 'CUSTOM' && !customPrompt) {
      throw new BadRequestError('customPrompt is required for CUSTOM feature');
    }

    const prompt = this._buildFeaturePrompt(generation, feature, customPrompt);
    const aiResult = await this._callOpenAI(prompt, { feature, listingId, generationId });
    
    // নতুন সম্পূর্ণ টেক্সট তৈরি করুন
    const fullText = this._formatCompleteAdText(aiResult);

    const [updatedUser, , aiFeatureUsage, updatedGeneration] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { credits: { decrement: creditCost } },
      }),
      prisma.creditTransaction.create({
        data: {
          userId,
          amount: -creditCost,
          type: 'USAGE',
          reference: `ai_feature:${feature}:gen:${generationId}`,
        },
      }),
      prisma.aiFeatureUsage.create({
        data: {
          userId, listingId, generationId, feature, creditCost,
          resultText: JSON.stringify(aiResult),
        },
      }),
      prisma.generation.update({
        where: { id: generationId },
        data: {
          title: aiResult.title,
          hook: aiResult.hook,
          description: aiResult.description,
          highlights: aiResult.highlights,
          practicalInfo: aiResult.practicalInfo,
          suggestions: aiResult.suggestions || generation.suggestions,
          generatedText: fullText, // সম্পূর্ণ টেক্সট আপডেট
          updatedAt: new Date(),
        },
      }),
    ]);

    return {
      result: aiResult,
      fullText: fullText,
      feature,
      customPrompt: customPrompt ?? null,
      creditCost,
      usageId: aiFeatureUsage.id,
      creditsRemaining: updatedUser.credits,
    };
  }

  // update generatedText 
  async updateGenerationText(generationId, newText, adminId) {
    // Verify admin权限
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });
    
    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenError('Only admins can update generation text');
    }
    
    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
    });
    
    if (!generation) {
      throw new NotFoundError('Generation not found');
    }
    
    const updated = await prisma.generation.update({
      where: { id: generationId },
      data: {
        generatedText: newText,
        updatedAt: new Date(),
      },
    });
    
    this.log.info(`Generation ${generationId} text updated by admin ${adminId}`);
    
    return updated;
  }

  // generation find from Improvement request 
  async getGenerationByImprovementId(improvementId, adminId) {
    const improvement = await prisma.improvementRequest.findUnique({
      where: { id: improvementId },
      include: {
        listing: {
          include: {
            generations: {
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    
    if (!improvement) {
      throw new NotFoundError('Improvement request not found');
    }
    
    const latestGeneration = improvement.listing.generations[0];
    
    if (!latestGeneration) {
      throw new NotFoundError('No generation found for this listing');
    }
    
    return latestGeneration;
  }

  async getListingGenerations(listingId, userId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { userId: true },
    });
    if (!listing) throw new NotFoundError('Listing not found');
    if (listing.userId !== userId) throw new BadRequestError('Access denied');

    return prisma.generation.findMany({
      where: { listingId },
      orderBy: { version: 'desc' },
    });
  }

  async getGenerationById(id, userId) {
    const generation = await prisma.generation.findUnique({
      where: { id },
      include: {
        listing: { select: { userId: true, location: true } },
        aiFeatureUsages: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!generation) throw new NotFoundError('Generation not found');
    if (generation.listing.userId !== userId) throw new BadRequestError('Access denied');
    return generation;
  }

  async getAllGenerations(queryParams = {}) {
    const { default: PrismaQueryBuilder } = await import('../../shared/globals/helpers/query-builder.js');
    const queryBuilder = new PrismaQueryBuilder(prisma.generation, queryParams, {
      searchableFields: ['title', 'description'],
      defaultSort: { createdAt: 'desc' },
      defaultLimit: 10,
      maxLimit: 100,
      omitFields: {},
    });
    queryBuilder._include = {
      listing: { select: { id: true, location: true, userId: true, status: true } },
    };
    return queryBuilder.search().sort().paginate().execute('generations');
  }

  async adminRegenerateAd(listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundError('Listing not found');

    const lastGen = await prisma.generation.findFirst({
      where: { listingId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (lastGen?.version ?? 0) + 1;

    const aiResult = await this._callOpenAI(this._buildAdPrompt(listing), { listingId });
    const fullText = this._formatCompleteAdText(aiResult);

    const generation = await prisma.generation.create({
      data: {
        listingId,
        title: aiResult.title ?? 'Annonce immobilière',
        hook: aiResult.hook ?? '',
        description: aiResult.description ?? '',
        highlights: Array.isArray(aiResult.highlights) ? aiResult.highlights : [],
        practicalInfo: aiResult.practicalInfo ?? null,
        score: typeof aiResult.score === 'number' ? aiResult.score : 70,
        suggestions: Array.isArray(aiResult.suggestions) ? aiResult.suggestions : [],
        version: nextVersion,
        isUnlocked: true,
        generatedText: fullText,
      },
    });

    await prisma.listing.update({
      where: { id: listingId },
      data: { score: generation.score, title: generation.title },
    });

    return generation;
  }
}

export const generationService = new GenerationService();