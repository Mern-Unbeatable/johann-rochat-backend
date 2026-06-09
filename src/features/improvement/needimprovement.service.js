
// import { prisma } from '../../config/db.js';
// import {
//   NotFoundError,
//   BadRequestError,
//   ForbiddenError,
// } from '../../shared/globals/helpers/error-handler.js';
// import PrismaQueryBuilder from '../../shared/globals/helpers/query-builder.js';
// import { Logger } from '../../config/logger.js';
// import { generationService } from '../generation/generation.service.js';

// const log = new Logger('ImprovementService');

// const VALID_LISTING_FIELDS = [
//   'location', 'listingName', 'propertyType', 'surface', 'rooms',
//   'floor', 'hasElevator', 'rent', 'charges', 'parkingPrice',
//   'condition', 'exposure', 'equipment', 'availableFrom',
//   'petsAllowed', 'proximity', 'additionalInfo', 'title', 'description',
// ];

// const NUMERIC_FIELDS  = ['surface', 'rooms', 'rent', 'charges', 'parkingPrice'];
// const BOOLEAN_FIELDS  = ['hasElevator', 'petsAllowed'];
// const DATE_FIELDS     = ['availableFrom'];

// class ImprovementService {

//   async createRequest(userId, { listingId, userNote, paymentId }) {
//     const listing = await prisma.listing.findUnique({
//       where: { id: listingId },
//       select: { userId: true, status: true },
//     });
//     if (!listing) throw new NotFoundError('Listing not found');
//     if (listing.userId !== userId) throw new ForbiddenError('Access denied');

//     const existing = await prisma.improvementRequest.findFirst({
//       where: { listingId, userId, status: { in: ['PENDING', 'IN_REVIEW', 'SUGGESTION_SENT'] } },
//     });
//     if (existing) throw new BadRequestError('You already have an active improvement request for this listing');

//     return prisma.$transaction(async (tx) => {
//       const request = await tx.improvementRequest.create({
//         data: { userId, listingId, paymentId: paymentId ?? null, userNote: userNote ?? null, status: 'PENDING' },
//         include: { listing: { select: { id: true, location: true, listingName: true, status: true } } },
//       });
//       await tx.listing.update({ where: { id: listingId }, data: { status: 'IMPROVEMENT_REQUESTED' } });
//       log.info(`Improvement request created: ${request.id} for listing ${listingId}`);
//       return request;
//     });
//   }

//   async getUserRequests(userId, queryParams = {}) {
//     const queryBuilder = new PrismaQueryBuilder(prisma.improvementRequest, queryParams, {
//       defaultSort: { createdAt: 'desc' }, defaultLimit: 10, maxLimit: 50, omitFields: {},
//     });
//     queryBuilder._where.userId = userId;
//     queryBuilder._include = {
//       listing: {
//         select: {
//           id: true, location: true, listingName: true, status: true, propertyType: true,
//           generations: {
//             orderBy: { createdAt: 'desc' }, take: 1,
//             select: { id: true, title: true, generatedText: true, score: true, version: true, isUnlocked: true, createdAt: true, updatedAt: true },
//           },
//         },
//       },
//       suggestions: { orderBy: { createdAt: 'asc' } },
//     };
//     return queryBuilder.sort().paginate().execute('requests');
//   }

//   async getRequestById(requestId, userId, isAdmin = false) {
//     const request = await prisma.improvementRequest.findUnique({
//       where: { id: requestId },
//       include: {
//         listing: {
//           select: {
//             id: true, location: true, listingName: true, status: true, propertyType: true,
//             generations: {
//               orderBy: { createdAt: 'desc' }, take: 1,
//               select: { id: true, title: true, generatedText: true, score: true, version: true, isUnlocked: true, createdAt: true, updatedAt: true },
//             },
//           },
//         },
//         suggestions: { orderBy: { createdAt: 'asc' } },
//         payment: { select: { id: true, amount: true, status: true, createdAt: true } },
//         user: { select: { id: true, name: true, email: true } },
//       },
//     });
//     if (!request) throw new NotFoundError('Improvement request not found');
//     if (!isAdmin && request.userId !== userId) throw new ForbiddenError('Access denied');
//     return request;
//   }

//   async applyUserSuggestion(userId, requestId, { suggestionId, newValue }) {
//     // ── 1. Request check ──
//     const request = await prisma.improvementRequest.findUnique({
//       where: { id: requestId },
//       select: { userId: true, listingId: true, status: true },
//     });
//     if (!request) throw new NotFoundError('Request not found');
//     if (request.userId !== userId) throw new ForbiddenError('Access denied');
//     if (request.status !== 'SUGGESTION_SENT') {
//       throw new BadRequestError('Suggestions can only be applied when status is SUGGESTION_SENT');
//     }

