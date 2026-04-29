import { OFFER_OPTIONS } from "@/lib/pricing";

export const offerLabels = Object.fromEntries(OFFER_OPTIONS.map((item) => [item.value, item.label])) as Record<string, string>;

export const sourceLabels: Record<string, string> = {
  web: "Réservation web",
  presence: "Présence directe",
};

export const stayStatusLabels: Record<string, string> = {
  planifie: "Planifié",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

export const paymentStatusLabels: Record<string, string> = {
  solde: "Soldé",
  avance_versee: "Avance versée",
  en_attente_paiement: "En attente paiement",
  solde_en_cours: "Solde en cours",
};

export const paymentStatusMeta: Record<string, { label: string; className: string }> = {
  solde: {
    label: paymentStatusLabels.solde,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  avance_versee: {
    label: paymentStatusLabels.avance_versee,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  en_attente_paiement: {
    label: paymentStatusLabels.en_attente_paiement,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
  solde_en_cours: {
    label: paymentStatusLabels.solde_en_cours,
    className: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  },
};

export const documentTypeLabels: Record<string, string> = {
  cni: "CNI",
  passport: "Passeport",
  titre_sejour: "Titre de séjour",
  autre: "Autre",
};

export const paymentMethodLabels: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile money",
  carte: "Carte",
  virement: "Virement",
  autre: "Autre",
};

export const paymentTypeLabels: Record<string, string> = {
  acompte: "Acompte",
  partiel: "Partiel",
  solde: "Solde",
};

export function formatCurrency(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount) + " FCFA";
}
