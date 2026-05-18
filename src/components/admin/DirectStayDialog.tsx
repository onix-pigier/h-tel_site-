"use client";

import { addDays, format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarRange, CheckCircle2, History, Hotel, Loader2, PhoneCall, Plus, Receipt, ShieldCheck } from "lucide-react";
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
  getDefaultEndAt,
  getExpectedDepositAmount,
  getImmediateOfferBlockMessage,
  offerNeedsDayCount,
  offerRequiresVillaDeposit,
  OfferCode,
  OFFER_OPTIONS,
  PaymentArrangementCode,
  PAYMENT_ARRANGEMENT_CODES,
} from "@/lib/pricing";
import {
  documentTypeLabels,
  formatCurrency,
  formatVisitCount,
  offerLabels,
  paymentMethodLabels,
  roomCategoryLabels,
  roomStatusLabels,
  workflowLabels,
} from "@/lib/hotel-display";
import type { StayWorkflowKind } from "@/lib/reference";
import { isAdultAt } from "@/lib/date-rules";
import { buildModalFieldChanges, type AuditSnapshot } from "@/lib/modal-audit";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export interface DirectStayDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  gender: "homme" | "femme" | "autre";
  guestCount: number;
  documentNumber: string;
  documentType: "cni" | "passport" | "titre_sejour" | "autre";
  birthDate: string;
  chambreId: string;
  offer: string;
  startAt: string;
  endAt: string;
  dayCount?: number;
  customAmount: number;
  discountType: string;
  discountValue: number;
  paymentArrangement: string;
  paymentMethod: string;
  initialPayment: number;
  paymentOperator?: string;
  payerPhone?: string;
  paymentReference?: string;
  paymentPaidAt?: string;
  depositHeldAmount?: number;
  depositMethod?: "especes" | "mobile_money" | "carte" | "virement" | "autre";
  depositNotes?: string;
  keyHanded?: boolean;
  notes: string;
  behaviorBefore: string;
  discountReason?: string;
}

interface RoomChoice {
  id: string;
  numero: string;
  type: string;
  categorie: string;
  prix: number;
  status: string;
  capacite?: number | null;
  available: boolean;
}

interface PresencePreviewItem {
  id: string;
  code: string;
  offer: string;
  startedAt: string;
  currentEndAt: string;
  chambre?: { numero: string } | null;
}

interface ClientPreview {
  visitCount: number;
  phone?: string;
  email?: string | null;
  nationality?: string | null;
  gender?: "homme" | "femme" | "autre" | null;
  sejours?: PresencePreviewItem[];
  clientNotes?: Array<{
    id: string;
    moment: string;
    comment: string;
    createdAt: string;
  }>;
}

interface DirectStayDialogProps {
  workflow: Exclude<StayWorkflowKind, "web">;
  initialDraft: DirectStayDraft;
  clientPreview?: ClientPreview | null;
  onCompleted?: (createdStay?: { id?: string; status?: string; workflowKind?: string }) => void | Promise<void>;
}

type ReservationOrigin = "comptoir" | "appel";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  gender: "homme" | "femme" | "autre";
  guestCount: number;
  documentNumber: string;
  documentType: "cni" | "passport" | "titre_sejour" | "autre";
  birthDate: string;
  chambreId: string;
  offer: OfferCode;
  startAt: string;
  endAt: string;
  dayCount: number;
  customAmount: number;
  discountType: DiscountCode;
  discountValue: number;
  paymentArrangement: PaymentArrangementCode;
  paymentMethod: "especes" | "mobile_money" | "carte" | "virement" | "autre";
  initialPayment: number;
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

const directAuditLabels: Record<string, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  phone: "Téléphone",
  nationality: "Nationalité",
  document: "Pièce",
  offer: "Offre",
  startAt: "Début",
  endAt: "Fin",
  dayCount: "Nombre de jours",
  room: "Chambre",
  discount: "Remise",
  paymentArrangement: "Modalité paiement",
  paymentMethod: "Mode paiement",
  initialPayment: "Montant encaissé",
  depositHeldAmount: "Caution villa",
  keyHanded: "Clé remise",
};

