import { OFFER_OPTIONS } from "@/lib/pricing";
import { detectStayWorkflow, type StayWorkflowKind } from "@/lib/reference";

export const offerLabels = Object.fromEntries(OFFER_OPTIONS.map((item) => [item.value, item.label])) as Record<string, string>;

export const sourceLabels: Record<string, string> = {
  web: "Réservation web",
  presence: "Présentiel",
};

export const workflowLabels: Record<StayWorkflowKind, string> = {
  web: "Réservation web",
  direct: "Enregistrement",
  comptoir: "Présentiel",
  appel: "Appel",
};

export const reservationStatusLabels: Record<string, string> = {
  en_attente: "En préparation",
  confirmee: "Réservation confirmée",
  convertie: "Séjour démarré",
  refusee: "Indisponible",
  annulee: "Annulée",
  reportee: "Reportée",
};

export const stayStatusLabels: Record<string, string> = {
  planifie: "Réservation",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

export const paymentStatusLabels: Record<string, string> = {
  solde: "Soldé",
  avance_versee: "Acompte",
  en_attente_paiement: "Aucun paiement",
  solde_en_cours: "Solde à payer",
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

export const clientGenderLabels: Record<string, string> = {
  homme: "Homme",
  femme: "Femme",
};

export const roomCategoryLabels: Record<string, string> = {
  standard: "Standard",
  villa_1ch: "Villa 1 chambre",
  villa_2ch: "Villa 2 chambres",
};

export const roomStatusLabels: Record<string, string> = {
  disponible: "Disponible",
  occupee: "Occupée",
  attente_nettoyage: "Ménage en attente",
  maintenance: "Maintenance",
};

export const paymentMethodLabels: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile money",
  carte: "Carte",
  virement: "Virement",
  autre: "Autre",
};

export const depositStatusLabels: Record<string, string> = {
  en_attente: "En attente",
  encaissee: "Encaissée",
  restituee: "Restituée",
  conservee: "Conservée",
};

export const paymentTypeLabels: Record<string, string> = {
  acompte: "Acompte",
  partiel: "Acompte",
  solde: "Solde",
};

export function getWorkflowLabel(workflowKind?: string | null, code?: string, source?: string | null) {
  const resolved = workflowKind && workflowKind in workflowLabels
    ? (workflowKind as StayWorkflowKind)
    : detectStayWorkflow(code ?? "", source);

  return workflowLabels[resolved] ?? "Enregistrement";
}

export function formatCurrency(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount) + " FCFA";
}

export function formatVisitCount(value: unknown) {
  const count = Number(value ?? 0);
  if (!Number.isFinite(count) || count <= 0) return "Aucune présence";
  return count === 1 ? "1 présence" : `${count} présences`;
}
