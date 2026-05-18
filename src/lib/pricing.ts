import { addDays, addHours, differenceInCalendarDays } from "date-fns";

export const OFFER_CODES = [
  "nuitee",
  "forfait_semaine",
  "forfait_weekend",
  "passage",
  "villa_1ch",
  "villa_2ch",
  "longue_duree",
  "personnalise",
] as const;

export const PUBLIC_OFFER_CODES = [
  "nuitee",
  "forfait_semaine",
  "forfait_weekend",
  "villa_1ch",
  "villa_2ch",
  "longue_duree",
  "personnalise",
] as const;

export const DISCOUNT_CODES = ["none", "percent", "fixed"] as const;
export const PAYMENT_ARRANGEMENT_CODES = ["immediat", "avance_partielle", "fin_sejour"] as const;
export const PAYMENT_STATUS_CODES = [
  "solde",
  "avance_versee",
  "en_attente_paiement",
  "solde_en_cours",
] as const;

export const OFFER_OPTIONS = [
  { value: "nuitee", label: "Nuitée" },
  { value: "forfait_semaine", label: "Forfait semaine" },
  { value: "forfait_weekend", label: "Forfait week-end" },
  { value: "passage", label: "Passage 2h" },
  { value: "villa_1ch", label: "Villa 1 chambre" },
  { value: "villa_2ch", label: "Villa 2 chambres" },
  { value: "longue_duree", label: "Longue durée" },
  { value: "personnalise", label: "Personnalisé" },
] as const;

export type OfferCode = (typeof OFFER_CODES)[number];
export type DiscountCode = (typeof DISCOUNT_CODES)[number];
export type PaymentArrangementCode = (typeof PAYMENT_ARRANGEMENT_CODES)[number];
export type PaymentStatusCode = (typeof PAYMENT_STATUS_CODES)[number];
export type PricingContext = "direct" | "reservation";

const WEEKEND_DAYS = new Set([0, 5, 6]);
const NOON_HOUR = 12;
const PASSAGE_MAX_ROOM_RATE = 30000;
export const VILLA_DEPOSIT_AMOUNT = 100000;

export function isWeekendDate(date: Date) {
  return WEEKEND_DAYS.has(date.getDay());
}

export function offerNeedsDayCount(offer: OfferCode) {
  return ["villa_1ch", "villa_2ch", "longue_duree", "personnalise"].includes(offer);
}

export function offerRequiresVillaDeposit(offer: OfferCode) {
  return offer === "villa_1ch" || offer === "villa_2ch";
}

export function getExpectedDepositAmount(offer: OfferCode) {
  return offerRequiresVillaDeposit(offer) ? VILLA_DEPOSIT_AMOUNT : 0;
}

export function offerUsesFixedWindow(offer: OfferCode) {
  return ["passage", "nuitee", "forfait_semaine", "forfait_weekend"].includes(offer) || offerNeedsDayCount(offer);
}

function normalizeToCheckoutNoon(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(NOON_HOUR, 0, 0, 0);
  return normalized;
}

function buildDayBasedCheckout(startAt: Date, dayCount = 1) {
  const totalDays = Math.max(1, Math.floor(dayCount || 1));
  const endAt = addDays(new Date(startAt), totalDays);
  endAt.setHours(NOON_HOUR, 0, 0, 0);
  return endAt;
}