function buildDirectAuditSnapshot(form: FormState, rooms: RoomChoice[]): AuditSnapshot {
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
    room: room ? `Chambre ${room.numero} - ${room.type}` : form.chambreId || null,
    discount: form.discountType === "none" ? null : `${form.discountType} ${form.discountValue}`,
    paymentArrangement: form.paymentArrangement,
    paymentMethod: paymentMethodLabels[form.paymentMethod] ?? form.paymentMethod,
    initialPayment: form.initialPayment,
    depositHeldAmount: form.depositHeldAmount,
    keyHanded: form.keyHanded ? "Oui" : "Non",
  };
}

const steps = [{ title: "Identité" }, { title: "Caisse" }, { title: "Attribution" }] as const;

function toDateTimeLocalValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy HH:mm");
}

function formatDateTimeValue(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy HH:mm");
}

function getDefaultStart(workflow: Exclude<StayWorkflowKind, "web">) {
  if (workflow === "direct") {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  }

  const future = addDays(new Date(), 1);
  future.setHours(14, 0, 0, 0);
  return future;
}

function getDefaultNightStart() {
  const start = new Date();
  if (start.getHours() < 12) {
    start.setDate(start.getDate() - 1);
  }
  start.setHours(21, 0, 0, 0);
  return start;
}

function getInitialStart(workflow: Exclude<StayWorkflowKind, "web">, offer: OfferCode, hasDraftStart: boolean) {
  if (!hasDraftStart && workflow === "direct" && offer === "nuitee") {
    return getDefaultNightStart();
  }
  return getDefaultStart(workflow);
}

function buildDefaultForm(workflow: Exclude<StayWorkflowKind, "web">, draft: DirectStayDraft): FormState {
  const offer = (draft.offer as OfferCode) || (workflow === "direct" ? "nuitee" : "forfait_semaine");
  const fallbackStart = getInitialStart(workflow, offer, Boolean(draft.startAt));
  const startAtDate = draft.startAt ? new Date(draft.startAt) : fallbackStart;
  const startAt = Number.isNaN(startAtDate.getTime()) ? fallbackStart : startAtDate;
  const dayCount = Math.max(1, draft.dayCount ?? (offerNeedsDayCount(offer) ? 1 : 1));
  let endAtDate = draft.endAt ? new Date(draft.endAt) : null;
  try {
    endAtDate = endAtDate && !Number.isNaN(endAtDate.getTime()) ? endAtDate : getDefaultEndAt(offer, startAt, dayCount);
  } catch {
    endAtDate = addDays(startAt, 1);
    endAtDate.setHours(12, 0, 0, 0);
  }
  const endAt = endAtDate;

  return {
    firstName: draft.firstName ?? "",
    lastName: draft.lastName ?? "",
    email: draft.email ?? "",
    phone: draft.phone ?? "",
    nationality: draft.nationality ?? "",
    gender: draft.gender ?? "homme",
    guestCount: draft.guestCount || 1,
    documentNumber: draft.documentNumber ?? "",
    documentType: draft.documentType ?? "cni",
    birthDate: draft.birthDate ?? "",
    chambreId: draft.chambreId ?? "",
    offer,
    startAt: toDateTimeLocalValue(startAt),
    endAt: toDateTimeLocalValue(endAt),
    dayCount,
    customAmount: draft.customAmount ?? 0,
    discountType: (draft.discountType as DiscountCode) ?? "none",
    discountValue: draft.discountValue ?? 0,
    paymentArrangement: (draft.paymentArrangement as PaymentArrangementCode) ?? (workflow === "direct" ? "fin_sejour" : "fin_sejour"),
    paymentMethod: (draft.paymentMethod as FormState["paymentMethod"]) ?? "especes",
    initialPayment: draft.initialPayment ?? 0,
    paymentOperator: draft.paymentOperator ?? "",
    payerPhone: draft.payerPhone ?? "",
    paymentReference: draft.paymentReference ?? "",
    paymentPaidAt: draft.paymentPaidAt ?? toDateTimeLocalValue(new Date()),
    depositHeldAmount: draft.depositHeldAmount ?? 0,
    depositMethod: draft.depositMethod ?? "especes",
    depositNotes: draft.depositNotes ?? "",
    keyHanded: Boolean(draft.keyHanded ?? false),
    notes: draft.notes ?? "",
    behaviorBefore: draft.behaviorBefore ?? "",
    discountReason: draft.discountReason ?? "",
  };
}

