"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, History, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  applyDiscount,
  calculateOfferAmount,
  DiscountCode,
  getExpectedDepositAmount,
  offerNeedsDayCount,
  offerRequiresVillaDeposit,
  OfferCode,
  OFFER_OPTIONS,
  PAYMENT_ARRANGEMENT_CODES,
  PaymentArrangementCode,
} from "@/lib/pricing";
import {
  documentTypeLabels,
  formatCurrency,
  formatVisitCount,
  getWorkflowLabel,
  offerLabels,
  paymentMethodLabels,
  roomCategoryLabels,
  roomStatusLabels,
} from "@/lib/hotel-display";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isAdultAt } from "@/lib/date-rules";
import { buildModalFieldChanges, type AuditSnapshot } from "@/lib/modal-audit";

interface RoomChoice {
  id: string;
  numero: string;
  type: string;
  categorie: string;
  prix: number;
  status: string;
  capacite?: number | null;
}

interface PlannedArrivalStay {
  id: string;
  code: string;
  offer: string;
  startedAt: string;
  currentEndAt: string;
  amountPaid: number;
  netAmount: number;
  balanceDue: number;
  visitCount: number;
  workflowKind?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  plannedStartAtOriginal?: string | null;
  plannedEndAtOriginal?: string | null;
  notes?: string | null;
  clientNotes?: Array<{
    id: string;
    moment: string;
    comment: string;
    createdAt: string;
  }>;
  deposits?: Array<{
    id: string;
    type: string;
    status: string;
    expectedAmount: number;
    heldAmount: number;
    returnedAmount: number;
    method?: string | null;
    notes?: string | null;
  }>;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string;
    nationality: string | null;
    gender: "homme" | "femme" | "autre" | null;
    documentNumber: string | null;
    documentType: string | null;
    birthDate: string | null;
    sejours?: Array<{
      id: string;
      code: string;
      offer: string;
      startedAt: string;
      currentEndAt: string;
      chambre?: { numero: string } | null;
    }>;
  };
  chambre: {
    id: string;
    numero: string;
    type: string;
    categorie: string;
    prix: number;
    status: string;
  };
  reservation: {
    id: string;
    reference: string;
    status: string;
    firstName: string;
    lastName: string;
    dateArrivee: string | null;
    dateDepart: string | null;
    dateArriveeOriginal: string | null;
    dateDepartOriginal: string | null;
    notes: string | null;
    createdAt?: string | null;
  } | null;
}

interface PlannedArrivalDialogProps {
  stay: PlannedArrivalStay;
  onCompleted?: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  gender: "homme" | "femme" | "autre";
  documentNumber: string;
  documentType: "cni" | "passport" | "titre_sejour" | "autre";
  birthDate: string;
  offer: OfferCode;
  startAt: string;
  endAt: string;
  dayCount: number;
  chambreId: string;
  customAmount: number;
  discountType: DiscountCode;
  discountValue: number;
  paymentArrangement: PaymentArrangementCode;
  paymentMethod: "especes" | "mobile_money" | "carte" | "virement" | "autre";
  paymentAmount: number;
  paymentOperator: string;
  payerPhone: string;
  paymentReference: string;
  paymentPaidAt: string;
  depositHeldAmount: number;
  depositMethod: "especes" | "mobile_money" | "carte" | "virement" | "autre";
  depositNotes: string;
  keyHanded: boolean;
  notes: string;
  behaviorBefore: string;
  discountReason: string;
};

const plannedAuditLabels: Record<string, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  phone: "Téléphone",
  nationality: "Nationalité",
  document: "Pièce",
  offer: "Offre",
  startAt: "Date d'entrée",
  endAt: "Date de sortie",
  dayCount: "Nombre de jours",
  room: "Chambre",
  discount: "Remise",
  paymentArrangement: "Modalité paiement",
  paymentMethod: "Mode paiement",
  paymentAmount: "Montant encaissé",
  depositHeldAmount: "Caution villa",
  keyHanded: "Clé remise",
};

function buildPlannedAuditSnapshot(form: FormState, rooms: RoomChoice[], stay: PlannedArrivalStay): AuditSnapshot {
  const room = rooms.find((item) => item.id === form.chambreId);
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    phone: form.phone,
    nationality: form.nationality,
    document: form.documentNumber ? `${documentTypeLabels[form.documentType] ?? form.documentType} ${form.documentNumber}` : null,
    offer: offerLabels[form.offer] ?? form.offer,
    startAt: form.startAt,
    endAt: form.endAt,
    dayCount: form.dayCount,
    room: room ? `Chambre ${room.numero} - ${room.type}` : `Chambre ${stay.chambre.numero} - ${stay.chambre.type}`,
    discount: form.discountType === "none" ? null : `${form.discountType} ${form.discountValue}`,
    paymentArrangement: form.paymentArrangement,
    paymentMethod: paymentMethodLabels[form.paymentMethod] ?? form.paymentMethod,
    paymentAmount: form.paymentAmount,
    depositHeldAmount: form.depositHeldAmount,
    keyHanded: form.keyHanded ? "Oui" : "Non",
  };
}

