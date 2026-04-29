import { addDays, addHours, differenceInCalendarDays } from "date-fns";

export const OFFER_OPTIONS = [
  { value: "nuitee", label: "Nuitée" },
  { value: "forfait", label: "Forfait" },
  { value: "passage", label: "Passage 2h" },
  { value: "villa_1ch", label: "Villa 1 chambre" },
  { value: "villa_2ch", label: "Villa 2 chambres" },
  { value: "longue_duree", label: "Longue durée" },
  { value: "personnalise", label: "Personnalisé" },
] as const;

export type OfferCode = (typeof OFFER_OPTIONS)[number]["value"];
export type DiscountCode = "none" | "percent" | "fixed";
export type PaymentArrangementCode = "immediat" | "avance_partielle" | "fin_sejour";
export type PaymentStatusCode =
  | "solde"
  | "avance_versee"
  | "en_attente_paiement"
  | "solde_en_cours";

const WEEKEND_DAYS = new Set([0, 5, 6]);

export function isWeekendDate(date: Date) {
  return WEEKEND_DAYS.has(date.getDay());
}

export function getDefaultEndAt(offer: OfferCode, startAt: Date) {
  switch (offer) {
    case "passage":
      return addHours(startAt, 2);
    case "forfait":
      return addDays(startAt, isWeekendDate(startAt) ? 3 : 4);
    default:
      return addDays(startAt, 1);
  }
}

function getCalendarDayCount(startAt: Date, endAt: Date) {
  return Math.max(1, differenceInCalendarDays(endAt, startAt));
}

function getNightAmount(startAt: Date, endAt: Date) {
  const nights = getCalendarDayCount(startAt, endAt);
  let total = 0;

  for (let index = 0; index < nights; index += 1) {
    const current = addDays(startAt, index);
    total += isWeekendDate(current) ? 35000 : 25000;
  }

  return total;
}

function getForfaitAmount(startAt: Date, endAt: Date) {
  const isWeekendPack = isWeekendDate(startAt);
  const bundleDays = isWeekendPack ? 3 : 4;
  const units = Math.max(1, Math.ceil(getCalendarDayCount(startAt, endAt) / bundleDays));
  return units * (isWeekendPack ? 85000 : 90000);
}

function getVillaAmount(rate: number, startAt: Date, endAt: Date) {
  return getCalendarDayCount(startAt, endAt) * rate;
}

export function applyDiscount(baseAmount: number, discountType: DiscountCode, discountValue: number) {
  if (discountType === "percent") {
    return Math.max(0, Math.min(baseAmount, (baseAmount * discountValue) / 100));
  }

  if (discountType === "fixed") {
    return Math.max(0, Math.min(baseAmount, discountValue));
  }

  return 0;
}

export function derivePaymentStatus(
  netAmount: number,
  amountPaid: number,
  paymentCount: number
): PaymentStatusCode {
  if (amountPaid >= netAmount) return "solde";
  if (amountPaid <= 0) return "en_attente_paiement";
  if (paymentCount <= 1) return "avance_versee";
  return "solde_en_cours";
}

export function calculateOfferAmount({
  offer,
  startAt,
  endAt,
  customAmount,
  roomDailyRate,
}: {
  offer: OfferCode;
  startAt: Date;
  endAt?: Date | null;
  customAmount?: number | null;
  roomDailyRate?: number | null;
}) {
  const normalizedEndAt = endAt ?? getDefaultEndAt(offer, startAt);

  let baseAmount = 0;
  switch (offer) {
    case "nuitee":
      baseAmount = getNightAmount(startAt, normalizedEndAt);
      break;
    case "forfait":
      baseAmount = getForfaitAmount(startAt, normalizedEndAt);
      break;
    case "passage":
      baseAmount = isWeekendDate(startAt) ? 15000 : 10000;
      break;
    case "villa_1ch":
      baseAmount = getVillaAmount(100000, startAt, normalizedEndAt);
      break;
    case "villa_2ch":
      baseAmount = getVillaAmount(150000, startAt, normalizedEndAt);
      break;
    case "longue_duree":
      baseAmount = getVillaAmount(roomDailyRate ?? 25000, startAt, normalizedEndAt);
      break;
    case "personnalise":
      baseAmount = Math.max(0, customAmount ?? 0);
      break;
  }

  return {
    baseAmount,
    normalizedEndAt,
  };
}

export function offerMatchesRoomCategory(offer: OfferCode, category: string) {
  if (offer === "villa_1ch") return category === "villa_1ch";
  if (offer === "villa_2ch") return category === "villa_2ch";
  if (offer === "nuitee" || offer === "forfait" || offer === "passage") {
    return category === "standard";
  }
  return true;
}