//     // ── 2. Suggestion check ──
//     const suggestion = await prisma.improvementSuggestion.findUnique({ where: { id: suggestionId } });
//     if (!suggestion || suggestion.improvementRequestId !== requestId) {
//       throw new NotFoundError('Suggestion not found in this request');
//     }
//     if (suggestion.isApplied) throw new BadRequestError('This suggestion has already been applied');

//     const fieldName = suggestion.fieldName;
//     const isValidListingField = VALID_LISTING_FIELDS.includes(fieldName);

//     // ── 3. Value conversion ──
//     let convertedValue = newValue;
//     if (isValidListingField) {
//       if (NUMERIC_FIELDS.includes(fieldName)) {
//         convertedValue = parseFloat(newValue);
//         if (isNaN(convertedValue)) throw new BadRequestError(`${fieldName} must be a valid number`);
//       } else if (BOOLEAN_FIELDS.includes(fieldName)) {
//         convertedValue = newValue === 'true' || newValue === true;
//       } else if (DATE_FIELDS.includes(fieldName)) {
//         convertedValue = new Date(newValue);
//         if (isNaN(convertedValue.getTime())) throw new BadRequestError(`${fieldName} must be a valid date`);
//       }
//     }

//     // ── 4. DB update: listing field + suggestion applied ──
//     await prisma.$transaction(async (tx) => {
//       if (isValidListingField) {
//         await tx.listing.update({
//           where: { id: request.listingId },
//           data: { [fieldName]: convertedValue },
//         });
//       }
//       await tx.improvementSuggestion.update({
//         where: { id: suggestionId },
//         data: { isApplied: true, appliedAt: new Date() },
//       });
//     });

//     // from OpenAI generatedText
//     try {
//       const updatedListing = await prisma.listing.findUnique({
//         where: { id: request.listingId },
//       });

//       // Latest generation find
//       const latestGen = await prisma.generation.findFirst({
//         where: { listingId: request.listingId },
//         orderBy: { version: 'desc' },
//       });

//       if (updatedListing && latestGen) {
//         // from OpenAI ad text generate 
//         const adPrompt = generationService._buildAdPrompt(updatedListing);
//         const aiResult = await generationService._callOpenAI(adPrompt, {
//           listingId: request.listingId,
//           feature: 'SUGGESTION_REGENERATE',
//         });

//         //  full text build 
//         const newGeneratedText = generationService._formatCompleteAdText(aiResult);

//         // Existing generation update for new reqord make
//         await prisma.generation.update({
//           where: { id: latestGen.id },
//           data: {
//             title: aiResult.title ?? latestGen.title,
//             hook: aiResult.hook ?? latestGen.hook,
//             description: aiResult.description ?? latestGen.description,
//             highlights: Array.isArray(aiResult.highlights) ? aiResult.highlights : latestGen.highlights,
//             practicalInfo: aiResult.practicalInfo ?? latestGen.practicalInfo,
//             suggestions: Array.isArray(aiResult.suggestions) ? aiResult.suggestions : latestGen.suggestions,
//             generatedText: newGeneratedText,
//           },
//         });

//         // Listing score/title update
//         if (aiResult.score) {
//           await prisma.listing.update({
//             where: { id: request.listingId },
//             data: { score: aiResult.score, title: aiResult.title },
//           });
//         }

//         log.info(`Generation regenerated after suggestion apply for listing ${request.listingId}`);
//       }
//     } catch (aiError) {
//       log.error('AI regeneration failed after suggestion apply (non-critical):', aiError.message);
//     }

//     log.info(`Suggestion ${suggestionId} applied: field="${fieldName}" value="${newValue}"`);

//     return {
//       applied: true,
//       suggestionId,
//       fieldName,
//       newValue: convertedValue,
//       listingFieldUpdated: isValidListingField,
//     };
//   }

//   async getAllRequests(queryParams = {}) {
//     const queryBuilder = new PrismaQueryBuilder(prisma.improvementRequest, queryParams, {
//       defaultSort: { createdAt: 'desc' }, defaultLimit: 10, maxLimit: 100, omitFields: {},
//     });
//     queryBuilder._include = {
//       user: { select: { id: true, name: true, email: true } },
//       listing: {
//         select: { id: true, location: true, listingName: true, status: true, propertyType: true, rent: true, surface: true, rooms: true },
//       },
//       suggestions: { orderBy: { createdAt: 'asc' } },
//     };
//     return queryBuilder.filter().sort().paginate().execute('requests');
//   }