const steps = [{ title: "Identité" }, { title: "Caisse" }, { title: "Attribution" }] as const;

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date invalide";
  return format(date, "dd/MM/yyyy HH:mm");
}

function estimateDayCount(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

function buildDefaultForm(stay: PlannedArrivalStay): FormState {
  const villaDeposit = (stay.deposits ?? []).find((deposit) => deposit.type === "caution_villa") ?? null;

  return {
    firstName: stay.client.firstName,
    lastName: stay.client.lastName,
    email: stay.client.email ?? "",
    phone: stay.client.phone,
    nationality: stay.client.nationality ?? "",
    gender: stay.client.gender ?? "homme",
    documentNumber: stay.client.documentNumber ?? "",
    documentType: (stay.client.documentType as FormState["documentType"]) ?? "cni",
    birthDate: stay.client.birthDate ? stay.client.birthDate.slice(0, 10) : "",
    offer: (stay.offer as OfferCode) ?? "nuitee",
    startAt: toDateInputValue(stay.plannedStartAt ?? stay.startedAt),
    endAt: toDateInputValue(stay.plannedEndAt ?? stay.currentEndAt),
    dayCount: estimateDayCount(
      toDateInputValue(stay.plannedStartAt ?? stay.startedAt),
      toDateInputValue(stay.plannedEndAt ?? stay.currentEndAt),
    ),
    chambreId: stay.chambre.id,
    customAmount: 0,
    discountType: "none",
    discountValue: 0,
    paymentArrangement: "fin_sejour",
    paymentMethod: "especes",
    paymentAmount: 0,
    paymentOperator: "",
    payerPhone: "",
    paymentReference: "",
    paymentPaidAt: toDateInputValue(new Date().toISOString()),
    depositHeldAmount: Number(villaDeposit?.heldAmount ?? 0),
    depositMethod: (villaDeposit?.method as FormState["depositMethod"]) ?? "especes",
    depositNotes: villaDeposit?.notes ?? "",
    keyHanded: false,
    notes: stay.notes ?? "",
    behaviorBefore: "",
    discountReason: "",
  };
}

export function PlannedArrivalDialog({ stay, onCompleted, open: controlledOpen, onOpenChange, hideTrigger = false }: PlannedArrivalDialogProps) {
  const { isAdmin } = useAuth();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [rooms, setRooms] = useState<RoomChoice[]>([]);
  const roomsRef = useRef<RoomChoice[]>([]);
  const [roomQuery, setRoomQuery] = useState("");
  const [offerError, setOfferError] = useState<string | null>(null);
  const [infoTab, setInfoTab] = useState<"prevision" | "presence" | "information">("prevision");
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const initialAuditSnapshotRef = useRef<AuditSnapshot | null>(null);
  const [form, setForm] = useState<FormState>(() => buildDefaultForm(stay));
  const open = controlledOpen ?? uncontrolledOpen;
  const workflowLabel = getWorkflowLabel(stay.workflowKind, stay.code, stay.reservation ? "web" : "presence");
  const isPreRegistration = stay.workflowKind === "direct" && !stay.reservation;
  const requiresVillaDeposit = offerRequiresVillaDeposit(form.offer);
  const expectedDepositAmount = getExpectedDepositAmount(form.offer);
  const plannedStartLabel = stay.plannedStartAt ?? stay.reservation?.dateArrivee ?? stay.startedAt;
  const plannedEndLabel = stay.plannedEndAt ?? stay.reservation?.dateDepart ?? stay.currentEndAt;
  const plannedStartOriginalLabel = stay.reservation?.dateArriveeOriginal ?? stay.plannedStartAtOriginal ?? plannedStartLabel;
  const plannedEndOriginalLabel = stay.reservation?.dateDepartOriginal ?? stay.plannedEndAtOriginal ?? plannedEndLabel;
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setInfoTab("prevision");
    setKeyDialogOpen(false);
    const nextForm = buildDefaultForm(stay);
    initialAuditSnapshotRef.current = buildPlannedAuditSnapshot(nextForm, roomsRef.current, stay);
    setForm(nextForm);
    setOfferError(null);
  }, [open, stay]);

  useEffect(() => {
    if (!open || !form.startAt || !form.offer) return;
    const startAt = new Date(form.startAt);
    if (Number.isNaN(startAt.getTime())) return;

    try {
      const pricing = calculateOfferAmount({
        offer: form.offer,
        startAt,
        endAt: form.endAt ? new Date(form.endAt) : null,
        customAmount: form.customAmount,
        roomDailyRate: stay.chambre.prix,
        dayCount: form.dayCount,
      });
      const nextStartValue = toDateInputValue(pricing.normalizedStartAt.toISOString());
      const nextEndValue = toDateInputValue(pricing.normalizedEndAt.toISOString());
      setOfferError(null);
      setForm((current) => (
        current.startAt === nextStartValue && current.endAt === nextEndValue
          ? current
          : { ...current, startAt: nextStartValue, endAt: nextEndValue }
      ));
    } catch (error) {
      setOfferError(error instanceof Error ? error.message : "Offre indisponible pour cette date.");
    }
  }, [form.customAmount, form.dayCount, form.endAt, form.offer, form.startAt, open, stay.chambre.prix]);

  useEffect(() => {
    if (!open || !form.startAt || !form.offer || offerError) return;

    let cancelled = false;
    const loadRooms = async () => {
      const params = new URLSearchParams({
        offer: form.offer,
        startAt: form.startAt,
        endAt: form.endAt,
        excludeStayId: stay.id,
      });
      if (form.dayCount > 0) params.set("stayDays", String(form.dayCount));

      const res = await fetch("/api/admin/attributions/available?" + params.toString(), { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        toast.error(payload.error || "Chargement des chambres impossible");
        setRooms([]);
        return;
      }

      const nextRooms = Array.isArray(payload.chambres) ? payload.chambres : [];
      setRooms(nextRooms);
      setForm((current) => {
        const roomExists = nextRooms.some((room: RoomChoice) => room.id === current.chambreId);
        return roomExists ? current : { ...current, chambreId: nextRooms[0]?.id ?? "" };
      });
    };

    void loadRooms();

    return () => {
      cancelled = true;
    };
  }, [form.dayCount, form.endAt, form.offer, form.startAt, offerError, open, stay.id]);

  const pricingSummary = useMemo(() => {
    const startAt = new Date(form.startAt);
    const activeRoom = rooms.find((room) => room.id === form.chambreId);
    const roomRate = activeRoom?.prix ?? stay.chambre.prix;

    if (Number.isNaN(startAt.getTime())) {
      return null;
    }

    try {
      const pricing = calculateOfferAmount({
        offer: form.offer,
        startAt,
        endAt: form.endAt ? new Date(form.endAt) : null,
        customAmount: form.customAmount,
        roomDailyRate: Number(roomRate),
        dayCount: form.dayCount,
      });
      const effectiveDiscountType = isAdmin ? form.discountType : "none";
      const effectiveDiscountValue = isAdmin ? form.discountValue : 0;
      const discountAmount = applyDiscount(pricing.baseAmount, effectiveDiscountType, effectiveDiscountValue);
      const netAmount = Math.max(0, pricing.baseAmount - discountAmount);
      const alreadyPaid = Number(stay.amountPaid ?? 0);
      const remainingBefore = Math.max(0, netAmount - alreadyPaid);
      const remainingAfter = Math.max(0, remainingBefore - form.paymentAmount);
      const requestedDiscountAmount = isAdmin ? discountAmount : applyDiscount(pricing.baseAmount, form.discountType, form.discountValue);

      return {
        baseAmount: pricing.baseAmount,
        discountAmount,
        requestedDiscountAmount,
        netAmount,
        alreadyPaid,
        remainingBefore,
        remainingAfter,
        normalizedEndAt: pricing.normalizedEndAt,
      };
    } catch (error) {
      if (error instanceof Error) {
        return { error: error.message } as const;
      }
      return null;
    }
  }, [form.chambreId, form.customAmount, form.dayCount, form.discountType, form.discountValue, form.endAt, form.offer, form.paymentAmount, form.startAt, isAdmin, rooms, stay.amountPaid, stay.chambre.prix]);

  const pricingError = offerError ?? (pricingSummary && "error" in pricingSummary ? pricingSummary.error : null);
  const filteredRooms = useMemo(() => {
    const query = roomQuery.trim().toLowerCase();
    if (!query) return rooms;
    return rooms.filter((room) => `${room.numero} ${room.type} ${room.categorie}`.toLowerCase().includes(query));
  }, [roomQuery, rooms]);
  const selectedRoom = rooms.find((room) => room.id === form.chambreId) ?? null;
  const normalizedSummary = pricingSummary && !("error" in pricingSummary) ? pricingSummary : null;

  const reservationIdentityMismatch = useMemo(() => {
    if (!stay.reservation) return false;
    const currentName = `${form.firstName} ${form.lastName}`.trim().toLowerCase();
    const reservationName = `${stay.reservation.firstName} ${stay.reservation.lastName}`.trim().toLowerCase();
    return currentName !== reservationName;
  }, [form.firstName, form.lastName, stay.reservation]);

  const hasAdultAge = isAdultAt(form.birthDate, form.startAt || new Date());

  const canProceedIdentity =
    form.firstName.trim().length >= 2 &&
    form.lastName.trim().length >= 2 &&
    form.phone.trim().length >= 8 &&
    form.nationality.trim().length >= 2 &&
    hasAdultAge;

  const hasRequestedDiscount = form.discountType !== "none" && form.discountValue > 0;
  const requiresPaymentTrace = form.paymentAmount > 0 && form.paymentMethod !== "especes";
  const showPaymentTrace = form.paymentMethod !== "especes";

  const canProceedFinance =
    Boolean(normalizedSummary) &&
    !pricingError &&
    form.paymentAmount >= 0 &&
    form.paymentAmount <= (normalizedSummary?.remainingBefore ?? 0) &&
    (form.paymentArrangement !== "immediat" || (normalizedSummary?.remainingAfter ?? 1) === 0) &&
    (form.paymentArrangement !== "avance_partielle" || (normalizedSummary ? normalizedSummary.alreadyPaid + form.paymentAmount > 0 : false)) &&
    (!requiresPaymentTrace || (form.paymentOperator.trim().length >= 2 && form.payerPhone.trim().length >= 6 && form.paymentReference.trim().length >= 3 && Boolean(form.paymentPaidAt))) &&
    (!requiresVillaDeposit || form.depositHeldAmount <= expectedDepositAmount) &&
    (isAdmin || !hasRequestedDiscount || form.discountReason.trim().length >= 6);

  const hasIdentityDocument = form.documentNumber.trim().length >= 4;
  const canSubmit = canProceedIdentity && canProceedFinance && Boolean(form.chambreId) && hasIdentityDocument && form.keyHanded;

  const confirmKeyHanded = () => {
    if (!form.chambreId) {
      toast.error("Choisis une chambre avant la remise de clé.");
      return;
    }
    if (!form.startAt || !form.endAt) {
      toast.error("Les dates effectives sont obligatoires avant la remise de clé.");
      return;
    }
    if (!hasIdentityDocument) {
      toast.error("La pièce d'identité est obligatoire avant la remise de clé.");
      return;
    }

    setForm((current) => ({ ...current, keyHanded: true }));
    setKeyDialogOpen(false);
    toast.success("Clé remise confirmée.");
  };

  const handleNext = () => {
    if (step === 0 && !canProceedIdentity) {
      toast.error(!hasAdultAge ? "Le client doit avoir au moins 18 ans." : "Complète les informations principales avant de continuer.");
      return;
    }

    if (step === 1 && !canProceedFinance) {
      toast.error(pricingError || "La partie caisse n'est pas cohérente.");
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error(!hasIdentityDocument ? "La pièce d'identité est obligatoire avant la remise de clé." : !form.keyHanded ? "La clé doit être marquée comme remise pour lancer le séjour." : "Le tunnel d'arrivée n'est pas complet.");
      return;
    }

    setSubmitting(true);
    const fieldChanges = buildModalFieldChanges(
      initialAuditSnapshotRef.current ?? buildPlannedAuditSnapshot(buildDefaultForm(stay), rooms, stay),
      buildPlannedAuditSnapshot(form, rooms, stay),
      plannedAuditLabels,
    );
    const checkInPayload = {
      ...form,
      discountType: isAdmin ? form.discountType : "none",
      discountValue: isAdmin ? form.discountValue : 0,
      keyHanded: form.keyHanded,
      fieldChanges,
    };
    const res = await fetch("/api/admin/stays/" + stay.id + "/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkInPayload),
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSubmitting(false);
      toast.error(payload.error || "Activation du séjour impossible");
      return;
    }

    const shouldCreateDiscountRequest = !isAdmin && hasRequestedDiscount;
    if (shouldCreateDiscountRequest) {
      const requestRes = await fetch(`/api/admin/stays/${stay.id}/discount-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountType: form.discountType,
          discountValue: form.discountValue,
          reason: form.discountReason,
        }),
      });
      const requestPayload = await requestRes.json().catch(() => ({}));
      if (!requestRes.ok) {
        setSubmitting(false);
        toast.error(requestPayload.error || "L'arrivée est validée, mais la demande de remise a échoué.");
        return;
      }
    }

    setSubmitting(false);
    toast.success(shouldCreateDiscountRequest ? "Arrivée validée. Demande de remise envoyée." : "Arrivée validée. Le séjour est maintenant en cours.");
    setOpen(false);
    await onCompleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" className="gradient-teal text-accent-foreground h-10">
            {isPreRegistration ? "Terminer" : "Formulaire"}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isPreRegistration ? "Finaliser le pré-enregistrement" : "Formulaire"}: {stay.client.firstName} {stay.client.lastName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="font-medium text-primary">{steps[step].title}</div>
              <Badge variant="outline">{workflowLabel}</Badge>
            </div>
            <Progress value={((step + 1) / steps.length) * 100} />
            <div className="grid gap-2 md:grid-cols-3">
              {steps.map((item, index) => (
                <div key={item.title} className={`rounded-xl border px-4 py-3 text-sm ${index === step ? "border-primary bg-primary/5" : "border-border text-muted-foreground"}`}>
                  <div className="font-medium">{index + 1}. {item.title}</div>
                </div>
              ))}
            </div>
          </div>

          {step === 0 && (
            <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
              <Card className="space-y-4 p-5">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={infoTab === "prevision" ? "default" : "outline"} onClick={() => setInfoTab("prevision")}>Prévision</Button>
                  <Button type="button" size="sm" variant={infoTab === "presence" ? "default" : "outline"} onClick={() => setInfoTab("presence")}><History className="mr-1 h-4 w-4" /> Présences</Button>
                  <Button type="button" size="sm" variant={infoTab === "information" ? "default" : "outline"} onClick={() => setInfoTab("information")}><Bell className="mr-1 h-4 w-4" /> Informations</Button>
                </div>
                {infoTab === "prevision" && (
                  <div className="space-y-3 text-sm">
                    <div className="rounded-2xl border p-4">
                      <div className="font-medium">{stay.reservation ? "Réservation prévue" : "Pré-enregistrement"}</div>
                      <div className="mt-2 text-muted-foreground">Arrivée prévue: {formatDateLabel(plannedStartLabel)}</div>
                      <div className="text-muted-foreground">Départ prévu: {formatDateLabel(plannedEndLabel)}</div>
                      {(plannedStartOriginalLabel !== plannedStartLabel || plannedEndOriginalLabel !== plannedEndLabel)}
                    </div>
                    {reservationIdentityMismatch && (
                      <div className="rounded-2xl border p-4 text-sm text-amber-700">
                        L'identité actuelle ne correspond pas au nom initialement saisi. Vérifie avant la remise de clé.
                      </div>
                    )}
                  </div>
                )}
                {infoTab === "presence" && (
                  <div className="space-y-3 text-sm">
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Historique chargé</div>
                      <div className="mt-1 text-lg font-semibold text-primary">{formatVisitCount(stay.visitCount)}</div>
                    </div>
                    {(stay.client.sejours ?? []).slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-2xl border p-4">
                        <div className="font-medium">{offerLabels[item.offer] ?? item.offer}</div>
                        <div className="text-xs text-muted-foreground">{item.chambre?.numero ? `Chambre ${item.chambre.numero}` : "Chambre non renseignée"}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(item.startedAt), "dd/MM/yyyy")} au {format(new Date(item.currentEndAt), "dd/MM/yyyy")}</div>
                      </div>
                    ))}
                  </div>
                )}
                {infoTab === "information" && (
                  <div className="space-y-3 text-sm">
                    {(stay.clientNotes ?? []).length > 0 ? (
                      <div className="space-y-3">
                        {(stay.clientNotes ?? []).slice(0, 4).map((note) => (
                          <div key={note.id} className="rounded-2xl border p-4">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">{note.moment === "avant" ? "Avant séjour" : "Après séjour"}</div>
                            <div className="mt-1 text-sm">{note.comment}</div>
                          </div>
                        ))}
                      </div>
                    ) : stay.reservation?.notes ? (
                      <div className="rounded-2xl border p-4 text-muted-foreground">{stay.reservation.notes}</div>
                    ) : (
                      <div className="rounded-2xl border border-dashed p-4 text-muted-foreground">Aucune information complémentaire avant l'activation.</div>
                    )}
                  </div>
                )}
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Prénom</Label>
                  <Input className="h-11" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input className="h-11" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input className="h-11" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input className="h-11" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </div>
                <div>
                  <Label>Nationalité</Label>
                  <Input className="h-11" value={form.nationality} onChange={(event) => setForm({ ...form, nationality: event.target.value })} />
                </div>
                <div>
                  <Label>Sexe</Label>
                  <Select value={form.gender} onValueChange={(value) => setForm({ ...form, gender: value as FormState["gender"] })}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homme">Homme</SelectItem>
                      <SelectItem value="femme">Femme</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type de pièce</Label>
                  <Select value={form.documentType} onValueChange={(value) => setForm({ ...form, documentType: value as FormState["documentType"], keyHanded: false })}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cni">CNI</SelectItem>
                      <SelectItem value="passport">Passeport</SelectItem>
                      <SelectItem value="titre_sejour">Titre de séjour</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Numéro de pièce</Label>
                  <Input className="h-11" value={form.documentNumber} onChange={(event) => setForm({ ...form, documentNumber: event.target.value, keyHanded: false })} placeholder="Obligatoire avant la clé" />
                </div>
                <div>
                  <Label>Date de naissance</Label>
                  <Input className="h-11" type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} />
                  {form.birthDate && !hasAdultAge && <div className="mt-1 text-xs text-red-600">18 ans minimum.</div>}
                </div>
                <div>
                  <Label>Nombre de jours</Label>
                  <Input className="h-11" type="number" min="1" value={form.dayCount} onChange={(event) => setForm({ ...form, dayCount: Math.max(1, Number(event.target.value) || 1) })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Information d'arrivée</Label>
                  <Textarea className="min-h-28" value={form.behaviorBefore} onChange={(event) => setForm({ ...form, behaviorBefore: event.target.value })} placeholder="Venu plus tôt, arrivée reportée, parent présent, note utile pour l'équipe..." />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
              <Card className="space-y-4 p-5">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Calcul du séjour</div>
                  <div className="mt-1 text-xl font-semibold text-primary">{offerLabels[form.offer] ?? form.offer}</div>
                </div>
                {pricingError ? (
                  <div className="rounded-2xl border p-4 text-sm text-amber-700">{pricingError}</div>
                ) : normalizedSummary ? (
                  <div className="space-y-2 text-sm">
                    <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                      {stay.reservation?.createdAt
                        ? `Réservé le ${formatDateLabel(stay.reservation.createdAt)}`
                        : `Enregistré le ${formatDateLabel(form.paymentPaidAt || new Date().toISOString())}`}
                    </div>
                    <div className="flex items-center justify-between"><span>Coût</span><strong>{formatCurrency(normalizedSummary.baseAmount)}</strong></div>
                    <div className="flex items-center justify-between"><span>Réduction</span><span>- {formatCurrency(normalizedSummary.discountAmount)}</span></div>
                    {!isAdmin && hasRequestedDiscount && (
                      <div className="flex items-center justify-between text-amber-700"><span>Remise</span><span>- {formatCurrency(normalizedSummary.requestedDiscountAmount)}</span></div>
                    )}
                    <div className="flex items-center justify-between"><span>Acompte</span><span>- {formatCurrency(normalizedSummary.alreadyPaid)}</span></div>
                    <div className="flex items-center justify-between text-base font-semibold text-primary"><span>Reste à payer</span><span>{formatCurrency(normalizedSummary.remainingBefore)}</span></div>
                    <div className="flex items-center justify-between"><span>Encaissé</span><span>{formatCurrency(form.paymentAmount)}</span></div>
                    <div className="flex items-center justify-between text-base font-semibold"><span>Solde</span><span className={normalizedSummary.remainingAfter > 0 ? "text-red-600" : "text-emerald-600"}>- {formatCurrency(normalizedSummary.remainingAfter)}</span></div>
                  </div>
                ) : null}
              </Card>

              <div className="space-y-4">
                <div>
                  <Label>Offre</Label>
                  <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                    {OFFER_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={form.offer === option.value ? "default" : "outline"}
                        className="h-11 justify-center"
                        onClick={() => setForm({
                          ...form,
                          offer: option.value as OfferCode,
                          dayCount: offerNeedsDayCount(option.value as OfferCode) ? Math.max(1, form.dayCount) : form.dayCount,
                          chambreId: "",
                          depositHeldAmount: offerRequiresVillaDeposit(option.value as OfferCode) ? form.depositHeldAmount : 0,
                          depositNotes: offerRequiresVillaDeposit(option.value as OfferCode) ? form.depositNotes : "",
                        })}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {offerNeedsDayCount(form.offer) && (
                  <div>
                    <Label>Nombre de jours</Label>
                    <Input className="h-11" type="number" min="1" value={form.dayCount} onChange={(event) => setForm({ ...form, dayCount: Math.max(1, Number(event.target.value) || 1) })} />
                  </div>
                )}
                {form.offer === "personnalise" && (
                  <div>
                    <Label>Montant personnalisé</Label>
                    <Input className="h-11" type="number" min="0" value={form.customAmount} onChange={(event) => setForm({ ...form, customAmount: Number(event.target.value) || 0 })} />
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>{isAdmin ? "Réduction" : "Type de remise demandée"}</Label>
                    <Select value={form.discountType} onValueChange={(value) => setForm({ ...form, discountType: value as DiscountCode })}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        <SelectItem value="percent">Pourcentage</SelectItem>
                        <SelectItem value="fixed">Montant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{isAdmin ? "Remise" : "Valeur demandée"}</Label>
                    <Input className="h-11" type="number" min="0" value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: Number(event.target.value) || 0 })} />
                  </div>
                </div>
                {!isAdmin && hasRequestedDiscount && (
                  <div>
                    <Label>Motif de la remise</Label>
                    <Textarea
                      className="min-h-24"
                      value={form.discountReason}
                      onChange={(event) => setForm({ ...form, discountReason: event.target.value })}
                      placeholder="Motif transmis à l'administrateur"
                    />
                  </div>
                )}
                <div>
                  <Label>Modalité de paiement</Label>
                  <Select value={form.paymentArrangement} onValueChange={(value) => setForm({ ...form, paymentArrangement: value as PaymentArrangementCode })}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_ARRANGEMENT_CODES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value === "immediat" ? "immédiat" : value === "avance_partielle" ? "Acompte" : "fin de séjour"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Mode</Label>
                    <Select value={form.paymentMethod} onValueChange={(value) => setForm({ ...form, paymentMethod: value as FormState["paymentMethod"] })}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(paymentMethodLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Montant encaissé</Label>
                    <Input className="h-11" type="number" min="0" max={normalizedSummary?.remainingBefore ?? undefined} value={form.paymentAmount} onChange={(event) => setForm({ ...form, paymentAmount: Number(event.target.value) || 0 })} />
                  </div>
                </div>
                {showPaymentTrace && (
                  <div className="grid gap-4 rounded-2xl border p-4 md:grid-cols-2">
                    <div>
                      <Label>Opérateur</Label>
                      <Input className="h-11" value={form.paymentOperator} onChange={(event) => setForm({ ...form, paymentOperator: event.target.value })} placeholder="Wave, Orange Money, MTN..." />
                    </div>
                    <div>
                      <Label>Numéro payeur</Label>
                      <Input className="h-11" value={form.payerPhone} onChange={(event) => setForm({ ...form, payerPhone: event.target.value })} placeholder="Numéro utilisé" />
                    </div>
                    <div>
                      <Label>Référence transaction</Label>
                      <Input className="h-11" value={form.paymentReference} onChange={(event) => setForm({ ...form, paymentReference: event.target.value })} placeholder="ID ou référence" />
                    </div>
                    <div>
                      <Label>Heure paiement</Label>
                      <Input className="h-11" type="datetime-local" value={form.paymentPaidAt} onChange={(event) => setForm({ ...form, paymentPaidAt: event.target.value })} />
                    </div>
                  </div>
                )}
                {normalizedSummary && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, paymentAmount: normalizedSummary.remainingBefore })}>Solder</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, paymentAmount: 0 })}>Effacer</Button>
                  </div>
                )}
                {requiresVillaDeposit && (
                  <div className="rounded-2xl border p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-primary">Caution villa</div>
                        <div className="text-sm text-muted-foreground">Trace séparée, restituée ou conservée à la sortie.</div>
                      </div>
                      <div className="text-sm font-semibold">{formatCurrency(expectedDepositAmount)}</div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Caution encaissée</Label>
                        <Input className="h-11" type="number" min="0" max={expectedDepositAmount} value={form.depositHeldAmount} onChange={(event) => setForm({ ...form, depositHeldAmount: Number(event.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label>Mode caution</Label>
                        <Select value={form.depositMethod} onValueChange={(value) => setForm({ ...form, depositMethod: value as FormState["depositMethod"] })}>
                          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(paymentMethodLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, depositHeldAmount: expectedDepositAmount })}>Caution complète</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, depositHeldAmount: 0 })}>Sans caution</Button>
                    </div>
                    <div>
                      <Label>Note caution</Label>
                      <Input className="h-11" value={form.depositNotes} onChange={(event) => setForm({ ...form, depositNotes: event.target.value })} placeholder="Référence, état des lieux, garantie..." />
                    </div>
                  </div>
                )}
                <div>
                  <Label>Note interne</Label>
                  <Textarea className="min-h-28" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Adaptation d'offre, arrivée avancée, commentaire utile pour la suite du séjour..." />
                </div>
              </div>
            </div>
          )}

          {step === 2 && normalizedSummary && (
            <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
              <Card className="space-y-4 p-5">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Vérification finale</div>
                  <div className="font-semibold text-primary">Dossier prêt</div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span>Nom complet</span><span>{form.firstName} {form.lastName}</span></div>
                  <div className="flex items-center justify-between"><span>Pièce</span><span>{hasIdentityDocument ? `${documentTypeLabels[form.documentType]} - ${form.documentNumber}` : "À compléter avant la clé"}</span></div>
                  <div className="flex items-center justify-between"><span>Offre</span><span>{offerLabels[form.offer] ?? form.offer}</span></div>
                  <div className="flex items-center justify-between"><span>Total net</span><strong>{formatCurrency(normalizedSummary.netAmount)}</strong></div>
                  <div className="flex items-center justify-between"><span>Reste</span><span className={normalizedSummary.remainingAfter > 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>{formatCurrency(normalizedSummary.remainingAfter)}</span></div>
                  {requiresVillaDeposit && (
                    <div className="flex items-center justify-between"><span>Caution villa</span><span>{formatCurrency(form.depositHeldAmount)} / {formatCurrency(expectedDepositAmount)}</span></div>
                  )}
                </div>
                <div className="rounded-2xl border p-4 text-sm">
                  <div className="mb-3 font-medium text-primary">Chambre sélectionnée</div>
                  {selectedRoom ? (
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between"><span>Numéro</span><strong>{selectedRoom.numero}</strong></div>
                      <div className="flex items-center justify-between"><span>Catégorie</span><span>{roomCategoryLabels[selectedRoom.categorie] ?? selectedRoom.categorie}</span></div>
                      <div className="flex items-center justify-between"><span>Tarif</span><span>{formatCurrency(selectedRoom.prix)} / jour</span></div>
                      <div className="flex items-center justify-between"><span>Statut</span><span>{roomStatusLabels[selectedRoom.status] ?? selectedRoom.status}</span></div>
                      <div className="flex items-center justify-between"><span>Type</span><span>{selectedRoom.type}</span></div>
                      <div className="flex items-center justify-between"><span>Capacité</span><span>{selectedRoom.capacite ?? "Non renseignée"}</span></div>
                      {stay.reservation && (
                        <>
                          <div className="flex items-center justify-between"><span>Arrivée prévue</span><span>{formatDateLabel(plannedStartLabel)}</span></div>
                          <div className="flex items-center justify-between"><span>Départ prévu</span><span>{formatDateLabel(plannedEndLabel)}</span></div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">Sélectionne une chambre pour afficher ses détails.</div>
                  )}
                </div>
                {!hasIdentityDocument && (
                  <div className="rounded-2xl border p-4 text-sm text-amber-700">La pièce doit être conforme avant toute remise de clé.</div>
                )}
              </Card>

              <div className="space-y-4">
                <div className="rounded-2xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-primary">Clé remise</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={form.keyHanded ? "default" : "outline"}>{form.keyHanded ? "Confirmée" : "À confirmer"}</Badge>
                      <Button type="button" variant="outline" onClick={() => setKeyDialogOpen(true)}>Remettre la clé</Button>
                    </div>
                  </div>
                </div>
                <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
                  <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>Remise de clé</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="rounded-2xl border p-4 text-sm">
                        <div className="font-medium text-primary">{form.firstName} {form.lastName}</div>
                        <div className="text-muted-foreground">Chambre {rooms.find((room) => room.id === form.chambreId)?.numero ?? stay.chambre.numero}</div>
                      </div>
                      {!isPreRegistration && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label>Date d'entrée</Label>
                            <Input className="h-11" type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value, keyHanded: false })} />
                          </div>
                          <div>
                            <Label>Date de sortie</Label>
                            <Input className="h-11" type="datetime-local" value={form.endAt} readOnly />
                          </div>
                        </div>
                      )}
                      <div>
                        <Label>Pièce présentée</Label>
                        <Select value={form.documentType} onValueChange={(value) => setForm({ ...form, documentType: value as FormState["documentType"], keyHanded: false })}>
                          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cni">CNI</SelectItem>
                            <SelectItem value="passport">Passeport</SelectItem>
                            <SelectItem value="titre_sejour">Titre de séjour</SelectItem>
                            <SelectItem value="autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Numéro de pièce</Label>
                        <Input className="h-11" value={form.documentNumber} onChange={(event) => setForm({ ...form, documentNumber: event.target.value, keyHanded: false })} />
                      </div>
                      <Button type="button" className="w-full gradient-teal text-accent-foreground" onClick={confirmKeyHanded}>
                        Confirmer la remise de clé
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="space-y-4">
                  <div>
                    <Label>Recherche chambre</Label>
                    <Input
                      className="h-11"
                      value={roomQuery}
                      onChange={(event) => setRoomQuery(event.target.value)}
                      placeholder="Numéro, type ou catégorie"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredRooms.length === 0 ? (
                      <div className="rounded-2xl border p-4 text-sm text-muted-foreground xl:col-span-3">
                        Aucune chambre compatible, libre et propre pour cette recherche.
                      </div>
                    ) : (
                      filteredRooms.map((room) => (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => setForm({ ...form, chambreId: room.id, keyHanded: false })}
                          className={`rounded-2xl border p-4 text-left text-sm transition ${form.chambreId === room.id ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium">Chambre {room.numero}</div>
                            {form.chambreId === room.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </div>
                          <div className="text-muted-foreground">{room.type}</div>
                          <div className="text-xs text-muted-foreground">{formatCurrency(room.prix)} / jour</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => (step === 0 ? setOpen(false) : setStep((current) => Math.max(current - 1, 0)))}>
              {step === 0 ? "Annuler" : <><ArrowLeft className="mr-1 h-4 w-4" /> Retour</>}
            </Button>
            <div className="flex flex-wrap gap-2">
              {step < steps.length - 1 ? (
                <Button type="button" className="gradient-teal text-accent-foreground" onClick={handleNext}>
                  Suivant <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" className="gradient-teal text-accent-foreground" onClick={handleSubmit} disabled={submitting || !canSubmit}>
                  {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
                  Commencer le séjour
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
