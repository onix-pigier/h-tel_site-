import { PrismaClient } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  applyDiscount,
  calculateOfferAmount,
  derivePaymentStatus,
  getImmediateOfferBlockMessage,
  isOfferCompatibleWithRoom,
} from "../src/lib/pricing";
import { generateReservationReference, generateStayCode } from "../src/lib/reference";
import { refreshStayPaymentTotals, toNumber } from "../src/lib/stay-utils";

class SmokeRollback extends Error {}

function assertRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[workflow-smoke] ${message}`);
}

async function refreshTotals(tx: unknown, stayId: string) {
  return refreshStayPaymentTotals(tx as PrismaClient, stayId);
}

async function main() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date("2026-05-15T10:00:00.000Z");

  try {
    await prisma.$transaction(async (tx) => {
      const weekStart = new Date("2026-05-12T15:00:00.000Z");
      const weekPricing = calculateOfferAmount({ offer: "forfait_semaine", startAt: weekStart, roomDailyRate: 25000 });
      assertRule(weekPricing.baseAmount === 90000, "forfait semaine doit rester fixe à 90 000 FCFA");
      assertRule(weekPricing.normalizedStartAt.getUTCDay() === 1, "forfait semaine doit s'aligner au lundi");
      assertRule(weekPricing.normalizedEndAt.getUTCDay() === 5 && weekPricing.normalizedEndAt.getUTCHours() === 12, "forfait semaine doit sortir vendredi à 12h");
      assertRule(Boolean(getImmediateOfferBlockMessage("forfait_weekend", weekStart)), "week-end direct hors plage doit être bloqué");
      assertRule(!isOfferCompatibleWithRoom("passage", { categorie: "standard", prix: 40000 }), "une chambre à 40 000 ne doit pas accepter le passage");

      const admin = await tx.user.create({
        data: {
          email: `smoke.admin.${suffix}@chanaude.test`,
          passwordHash: "smoke",
          firstName: "Smoke",
          lastName: "Admin",
          roles: { create: [{ role: "admin" }] },
        },
      });
      const gerant = await tx.user.create({
        data: {
          email: `smoke.gerant.${suffix}@chanaude.test`,
          passwordHash: "smoke",
          firstName: "Smoke",
          lastName: "Gerant",
          roles: { create: [{ role: "gerant" }] },
        },
      });

      const room = await tx.chambre.create({
        data: {
          numero: `SMK-DIR-${suffix}`,
          type: "Standard smoke",
          categorie: "standard",
          prix: 25000,
          capacite: 2,
          status: "disponible",
        },
      });

      const client = await tx.client.create({
        data: {
          firstName: "Client",
          lastName: "Smoke Direct",
          phone: "+2250700000000",
          nationality: "Ivoirienne",
          gender: "homme",
          birthDate: new Date("1990-01-01T00:00:00.000Z"),
        },
      });

      const directPricing = calculateOfferAmount({ offer: "nuitee", startAt: now, roomDailyRate: Number(room.prix) });
      const preRegistration = await tx.sejour.create({
        data: {
          code: generateStayCode("direct", now),
          clientId: client.id,
          chambreId: room.id,
          source: "presence",
          workflowKind: "direct",
          status: "planifie",
          offer: "nuitee",
          plannedStartAt: directPricing.normalizedStartAt,
          plannedEndAt: directPricing.normalizedEndAt,
          plannedStartAtOriginal: directPricing.normalizedStartAt,
          plannedEndAtOriginal: directPricing.normalizedEndAt,
          startedAt: directPricing.normalizedStartAt,
          endedAt: directPricing.normalizedEndAt,
          currentEndAt: directPricing.normalizedEndAt,
          baseAmount: directPricing.baseAmount,
          discountType: "none",
          discountValue: 0,
          discountAmount: 0,
          netAmount: directPricing.baseAmount,
          amountPaid: 0,
          balanceDue: directPricing.baseAmount,
          paymentArrangement: "fin_sejour",
          paymentStatus: "en_attente_paiement",
        },
      });

      const roomAfterPreRegistration = await tx.chambre.findUniqueOrThrow({ where: { id: room.id } });
      assertRule(roomAfterPreRegistration.status === "disponible", "pré-enregistrement ne doit pas occuper la chambre");

      await tx.client.update({ where: { id: client.id }, data: { documentType: "cni", documentNumber: `SMK-${suffix}` } });
      await tx.sejour.update({ where: { id: preRegistration.id }, data: { status: "en_cours", checkedInAt: now } });
      await tx.chambre.update({ where: { id: room.id }, data: { status: "occupee" } });

      await tx.payment.create({
        data: {
          stayId: preRegistration.id,
          paidAt: now,
          amount: 10000,
          method: "mobile_money",
          type: "acompte",
          operator: "Wave",
          payerPhone: "+2250700000000",
          transactionReference: `SMK-PAY-${suffix}`,
        },
      });
      const afterAcompte = await refreshTotals(tx, preRegistration.id);
      assertRule(afterAcompte && toNumber(afterAcompte.balanceDue) === directPricing.baseAmount - 10000, "acompte direct doit réduire le solde de base");
      const tracedPayment = await tx.payment.findFirstOrThrow({ where: { stayId: preRegistration.id, method: "mobile_money" } });
      assertRule(Boolean(tracedPayment.operator && tracedPayment.payerPhone && tracedPayment.transactionReference), "paiement non espèces doit être tracé");

      const extensionPricing = calculateOfferAmount({ offer: "nuitee", startAt: directPricing.normalizedEndAt, roomDailyRate: Number(room.prix) });
      const extension = await tx.stayExtension.create({
        data: {
          stayId: preRegistration.id,
          startedAt: directPricing.normalizedEndAt,
          endedAt: extensionPricing.normalizedEndAt,
          offer: "nuitee",
          baseAmount: extensionPricing.baseAmount,
          discountType: "none",
          discountValue: 0,
          discountAmount: 0,
          netAmount: extensionPricing.baseAmount,
          amountPaid: 0,
          balanceDue: extensionPricing.baseAmount,
          paymentStatus: "en_attente_paiement",
        },
      });

      const baseBalanceBeforeExtensionPayment = toNumber((await tx.sejour.findUniqueOrThrow({ where: { id: preRegistration.id } })).balanceDue);
      assertRule(baseBalanceBeforeExtensionPayment > 0, "le séjour de base doit rester prioritaire avant paiement prolongation");

      await tx.payment.create({
        data: {
          stayId: preRegistration.id,
          paidAt: now,
          amount: baseBalanceBeforeExtensionPayment,
          method: "especes",
          type: "solde",
        },
      });
      await refreshTotals(tx, preRegistration.id);
      const baseAfterSolde = await tx.sejour.findUniqueOrThrow({ where: { id: preRegistration.id } });
      assertRule(toNumber(baseAfterSolde.balanceDue) === 0, "séjour de base doit être soldé avant paiement prolongation");

      await tx.payment.create({
        data: {
          stayId: preRegistration.id,
          extensionId: extension.id,
          paidAt: now,
          amount: extensionPricing.baseAmount,
          method: "especes",
          type: "solde",
        },
      });
      await refreshTotals(tx, preRegistration.id);
      const extensionAfterPayment = await tx.stayExtension.findUniqueOrThrow({ where: { id: extension.id } });
      assertRule(toNumber(extensionAfterPayment.balanceDue) === 0, "prolongation doit pouvoir être soldée après le séjour de base");

      await tx.sejour.update({ where: { id: preRegistration.id }, data: { status: "termine", checkedOutAt: now } });
      await tx.chambre.update({ where: { id: room.id }, data: { status: "attente_nettoyage" } });
      const roomAfterCheckout = await tx.chambre.findUniqueOrThrow({ where: { id: room.id } });
      assertRule(roomAfterCheckout.status === "attente_nettoyage", "clôture doit envoyer la chambre au ménage");

      const webRoom = await tx.chambre.create({
        data: {
          numero: `SMK-WEB-${suffix}`,
          type: "Standard web smoke",
          categorie: "standard",
          prix: 25000,
          capacite: 2,
          status: "disponible",
        },
      });
      const webClient = await tx.client.create({
        data: {
          firstName: "Client",
          lastName: "Smoke Web",
          email: `client.web.${suffix}@chanaude.test`,
          phone: "+2250500000000",
          nationality: "Ivoirienne",
          gender: "femme",
          birthDate: new Date("1992-02-02T00:00:00.000Z"),
        },
      });
      const reservation = await tx.reservation.create({
        data: {
          reference: generateReservationReference(now),
          clientId: webClient.id,
          source: "web",
          workflowKind: "web",
          firstName: webClient.firstName,
          lastName: webClient.lastName,
          email: webClient.email ?? `fallback.${suffix}@chanaude.test`,
          phone: webClient.phone,
          nationality: webClient.nationality,
          gender: webClient.gender,
          guestCount: 2,
          dateArrivee: now,
          dateDepart: directPricing.normalizedEndAt,
          offer: "nuitee",
          requestedAdvanceAmount: 0,
          status: "confirmee",
          dateArriveeOriginal: now,
          dateDepartOriginal: directPricing.normalizedEndAt,
        },
      });
      const webStay = await tx.sejour.create({
        data: {
          code: generateStayCode("web", now),
          clientId: webClient.id,
          chambreId: webRoom.id,
          reservationId: reservation.id,
          source: "web",
          workflowKind: "web",
          status: "planifie",
          offer: "nuitee",
          plannedStartAt: now,
          plannedEndAt: directPricing.normalizedEndAt,
          plannedStartAtOriginal: now,
          plannedEndAtOriginal: directPricing.normalizedEndAt,
          startedAt: now,
          endedAt: directPricing.normalizedEndAt,
          currentEndAt: directPricing.normalizedEndAt,
          baseAmount: directPricing.baseAmount,
          netAmount: directPricing.baseAmount,
          balanceDue: directPricing.baseAmount,
          paymentArrangement: "fin_sejour",
          paymentStatus: "en_attente_paiement",
        },
      });
      await tx.client.update({ where: { id: webClient.id }, data: { documentType: "passport", documentNumber: `WEB-${suffix}` } });
      await tx.reservation.update({ where: { id: reservation.id }, data: { status: "convertie" } });
      await tx.sejour.update({ where: { id: webStay.id }, data: { status: "en_cours", checkedInAt: now } });
      await tx.chambre.update({ where: { id: webRoom.id }, data: { status: "occupee" } });
      const convertedReservation = await tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
      assertRule(convertedReservation.status === "convertie", "arrivée web doit convertir la réservation");

      const requestedDiscount = await tx.discountRequest.create({
        data: {
          stayId: webStay.id,
          requestedById: gerant.id,
          discountType: "fixed",
          discountValue: 5000,
          reason: "Smoke test remise",
        },
      });
      const discountAmount = applyDiscount(directPricing.baseAmount, "fixed", 5000);
      await tx.discountRequest.update({
        where: { id: requestedDiscount.id },
        data: {
          status: "approuvee",
          reviewedById: admin.id,
          approvedDiscountType: "fixed",
          approvedDiscountValue: 5000,
          reviewedAt: now,
        },
      });
      await tx.sejour.update({
        where: { id: webStay.id },
        data: {
          discountType: "fixed",
          discountValue: 5000,
          discountAmount,
          netAmount: directPricing.baseAmount - discountAmount,
          balanceDue: directPricing.baseAmount - discountAmount,
          paymentStatus: derivePaymentStatus(directPricing.baseAmount - discountAmount, 0, 0),
        },
      });
      const approvedDiscount = await tx.discountRequest.findUniqueOrThrow({ where: { id: requestedDiscount.id } });
      assertRule(approvedDiscount.status === "approuvee", "demande de remise doit pouvoir être approuvée par admin");

      console.log("[workflow-smoke] règles pricing, pré-enregistrement, arrivée, paiement, prolongation, clôture, réservation web et remise: OK");
      throw new SmokeRollback("rollback smoke data");
    }, { timeout: 20000, maxWait: 10000 });
  } catch (error) {
    if (error instanceof SmokeRollback || (error as Error).message === "rollback smoke data") {
      console.log("[workflow-smoke] rollback OK, aucune donnée conservée");
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