//   async updateStatus(requestId, { status, adminNote }) {
//     const request = await prisma.improvementRequest.findUnique({
//       where: { id: requestId }, select: { id: true, listingId: true },
//     });
//     if (!request) throw new NotFoundError('Improvement request not found');

//     const listingStatusMap = {
//       IN_REVIEW: 'IMPROVEMENT_IN_REVIEW',
//       SUGGESTION_SENT: 'IMPROVEMENT_IN_REVIEW',
//       COMPLETED: 'IMPROVEMENT_DONE',
//       REJECTED: 'UNLOCKED',
//     };

//     return prisma.$transaction(async (tx) => {
//       const updated = await tx.improvementRequest.update({
//         where: { id: requestId },
//         data: {
//           status,
//           adminNote: adminNote ?? undefined,
//           resolvedAt: ['COMPLETED', 'REJECTED'].includes(status) ? new Date() : undefined,
//         },
//         include: {
//           suggestions: true,
//           listing: { select: { id: true, location: true, listingName: true, status: true } },
//           user: { select: { id: true, name: true, email: true } },
//         },
//       });
//       if (listingStatusMap[status]) {
//         await tx.listing.update({ where: { id: request.listingId }, data: { status: listingStatusMap[status] } });
//       }
//       log.info(`Request ${requestId} status updated to ${status}`);
//       return updated;
//     });
//   }

//   async addSuggestions(requestId, { suggestions, adminNote, status }) {
//     const request = await prisma.improvementRequest.findUnique({
//       where: { id: requestId }, select: { id: true, listingId: true, status: true },
//     });
//     if (!request) throw new NotFoundError('Improvement request not found');
//     if (request.status === 'COMPLETED' || request.status === 'REJECTED') {
//       throw new BadRequestError('Cannot add suggestions to a completed or rejected request');
//     }

//     return prisma.$transaction(async (tx) => {
//       await tx.improvementSuggestion.createMany({
//         data: suggestions.map((s) => ({
//           improvementRequestId: requestId,
//           fieldName: s.fieldName,
//           currentValue: s.currentValue ?? null,
//           suggestedValue: s.suggestedValue,
//           note: s.note ?? null,
//         })),
//       });
//       const updated = await tx.improvementRequest.update({
//         where: { id: requestId },
//         data: { status: status ?? 'SUGGESTION_SENT', adminNote: adminNote ?? undefined },
//         include: {
//           suggestions: { orderBy: { createdAt: 'asc' } },
//           listing: { select: { id: true, location: true, listingName: true } },
//           user: { select: { id: true, name: true, email: true } },
//         },
//       });
//       await tx.listing.update({ where: { id: request.listingId }, data: { status: 'IMPROVEMENT_IN_REVIEW' } });
//       log.info(`${suggestions.length} suggestions added to request ${requestId}`);
//       return updated;
//     });
//   }

//   async completeRequest(requestId, adminNote) {
//     const request = await prisma.improvementRequest.findUnique({
//       where: { id: requestId }, select: { id: true, listingId: true, status: true },
//     });
//     if (!request) throw new NotFoundError('Improvement request not found');
//     if (request.status === 'COMPLETED') throw new BadRequestError('Request is already completed');

//     return prisma.$transaction(async (tx) => {
//       const updated = await tx.improvementRequest.update({
//         where: { id: requestId },
//         data: { status: 'COMPLETED', adminNote: adminNote ?? null, resolvedAt: new Date() },
//         include: { suggestions: true, user: { select: { id: true, name: true, email: true } } },
//       });
//       await tx.listing.update({ where: { id: request.listingId }, data: { status: 'IMPROVEMENT_DONE' } });
//       log.info(`Request ${requestId} completed`);
//       return updated;
//     });
//   }

//   async getStats() {
//     const [total, pending, inReview, suggestionSent, completed, rejected] = await Promise.all([
//       prisma.improvementRequest.count(),
//       prisma.improvementRequest.count({ where: { status: 'PENDING' } }),
//       prisma.improvementRequest.count({ where: { status: 'IN_REVIEW' } }),
//       prisma.improvementRequest.count({ where: { status: 'SUGGESTION_SENT' } }),
//       prisma.improvementRequest.count({ where: { status: 'COMPLETED' } }),
//       prisma.improvementRequest.count({ where: { status: 'REJECTED' } }),
//     ]);
//     return { total, pending, inReview, suggestionSent, completed, rejected, active: pending + inReview + suggestionSent };
//   }
// }

// export const improvementService = new ImprovementService();