export function DirectStayDialog({ workflow, initialDraft, clientPreview, onCompleted }: DirectStayDialogProps) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [rooms, setRooms] = useState<RoomChoice[]>([]);
  const roomsRef = useRef<RoomChoice[]>([]);
  const [roomQuery, setRoomQuery] = useState("");
  const [offerError, setOfferError] = useState<string | null>(null);
  const [infoTab, setInfoTab] = useState<"presence" | "information">("presence");
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const initialAuditSnapshotRef = useRef<AuditSnapshot | null>(null);
  const [reservationOrigin, setReservationOrigin] = useState<ReservationOrigin>(workflow === "appel" ? "appel" : "comptoir");
  const [form, setForm] = useState<FormState>(() => buildDefaultForm(workflow, initialDraft));

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);
  const selectedWorkflow: Exclude<StayWorkflowKind, "web"> = workflow === "direct" ? "direct" : reservationOrigin;
  const isDirectWorkflow = selectedWorkflow === "direct";
  const isReservationWorkflow = !isDirectWorkflow;
  const requiresVillaDeposit = offerRequiresVillaDeposit(form.offer);
  const expectedDepositAmount = getExpectedDepositAmount(form.offer);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setInfoTab("presence");
    setReservationOrigin(workflow === "appel" ? "appel" : "comptoir");
    const nextForm = buildDefaultForm(workflow, initialDraft);
    initialAuditSnapshotRef.current = buildDirectAuditSnapshot(nextForm, roomsRef.current);
    setForm(nextForm);
    setKeyDialogOpen(false);
    setOfferError(null);
  }, [initialDraft, open, workflow]);

  useEffect(() => {
    if (!open || !form.startAt || !form.offer) return;
    const startAt = new Date(form.startAt);
    if (Number.isNaN(startAt.getTime())) return;

    const directBlock = selectedWorkflow === "direct" ? getImmediateOfferBlockMessage(form.offer, startAt) : null;
    if (directBlock) {
      setOfferError(directBlock);
      return;
    }

    try {
      const pricing = calculateOfferAmount({
        offer: form.offer,
        startAt,
        endAt: form.endAt ? new Date(form.endAt) : null,
        customAmount: form.customAmount,
        roomDailyRate: rooms.find((room) => room.id === form.chambreId)?.prix ?? null,
        dayCount: form.dayCount,
      });
      const nextStartValue = toDateTimeLocalValue(pricing.normalizedStartAt);
      const nextEndValue = toDateTimeLocalValue(pricing.normalizedEndAt);
      setOfferError(null);
      setForm((current) => (
        current.startAt === nextStartValue && current.endAt === nextEndValue
          ? current
          : { ...current, startAt: nextStartValue, endAt: nextEndValue }
      ));
    } catch (error) {
      setOfferError(error instanceof Error ? error.message : "Offre indisponible pour cette date.");
    }
  }, [form.chambreId, form.customAmount, form.dayCount, form.endAt, form.offer, form.startAt, open, rooms, selectedWorkflow]);

  useEffect(() => {
    if (!open || !form.startAt || !form.offer || offerError) return;

    let cancelled = false;
    const loadRooms = async () => {
      setLoadingRooms(true);
      const params = new URLSearchParams({
        offer: form.offer,
        startAt: form.startAt,
        endAt: form.endAt,
      });
      if (form.dayCount > 0) params.set("stayDays", String(form.dayCount));

      const res = await fetch("/api/admin/attributions/available?" + params.toString(), { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (cancelled) return;

      if (!res.ok) {
        toast.error(payload.error || "Chargement des chambres impossible");
        setRooms([]);
        setLoadingRooms(false);
        return;
      }

      const nextRooms = Array.isArray(payload.chambres) ? payload.chambres : [];
      setRooms(nextRooms);
      setForm((current) => ({
        ...current,
        chambreId: nextRooms.some((room: RoomChoice) => room.id === current.chambreId)
          ? current.chambreId
          : nextRooms[0]?.id ?? "",
      }));
      setLoadingRooms(false);
    };

    void loadRooms();

    return () => {
      cancelled = true;
    };
  }, [form.dayCount, form.endAt, form.offer, form.startAt, offerError, open]);

  const pricingSummary = useMemo(() => {
    const startAt = new Date(form.startAt);
    const room = rooms.find((item) => item.id === form.chambreId);

    if (Number.isNaN(startAt.getTime())) {
      return null;
    }

    try {
      const pricing = calculateOfferAmount({
        offer: form.offer,
        startAt,
        endAt: form.endAt ? new Date(form.endAt) : null,
        customAmount: form.customAmount,
        roomDailyRate: room?.prix ?? null,
        dayCount: form.dayCount,
      });
      const effectiveDiscountType = isAdmin ? form.discountType : "none";
      const effectiveDiscountValue = isAdmin ? form.discountValue : 0;
      const discountAmount = applyDiscount(pricing.baseAmount, effectiveDiscountType, effectiveDiscountValue);
      const netAmount = Math.max(0, pricing.baseAmount - discountAmount);
      const balanceAfter = Math.max(0, netAmount - form.initialPayment);
      const requestedDiscountAmount = isAdmin ? discountAmount : applyDiscount(pricing.baseAmount, form.discountType, form.discountValue);

      return {
        baseAmount: pricing.baseAmount,
        discountAmount,
        requestedDiscountAmount,
        netAmount,
        balanceAfter,
        normalizedEndAt: pricing.normalizedEndAt,
      };
    } catch (error) {
      if (error instanceof Error && open) {
        return { error: error.message } as const;
      }
      return null;
    }
  }, [form.chambreId, form.customAmount, form.dayCount, form.discountType, form.discountValue, form.endAt, form.initialPayment, form.offer, form.startAt, isAdmin, open, rooms]);

  const pricingError = offerError ?? (pricingSummary && "error" in pricingSummary ? pricingSummary.error : null);
  const filteredRooms = useMemo(() => {
    const query = roomQuery.trim().toLowerCase();
    if (!query) return rooms;
    return rooms.filter((room) => `${room.numero} ${room.type} ${room.categorie}`.toLowerCase().includes(query));
  }, [roomQuery, rooms]);
  const selectedRoom = rooms.find((room) => room.id === form.chambreId) ?? null;
  const normalizedSummary = pricingSummary && !("error" in pricingSummary) ? pricingSummary : null;

  const hasAdultAge = isAdultAt(form.birthDate, form.startAt || new Date());

  const canProceedIdentity =
    form.firstName.trim().length >= 2 &&
    form.lastName.trim().length >= 2 &&
    form.phone.trim().length >= 8 &&
    form.nationality.trim().length >= 2 &&
    hasAdultAge;

  const hasRequestedDiscount = form.discountType !== "none" && form.discountValue > 0;
  const requiresPaymentTrace = form.initialPayment > 0 && form.paymentMethod !== "especes";
  const showPaymentTrace = form.paymentMethod !== "especes";

  const canProceedFinance =
    Boolean(normalizedSummary) &&
    !pricingError &&
    form.initialPayment >= 0 &&
    (!normalizedSummary || form.initialPayment <= normalizedSummary.netAmount) &&
    (form.paymentArrangement !== "immediat" || (normalizedSummary ? normalizedSummary.balanceAfter === 0 : false)) &&
    (form.paymentArrangement !== "avance_partielle" || form.initialPayment > 0) &&
    (!requiresPaymentTrace || (form.paymentOperator.trim().length >= 2 && form.payerPhone.trim().length >= 6 && form.paymentReference.trim().length >= 3 && Boolean(form.paymentPaidAt))) &&
    (!requiresVillaDeposit || form.depositHeldAmount <= expectedDepositAmount) &&
    (form.offer !== "personnalise" || form.notes.trim().length >= 4) &&
    (isAdmin || !hasRequestedDiscount || form.discountReason.trim().length >= 6);

  const requiresIdentityForKey = isDirectWorkflow;
  const hasIdentityDocument = form.documentNumber.trim().length >= 4;
  const canSaveRecord = canProceedIdentity && canProceedFinance && Boolean(form.chambreId);
  const canActivateNow = canSaveRecord && (!requiresIdentityForKey || hasIdentityDocument) && (!isDirectWorkflow || form.keyHanded);

  const confirmKeyHanded = () => {
    if (!form.chambreId) {
      toast.error("Choisis une chambre avant la remise de clé.");
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
      toast.error(!hasAdultAge ? "Le client doit avoir au moins 18 ans." : "Complète la fiche avant de continuer.");
      return;
    }

    if (step === 1 && !canProceedFinance) {
      toast.error(pricingError || "Vérifie la caisse.");
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleOfferSelection = (offer: OfferCode) => {
    setForm((current) => ({
      ...current,
      offer,
      chambreId: "",
      startAt: selectedWorkflow === "direct" && offer === "nuitee" ? toDateTimeLocalValue(getDefaultNightStart()) : current.startAt,
      dayCount: offerNeedsDayCount(offer) ? Math.max(1, current.dayCount) : 1,
      customAmount: offer === "personnalise" ? current.customAmount : 0,
      depositHeldAmount: offerRequiresVillaDeposit(offer) ? current.depositHeldAmount : 0,
      depositNotes: offerRequiresVillaDeposit(offer) ? current.depositNotes : "",
    }));
  };

  const handleSubmit = async () => {
    if (!canSaveRecord) {
      toast.error("Complète les étapes.");
      return;
    }

    setSubmitting(true);
    const fieldChanges = buildModalFieldChanges(
      initialAuditSnapshotRef.current ?? buildDirectAuditSnapshot(buildDefaultForm(workflow, initialDraft), rooms),
      buildDirectAuditSnapshot(form, rooms),
      directAuditLabels,
    );
    const stayPayload = {
      ...form,
      workflowKind: selectedWorkflow,
      discountType: isAdmin ? form.discountType : "none",
      discountValue: isAdmin ? form.discountValue : 0,
      keyHanded: form.keyHanded,
      fieldChanges,
    };

    const res = await fetch("/api/admin/stays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stayPayload),
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSubmitting(false);
      toast.error(payload.error || "Enregistrement impossible");
      return;
    }

    const shouldCreateDiscountRequest = !isAdmin && hasRequestedDiscount;
    if (shouldCreateDiscountRequest) {
      const requestRes = await fetch(`/api/admin/stays/${payload.id}/discount-requests`, {
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
        toast.error(requestPayload.error || "Le séjour est créé, mais la demande de remise a échoué.");
        return;
      }
    }

    setSubmitting(false);
    toast.success(
      isDirectWorkflow
        ? canActivateNow
          ? shouldCreateDiscountRequest
            ? "Séjour enregistré. Demande de remise envoyée."
            : "Séjour enregistré."
          : shouldCreateDiscountRequest
            ? "Pré-enregistrement créé. Demande de remise envoyée."
            : "Pré-enregistrement créé. La clé reste bloquée tant que la pièce et la remise de clé ne sont pas validées."
        : shouldCreateDiscountRequest
          ? "Réservation ajoutée. Demande de remise envoyée."
          : "Réservation ajoutée."
    );
    setOpen(false);
    await onCompleted?.(payload);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-teal text-accent-foreground h-11">
          <Plus className="mr-1 h-4 w-4" />
          {isDirectWorkflow ? "Enregistrement" : "Réservation"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isDirectWorkflow ? "Enregistrement" : "Réservation"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="font-medium text-primary">{steps[step].title}</div>
              <Badge variant="outline">{workflowLabels[selectedWorkflow]}</Badge>
            </div>
            <Progress value={((step + 1) / steps.length) * 100} />
            <div className="grid gap-2 md:grid-cols-3">
              {steps.map((item, index) => (
                <div
                  key={item.title}
                  className={`rounded-xl border px-4 py-3 text-sm ${index === step ? "border-primary bg-primary/5" : "border-border text-muted-foreground"}`}
                >
                  <div className="font-medium">{index + 1}. {item.title}</div>
                </div>
              ))}
            </div>
          </div>

          {step === 0 && (
            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <Card className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {selectedWorkflow === "appel" ? <PhoneCall className="h-5 w-5" /> : selectedWorkflow === "comptoir" ? <CalendarRange className="h-5 w-5" /> : <Hotel className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="font-semibold text-primary">{workflowLabels[selectedWorkflow]}</div>
                    <div className="text-sm text-muted-foreground">{isDirectWorkflow ? "" : selectedWorkflow === "appel" ? "" : ""}</div>
                  </div>
                </div>
                {isReservationWorkflow && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={reservationOrigin === "comptoir" ? "default" : "outline"} onClick={() => setReservationOrigin("comptoir")}>
                      <CalendarRange className="mr-1 h-4 w-4" /> Présentiel
                    </Button>
                    <Button type="button" size="sm" variant={reservationOrigin === "appel" ? "default" : "outline"} onClick={() => setReservationOrigin("appel")}>
                      <PhoneCall className="mr-1 h-4 w-4" /> Appel
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={infoTab === "presence" ? "default" : "outline"} onClick={() => setInfoTab("presence")}>
                    <History className="mr-1 h-4 w-4" /> Présences
                  </Button>
                  <Button type="button" size="sm" variant={infoTab === "information" ? "default" : "outline"} onClick={() => setInfoTab("information")}>
                    <ShieldCheck className="mr-1 h-4 w-4" /> Informations
                  </Button>
                </div>
                {infoTab === "presence" ? (
                  <div className="space-y-3 text-sm">
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Historique chargé</div>
                      <div className="mt-1 text-lg font-semibold text-primary">{formatVisitCount(clientPreview?.visitCount ?? 0)}</div>
                    </div>
                    {(clientPreview?.sejours ?? []).length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-4 text-muted-foreground">Aucune présence récente chargée.</div>
                    ) : (
                      (clientPreview?.sejours ?? []).slice(0, 4).map((stay) => (
                        <div key={stay.id} className="rounded-2xl border p-4">
                          <div className="font-medium">{offerLabels[stay.offer] ?? stay.offer}</div>
                          <div className="text-xs text-muted-foreground">{stay.chambre?.numero ? `Chambre ${stay.chambre.numero}` : "Chambre non renseignée"}</div>
                          <div className="text-xs text-muted-foreground">{format(new Date(stay.startedAt), "dd/MM/yyyy")} au {format(new Date(stay.currentEndAt), "dd/MM/yyyy")}</div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="rounded-2xl border p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Informations supplémentaires</div>
                      <div className="mt-3 space-y-3">
                        {(clientPreview?.clientNotes ?? []).length === 0 ? (
                          <div className="text-sm text-muted-foreground">Aucune information enregistrée pour ce client.</div>
                        ) : (
                          (clientPreview?.clientNotes ?? []).slice(0, 4).map((note) => (
                            <div key={note.id} className="rounded-xl border p-3">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground">{note.moment === "avant" ? "Avant séjour" : "Après séjour"}</div>
                              <div className="mt-1 text-sm">{note.comment}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                   
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
                  <Input className="h-11" value={form.documentNumber} onChange={(event) => setForm({ ...form, documentNumber: event.target.value, keyHanded: false })} placeholder={isDirectWorkflow ? "Obligatoire avant la clé" : "Peut être ajouté à l'arrivée"} />
                </div>
                <div>
                  <Label>Date de naissance</Label>
                  <Input className="h-11" type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} />
                  {form.birthDate && !hasAdultAge && <div className="mt-1 text-xs text-red-600">18 ans minimum.</div>}
                </div>
                <div>
                  <Label>Nombre de personnes</Label>
                  <Input className="h-11" type="number" min="1" value={form.guestCount} onChange={(event) => setForm({ ...form, guestCount: Number(event.target.value) || 1 })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Informations supplémentaires</Label>
                  <Textarea
                    className="min-h-28"
                    value={form.behaviorBefore}
                    onChange={(event) => setForm({ ...form, behaviorBefore: event.target.value })}
                    placeholder="Préférence, payeur, arrivée tardive, note utile..."
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
              <Card className="space-y-4 p-5">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Calcul</div>
                  <div className="mt-1 text-xl font-semibold text-primary">{offerLabels[form.offer] ?? form.offer}</div>
                </div>
                {pricingError ? (
                  <div className="rounded-2xl border p-4 text-sm text-amber-700">{pricingError}</div>
                ) : normalizedSummary ? (
                  <div className="space-y-2 text-sm">
                    <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                      Enregistré le {formatDateTimeValue(form.paymentPaidAt ? new Date(form.paymentPaidAt) : new Date())}
                    </div>
                    <div className="flex items-center justify-between"><span>Début</span><strong>{formatDateLabel(form.startAt)}</strong></div>
                    <div className="flex items-center justify-between"><span>Fin</span><strong>{formatDateTimeValue(normalizedSummary.normalizedEndAt)}</strong></div>
                    <div className="flex items-center justify-between"><span>Coût</span><strong>{formatCurrency(normalizedSummary.baseAmount)}</strong></div>
                    <div className="flex items-center justify-between"><span>Remise</span><span>- {formatCurrency(normalizedSummary.discountAmount)}</span></div>
                    {!isAdmin && hasRequestedDiscount && (
                      <div className="flex items-center justify-between text-amber-700"><span>Remise demandée</span><span>- {formatCurrency(normalizedSummary.requestedDiscountAmount)}</span></div>
                    )}
                    <div className="flex items-center justify-between"><span>Acompte</span><span>-{formatCurrency(form.initialPayment)}</span></div>
                    <div className="flex items-center justify-between text-base font-semibold"><span>Reste à payer</span><span className={normalizedSummary.balanceAfter > 0 ? "text-red-600" : "text-emerald-600"}>{formatCurrency(normalizedSummary.balanceAfter)}</span></div>
                  </div>
                ) : null}
              </Card>

              <div className="space-y-4">
                <div>
                  <Label>Offre</Label>
                  <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                    {OFFER_OPTIONS.map((option) => (
                      <Button key={option.value} type="button" variant={form.offer === option.value ? "default" : "outline"} className="h-11 justify-center" onClick={() => handleOfferSelection(option.value as OfferCode)}>
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Début du séjour</Label>
                    <Input className="h-11" type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value, keyHanded: false })} />
                  </div>
                  {offerNeedsDayCount(form.offer) ? (
                    <div>
                      <Label>Nombre de jours</Label>
                      <Input className="h-11" type="number" min="1" value={form.dayCount} onChange={(event) => setForm({ ...form, dayCount: Math.max(1, Number(event.target.value) || 1) })} />
                    </div>
                  ) : (
                    <div>
                      <Label>Fin</Label>
                      <Input className="h-11" type="datetime-local" value={form.endAt} readOnly />
                    </div>
                  )}
                </div>
                {offerNeedsDayCount(form.offer) && (
                  <div>
                    <Label>Fin</Label>
                    <Input className="h-11" type="datetime-local" value={form.endAt} readOnly />
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
                    <Label>Montant encaissé</Label>
                    <Input className="h-11" type="number" min="0" value={form.initialPayment} onChange={(event) => setForm({ ...form, initialPayment: Number(event.target.value) || 0 })} />
                  </div>
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
                    <Button type="button" variant="outline" onClick={() => setForm({ ...form, initialPayment: normalizedSummary.netAmount })}>
                      <Receipt className="mr-1 h-4 w-4" /> Solder
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setForm({ ...form, initialPayment: 0 })}>
                      effacer
                    </Button>
                  </div>
                )}
                {requiresVillaDeposit && (
                  <div className="rounded-2xl border p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-primary">Caution villa</div>
                        <div className="text-sm text-muted-foreground">Séparée du séjour et restituable à la sortie.</div>
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
                  <Textarea
                    className="min-h-28"
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Remise, précision d'arrivée, note interne..."
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && normalizedSummary && (
            <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
              <Card className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Récapitulatif</div>
                    <div className="font-semibold text-primary">Dossier prêt</div>
                  </div>
                  {loadingRooms && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span>Nom complet</span><span>{form.firstName} {form.lastName}</span></div>
                  <div className="flex items-center justify-between"><span>Pièce</span><span>{hasIdentityDocument ? `${documentTypeLabels[form.documentType]} - ${form.documentNumber}` : "À compléter avant la clé"}</span></div>
                  <div className="flex items-center justify-between"><span>Offre</span><span>{offerLabels[form.offer] ?? form.offer}</span></div>
                  <div className="flex items-center justify-between"><span>Total net</span><strong>{formatCurrency(normalizedSummary.netAmount)}</strong></div>
                  <div className="flex items-center justify-between"><span>Reste à payer</span><span className={normalizedSummary.balanceAfter > 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>{formatCurrency(normalizedSummary.balanceAfter)}</span></div>
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
                      <div className="flex items-center justify-between"><span>Étage</span><span>Non renseigné</span></div>
                      <div className="flex items-center justify-between"><span>Capacité</span><span>{selectedRoom.capacite ?? "Non renseignée"}</span></div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">Sélectionne une chambre pour afficher ses détails.</div>
                  )}
                </div>
                {requiresIdentityForKey && !hasIdentityDocument && (
                  <div className="rounded-2xl border p-4 text-sm text-amber-700">
                    La pièce reste obligatoire avant la remise de clé.
                  </div>
                )}
              </Card>

              <div className="space-y-4">
                <div>
                  <div className="rounded-2xl border p-4 mb-4">
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
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader><DialogTitle>Remise de clé</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="rounded-2xl border p-4 text-sm">
                          <div className="font-medium text-primary">{form.firstName} {form.lastName}</div>
                          <div className="text-muted-foreground">Chambre {rooms.find((room) => room.id === form.chambreId)?.numero ?? "non choisie"}</div>
                        </div>
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
                        onClick={() => room.available && setForm({ ...form, chambreId: room.id, keyHanded: false })}
                        disabled={!room.available}
                        className={`rounded-2xl border p-4 text-left text-sm transition ${
                          !room.available
                            ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                            : form.chambreId === room.id
                              ? "border-primary bg-primary/5"
                              : "hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">
                            Chambre {room.numero}
                            {!room.available && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                ({room.status === "occupee" ? "Occupée" : "Indisponible"})
                              </span>
                            )}
                          </div>
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
                <Button type="button" className="gradient-teal text-accent-foreground" onClick={handleSubmit} disabled={submitting || !canSaveRecord}>
                  {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  {isDirectWorkflow ? (canActivateNow ? "Finaliser l'enregistrement" : "Créer le pré-enregistrement") : "Enregistrer la réservation"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
