import { prisma } from '../config/db.js';
import { config } from '../config/config.js';

const PACKAGES = [
  {
    name: 'MINI-PACK',
    slug: 'mini-pack',
    title: 'Idéal pour tester les améliorations IA.',
    price: 1.50,
    credits: 3,
    pricePerCredit: 0.5,
    badge: false,
    description: '≈ 3 améliorations IA',
    features: [
      '1 crédit = 1 amélioration IA',
      // 'Optimisez votre annonce en quelques secondes',
      'Optimisez votre annonce',
      'Contenu 100% modifiable',
      'Sans abonnement',
    ],
    isActive: true,
  },
  {
    name: 'PACK STANDARD',
    slug: 'pack-standard',
    title: 'Parfait pour optimiser plusieurs éléments de votre annonce.',
    price: 3.15,
    credits: 7,
    pricePerCredit: 0.45,
    badge: true,
    description: '≈ 7 améliorations IA',
    features: [
      'Tout ce qui est inclus dans le Mini Pack',
      "Plus de variantes et d'optimisations",
      'Styles avancés inclus',
      'Meilleur rapport qualité/prix',
    ],
    isActive: true,
  },
  {
    name: 'PACK PRO',
    slug: 'pack-pro',
    title: 'Conçu pour maximiser vos performances.',
    price: 6,
    credits: 15,
    pricePerCredit: 0.4,
    badge: false,
    description: '≈ 15 améliorations IA',
    features: [
      'Tout ce qui est inclus dans le Pack Standard',
      "Testez plusieurs versions d'annonces",
      'Optimisation IA avancée',
      'Prix par crédit le plus avantageux',
    ],
    isActive: true,
  },
];

export async function seedPackages() {
  const { logger } = config;

  try {
    let created = 0;
    let skipped = 0;

    for (const pkg of PACKAGES) {
      const existing = await prisma.package.findUnique({
        where: { slug: pkg.slug },
        select: { id: true, slug: true },
      });

      if (existing) {
        logger.info(`Le package existe déjà, ignoré — slug: ${pkg.slug}`);
        skipped++;
        continue;
      }

      const created_pkg = await prisma.package.create({
        data: pkg,
        select: { id: true, name: true, slug: true, price: true, credits: true },
      });

      logger.info(
        `Package créé — nom: "${created_pkg.name}" | slug: ${created_pkg.slug} | CHF ${created_pkg.price} | ${created_pkg.credits} crédits`
      );
      created++;
    }

    logger.info(
      `Seed des packages terminé — ${created} créés, ${skipped} existaient déjà`
    );
  } catch (error) {
    logger.error('Échec du seed des packages', error, 'PackageSeeder');
    throw error;
  }
}