function getIsoWeekday(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function withCheckoutHour(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(NOON_HOUR, 0, 0, 0);
  return normalized;
}

function resolveWeekForfaitWindow(startAt: Date) {
  const weekday = getIsoWeekday(startAt);
  const windowStart = withCheckoutHour(startAt);
  if (weekday >= 5) {
    windowStart.setDate(startAt.getDate() + (8 - weekday));
  } else {
    windowStart.setDate(startAt.getDate() - (weekday - 1));
  }

  const endAt = addDays(windowStart, 4);
  endAt.setHours(NOON_HOUR, 0, 0, 0);

  return {
    startAt: windowStart,
    endAt,
    amount: 90000,
  };
}

function resolveWeekendForfaitWindow(startAt: Date) {
  const day = startAt.getDay();
  const windowStart = withCheckoutHour(startAt);

  if (day === 5) {
    windowStart.setDate(startAt.getDate());
  } else if (day === 6) {
    windowStart.setDate(startAt.getDate() - 1);
  } else if (day === 0) {
    windowStart.setDate(startAt.getDate() - 2);
  } else {
    windowStart.setDate(startAt.getDate() + (5 - day));
  }

  const endAt = addDays(windowStart, 3);
  endAt.setHours(NOON_HOUR, 0, 0, 0);

  return {
    startAt: windowStart,
    endAt,
    amount: 85000,
  };
}

export function getImmediateOfferBlockMessage(offer: OfferCode, startAt: Date) {
  if (offer === "forfait_weekend" && ![0, 5, 6].includes(startAt.getDay())) {
    return "Le forfait week-end démarre le vendredi. Créez une réservation pour le vendredi prochain.";
  }

  if (offer === "forfait_semaine") {
    const weekday = getIsoWeekday(startAt);
    if (weekday < 1 || weekday > 4) {
      return "Le forfait semaine se prend du lundi au jeudi. Créez une réservation pour le lundi suivant.";
    }
  }

  return null;
}

export function getOfferWindowWarning(offer: OfferCode, startAt: Date) {
  if (offer === "forfait_semaine") {
    const window = resolveWeekForfaitWindow(startAt);
    if (window.startAt.getTime() !== startAt.getTime()) {
      return "Forfait semaine fixe: début aligné au lundi, départ vendredi à 12h.";
    }
  }

  if (offer === "forfait_weekend") {
    const window = resolveWeekendForfaitWindow(startAt);
    if (window.startAt.getTime() !== startAt.getTime()) {
      return "Forfait week-end fixe: début aligné au vendredi, départ lundi à 12h.";
    }
  }

  return null;
}

export function getDefaultEndAt(offer: OfferCode, startAt: Date, dayCount = 1) {
  switch (offer) {
    case "passage":
      return addHours(startAt, 2);
    case "nuitee":
      return buildDayBasedCheckout(startAt, 1);
    case "forfait_semaine":
      return resolveWeekForfaitWindow(startAt).endAt;
    case "forfait_weekend":
      return resolveWeekendForfaitWindow(startAt).endAt;
    case "villa_1ch":
    case "villa_2ch":
    case "longue_duree":
    case "personnalise":
      return buildDayBasedCheckout(startAt, dayCount);
    default:
      return buildDayBasedCheckout(startAt, 1);
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
    total += isWeekendDate(current) ? 30000 : 25000;
  }

  return total;
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
  dayCount,
}: {
  offer: OfferCode;
  startAt: Date;
  endAt?: Date | null;
  customAmount?: number | null;
  roomDailyRate?: number | null;
  dayCount?: number | null;
}) {
  let normalizedStartAt = new Date(startAt);
  let normalizedEndAt = endAt ?? getDefaultEndAt(offer, startAt, dayCount ?? 1);
  let baseAmount = 0;

  switch (offer) {
    case "passage": {
      normalizedEndAt = addHours(normalizedStartAt, 2);
      baseAmount = isWeekendDate(normalizedStartAt) ? 15000 : 10000;
      break;
    }
    case "nuitee": {
      normalizedEndAt = endAt ? normalizeToCheckoutNoon(endAt) : buildDayBasedCheckout(normalizedStartAt, 1);
      baseAmount = getNightAmount(normalizedStartAt, normalizedEndAt);
      break;
    }
    case "forfait_semaine": {
      const pack = resolveWeekForfaitWindow(normalizedStartAt);
      normalizedStartAt = pack.startAt;
      normalizedEndAt = pack.endAt;
      baseAmount = pack.amount;
      break;
    }
    case "forfait_weekend": {
      const pack = resolveWeekendForfaitWindow(normalizedStartAt);
      normalizedStartAt = pack.startAt;
      normalizedEndAt = pack.endAt;
      baseAmount = pack.amount;
      break;
    }
    case "villa_1ch": {
      normalizedEndAt = dayCount ? buildDayBasedCheckout(normalizedStartAt, dayCount) : endAt ? normalizeToCheckoutNoon(endAt) : buildDayBasedCheckout(normalizedStartAt, 1);
      baseAmount = getVillaAmount(100000, normalizedStartAt, normalizedEndAt);
      break;
    }
    case "villa_2ch": {
      normalizedEndAt = dayCount ? buildDayBasedCheckout(normalizedStartAt, dayCount) : endAt ? normalizeToCheckoutNoon(endAt) : buildDayBasedCheckout(normalizedStartAt, 1);
      baseAmount = getVillaAmount(150000, normalizedStartAt, normalizedEndAt);
      break;
    }
    case "longue_duree": {
      normalizedEndAt = dayCount ? buildDayBasedCheckout(normalizedStartAt, dayCount) : endAt ? normalizeToCheckoutNoon(endAt) : buildDayBasedCheckout(normalizedStartAt, 1);
      baseAmount = getVillaAmount(roomDailyRate ?? 25000, normalizedStartAt, normalizedEndAt);
      break;
    }
    case "personnalise": {
      normalizedEndAt = dayCount ? buildDayBasedCheckout(normalizedStartAt, dayCount) : endAt ? normalizeToCheckoutNoon(endAt) : buildDayBasedCheckout(normalizedStartAt, 1);
      baseAmount = Math.max(0, customAmount ?? 0);
      break;
    }
  }

  return {
    baseAmount,
    normalizedStartAt,
    normalizedEndAt,
  };
}

export function offerMatchesRoomCategory(offer: OfferCode, category: string) {
  if (offer === "villa_1ch") return category === "villa_1ch";
  if (offer === "villa_2ch") return category === "villa_2ch";
  if (offer === "nuitee" || offer === "forfait_semaine" || offer === "forfait_weekend" || offer === "passage") {
    return category === "standard";
  }
  return true;
}

export function offerMatchesRoomRate(offer: OfferCode, price: number) {
  if (offer === "passage") {
    return price <= PASSAGE_MAX_ROOM_RATE;
  }
  return true;
}

export function isOfferCompatibleWithRoom(
  offer: OfferCode,
  room: { categorie: string; prix: number | null | undefined }
) {
  return offerMatchesRoomCategory(offer, room.categorie) && offerMatchesRoomRate(offer, Number(room.prix ?? 0));
}
