"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Ban, Brush, Download, Loader2, MoreHorizontal, Receipt, Search, SlidersHorizontal, UserSquare2 } from "lucide-react";
import { DirectStayDialog } from "@/components/admin/DirectStayDialog";
import type { DirectStayDraft } from "@/components/admin/DirectStayDialog";
import { PlannedArrivalDialog } from "@/components/admin/PlannedArrivalDialog";
import { StayCheckoutDialog } from "@/components/admin/StayCheckoutDialog";
import { StayReportDialog } from "@/components/admin/StayReportDialog";
import { WebAttributionsPanel } from "@/components/admin/WebAttributionsPanel";
import { WebReservationsPanel } from "@/components/admin/WebReservationsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clientGenderLabels, depositStatusLabels, formatCurrency, formatVisitCount, getWorkflowLabel, offerLabels, paymentStatusMeta } from "@/lib/hotel-display";
import { useAuth } from "@/hooks/useAuth";
import { toNumber } from "@/lib/stay-utils";
import { toast } from "sonner";

interface ClientLookupItem {
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
  visitCount: number;
  sejours?: Array<{
    id: string;
    code: string;
    source?: string | null;
    workflowKind?: string | null;
    status?: string | null;
    offer: string;
    startedAt: string;
    currentEndAt: string;
    checkedInAt?: string | null;
    chambre?: { numero: string } | null;
  }>;
  clientNotes?: Array<{
    id: string;
    moment: string;
    comment: string;
    createdAt: string;
  }>;
}

interface PaymentItem {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  type: string;
  extensionId: string | null;
  notes: string | null;
}

interface ExtensionItem {
  id: string;
  startedAt: string;
  endedAt: string;
  offer: string;
  netAmount: number;
  amountPaid: number;
  balanceDue: number;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  paymentStatus: string;
  payments: PaymentItem[];
}

interface DiscountRequestItem {
  id: string;
  status: "en_attente" | "approuvee" | "refusee" | "annulee";
  discountType: "none" | "percent" | "fixed";
  discountValue: number;
  approvedDiscountType?: "none" | "percent" | "fixed" | null;
  approvedDiscountValue?: number | null;
  reason: string;
  reviewNote?: string | null;
  createdAt: string;
  requestedBy: { id: string; firstName?: string | null; lastName?: string | null; email: string };
  reviewedBy?: { id: string; firstName?: string | null; lastName?: string | null; email: string } | null;
}

interface DepositItem {
  id: string;
  type: string;
  status: string;
  expectedAmount: number;
  heldAmount: number;
  returnedAmount: number;
  method?: string | null;
  notes?: string | null;
}

interface StayItem {
  id: string;
  code: string;
  source: string;
  workflowKind?: string | null;
  status: string;
  offer: string;
  startedAt: string;
  currentEndAt: string;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  plannedStartAtOriginal?: string | null;
  plannedEndAtOriginal?: string | null;
  netAmount: number;
  amountPaid: number;
  balanceDue: number;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  paymentStatus: string;
  visitCount: number;
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
  payments: PaymentItem[];
  extensions: ExtensionItem[];
  clientNotes?: Array<{ id: string; moment: string; comment: string; createdAt: string }>;
  discountRequests: DiscountRequestItem[];
  deposits: DepositItem[];
  notes?: string | null;
}

const defaultForm: DirectStayDraft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  nationality: "",
  gender: "homme",
  guestCount: 1,
  documentNumber: "",
  documentType: "cni",
  birthDate: "",
  chambreId: "",
  offer: "nuitee",
  startAt: "",
  endAt: "",
  customAmount: 0,
  discountType: "none",
  discountValue: 0,
  paymentArrangement: "fin_sejour",
  paymentMethod: "especes",
  initialPayment: 0,
  paymentOperator: "",
  payerPhone: "",
  paymentReference: "",
  paymentPaidAt: "",
  depositHeldAmount: 0,
  depositMethod: "especes",
  depositNotes: "",
  keyHanded: false,
  notes: "",
  behaviorBefore: "",
  discountReason: "",
};

const defaultPaymentForm = { amount: 0, method: "especes", type: "acompte", paidAt: "", paymentOperator: "", payerPhone: "", paymentReference: "", notes: "" };
const defaultExtensionForm = { offer: "nuitee", endAt: "", customAmount: 0, discountType: "none", discountValue: 0, initialPayment: 0, notes: "" };
const defaultDiscountRequestForm = { discountType: "percent", discountValue: 0, reason: "" };
const defaultDiscountReviewForm = { decision: "approuvee", approvedDiscountType: "percent", approvedDiscountValue: 0, reviewNote: "" };
const defaultFilters = { status: "all", source: "all", paymentStatus: "all", dateFrom: "", dateTo: "", query: "" };
const REMINDER_WINDOW_MS = 48 * 60 * 60 * 1000;
type RegistreView = "web" | "reservation" | "sejours";

function normalizeWhatsappPhone(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && !digits.startsWith("225")) {
    digits = "225" + digits;
  }
  return digits;
}

function shouldShowReminder(startAt: string) {
  const diff = new Date(startAt).getTime() - Date.now();
  return diff > 0 && diff <= REMINDER_WINDOW_MS;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function getValidDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCalendarDateDiff(start: Date, end: Date) {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((endUtc - startUtc) / DAY_MS));
}

function formatStayDuration(startValue: string, endValue: string) {
  const start = getValidDate(startValue);
  const end = getValidDate(endValue);
  if (!start || !end || end <= start) return "-";

  const minutes = Math.round((end.getTime() - start.getTime()) / MINUTE_MS);
  const calendarDays = getCalendarDateDiff(start, end);
  if (calendarDays >= 1) return `${calendarDays} ${calendarDays === 1 ? "nuit" : "nuits"}`;
  if (minutes === 12 * 60) return "1/2 journée";

  const hours = Math.max(1, Math.round(minutes / 60));
  return `${hours} ${hours === 1 ? "heure" : "heures"}`;
}

function formatReleaseCountdown(endValue: string, nowMs: number) {
  const end = getValidDate(endValue);
  if (!end) return "-";

  const diff = end.getTime() - nowMs;
  if (diff <= 0) return "À libérer maintenant";

  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / HOUR_MS);
  const minutes = Math.max(0, Math.ceil((diff % HOUR_MS) / MINUTE_MS));

  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function sortStaysByDate(items: StayItem[], field: "startedAt" | "currentEndAt", direction: "asc" | "desc" = "asc") {
  return [...items].sort((left, right) => {
    const diff = new Date(left[field]).getTime() - new Date(right[field]).getTime();
    return direction === "asc" ? diff : -diff;
  });
}

export default function RegistrePage() {
  const { isAdmin } = useAuth();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [stays, setStays] = useState<StayItem[]>([]);
  const [workflowRefreshToken, setWorkflowRefreshToken] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClientLookupItem[]>([]);
  const [selectedClientPreview, setSelectedClientPreview] = useState<ClientLookupItem | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [form, setForm] = useState(defaultForm);
  const [plannedArrivalStayId, setPlannedArrivalStayId] = useState<string | null>(null);
  const [pendingOpenStayId, setPendingOpenStayId] = useState<string | null>(null);
  const [pendingPreRegs, setPendingPreRegs] = useState<StayItem[]>([]);
  const [loadingPreRegs, setLoadingPreRegs] = useState(false);
  const [reportStayId, setReportStayId] = useState<string | null>(null);
  const [checkoutStayId, setCheckoutStayId] = useState<string | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; stayId: string; extensionId: string }>({ open: false, stayId: "", extensionId: "" });
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm);
  const [extensionDialog, setExtensionDialog] = useState<{ open: boolean; stayId: string }>({ open: false, stayId: "" });
  const [extensionForm, setExtensionForm] = useState(defaultExtensionForm);
  const [discountRequestDialog, setDiscountRequestDialog] = useState<{ open: boolean; stayId: string }>({ open: false, stayId: "" });
  const [discountRequestForm, setDiscountRequestForm] = useState(defaultDiscountRequestForm);
  const [discountReviewDialog, setDiscountReviewDialog] = useState<{ open: boolean; requestId: string }>({ open: false, requestId: "" });
  const [discountReviewForm, setDiscountReviewForm] = useState(defaultDiscountReviewForm);
  const [activeView, setActiveView] = useState<RegistreView>("sejours");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const loadStays = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.source !== "all") params.set("source", filters.source);
    if (filters.paymentStatus !== "all") params.set("paymentStatus", filters.paymentStatus);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.query.trim().length >= 2) params.set("query", filters.query.trim());

    const res = await fetch("/api/admin/stays?" + params.toString());
    if (!res.ok) {
      toast.error("Chargement du registre impossible");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setStays(data.items ?? []);
    setLoading(false);
  }, [filters.dateFrom, filters.dateTo, filters.paymentStatus, filters.query, filters.source, filters.status]);

  useEffect(() => {
    void loadStays();
  }, [loadStays]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), MINUTE_MS);
    return () => window.clearInterval(interval);
  }, []);


  useEffect(() => {
    if (!pendingOpenStayId) return;
    const target = stays.find((stay) => stay.id === pendingOpenStayId);
    if (target) {
      setPlannedArrivalStayId(target.id);
      setPendingOpenStayId(null);
    }
  }, [pendingOpenStayId, stays]);

  // If loading finishes and we still have a pending open that was not found, warn and clear.
  useEffect(() => {
    if (!pendingOpenStayId || loading) return;
    const target = stays.find((stay) => stay.id === pendingOpenStayId);
    if (!target) {
      toast.error("Le séjour pré-enregistré n'a pas été trouvé dans le registre. Vérifiez les filtres ou recherchez manuellement.");
      setPendingOpenStayId(null);
    }
  }, [loading, pendingOpenStayId, stays]);

  const loadPendingPreRegs = useCallback(async () => {
    setLoadingPreRegs(true);
    const res = await fetch("/api/admin/stays?status=planifie&source=direct&limit=100");
    if (!res.ok) {
      setLoadingPreRegs(false);
      return;
    }
    const data = await res.json();
    setPendingPreRegs(data.items ?? []);
    setLoadingPreRegs(false);
  }, []);

  const handleWorkflowMutation = useCallback(async () => {
    setWorkflowRefreshToken((current) => current + 1);
    await loadStays();
    await loadPendingPreRegs();
  }, [loadStays, loadPendingPreRegs]);

  useEffect(() => {
    if (activeView === "reservation") {
      void loadPendingPreRegs();
    }
  }, [activeView, loadPendingPreRegs]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.source !== "all") params.set("source", filters.source);
    if (filters.paymentStatus !== "all") params.set("paymentStatus", filters.paymentStatus);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.query.trim().length >= 2) params.set("query", filters.query.trim());
    return "/api/admin/stays/export/pdf?" + params.toString();
  }, [filters.dateFrom, filters.dateTo, filters.paymentStatus, filters.query, filters.source, filters.status]);

  const searchClients = async () => {
    if (searchQuery.trim().length < 2) {
      toast.error("Au moins 2 caractères sont requis.");
      return;
    }
    const res = await fetch("/api/admin/clients/search?q=" + encodeURIComponent(searchQuery.trim()));
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Recherche impossible");
      return;
    }
    setSearchResults(payload.items ?? []);
  };

  const applyClientSelection = (client: ClientLookupItem) => {
    const birthDate = client.birthDate ? client.birthDate.slice(0, 10) : "";
    setSelectedClientPreview(client);
    setForm((current) => ({
      ...current,
      firstName: client.firstName ?? "",
      lastName: client.lastName ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      nationality: client.nationality ?? "",
      gender: client.gender ?? "homme",
      documentNumber: client.documentNumber ?? "",
      documentType: (client.documentType as DirectStayDraft["documentType"]) ?? "cni",
      birthDate,
    }));
    toast.success("Fiche client pré-remplie pour le prochain tunnel présentiel.");
  };

  const openPreRegistration = (stay: NonNullable<ClientLookupItem["sejours"]>[number]) => {
    setActiveView("sejours");
    setFilters({ ...defaultFilters, status: "planifie", source: "direct", query: stay.code });
    setPendingOpenStayId(stay.id);
  };

  const clearPresentielDraft = () => {
    setSelectedClientPreview(null);
    setForm(defaultForm);
  };

  const handleDirectStayCompleted = async (createdStay?: { id?: string; status?: string; workflowKind?: string }) => {
    setSelectedClientPreview(null);
    setForm(defaultForm);
    await loadStays();
    await loadPendingPreRegs();

    if (createdStay?.id && createdStay.status === "planifie" && createdStay.workflowKind === "direct") {
      setActiveView("reservation");
      setPlannedArrivalStayId(createdStay.id);
      toast.success("Pré-enregistrement prêt à finaliser.");
    }
  };

  const updateStayStatus = async (stayId: string, body: { status: string; notes?: string | null; behaviorAfter?: string | null; absenceConfirmed?: boolean }) => {
    const res = await fetch("/api/admin/stays/" + stayId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Mise à jour impossible");
      return;
    }
    toast.success("Séjour mis à jour");
    await loadStays();
  };

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    const isStayPayment = !paymentDialog.extensionId;
    const resolvedType = paymentForm.type === "solde" ? "solde" : "acompte";
    const res = await fetch("/api/admin/stays/" + paymentDialog.stayId + "/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...paymentForm, type: resolvedType, extensionId: paymentDialog.extensionId || null }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Paiement impossible");
      return;
    }
    toast.success(isStayPayment && resolvedType === "acompte" ? "Acompte enregistré" : "Paiement enregistré");
    setPaymentDialog({ open: false, stayId: "", extensionId: "" });
    setPaymentForm(defaultPaymentForm);
    await loadStays();
  };

  const submitExtension = async (event: React.FormEvent) => {
    event.preventDefault();
    const extensionPayload = isAdmin ? extensionForm : { ...extensionForm, discountType: "none", discountValue: 0 };
    const res = await fetch("/api/admin/stays/" + extensionDialog.stayId + "/extensions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(extensionPayload),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Prolongation impossible");
      return;
    }
    toast.success("Extension enregistrée");
    setExtensionDialog({ open: false, stayId: "" });
    setExtensionForm(defaultExtensionForm);
    await loadStays();
  };

  const sendReminder = async (stay: StayItem) => {
    const message =
      `Bonjour ${stay.client.firstName}, la Résidence Les Chanaude vous rappelle votre arrivée prévue ` +
      `du ${format(new Date(stay.startedAt), "dd/MM/yyyy HH:mm")} au ${format(new Date(stay.currentEndAt), "dd/MM/yyyy HH:mm")}. ` +
      "Merci de nous confirmer votre heure d'arrivée.";

    const res = await fetch("/api/admin/stays/" + stay.id + "/reminder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "whatsapp" }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Rappel impossible");
      return;
    }

    const phone = normalizeWhatsappPhone(stay.client.phone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    toast.success("Rappel enregistré et WhatsApp ouvert.");
  };

  const markNoShow = async (stay: StayItem) => {
    const late = new Date(stay.startedAt).getTime() <= Date.now();
    const confirmed = window.confirm(
      late
        ? "Confirmer l'absence client et libérer la chambre ? L'acompte reste acquis."
        : "voulez vous annuler cette réservation avant arrivée ?"
    );
    if (!confirmed) return;

    await updateStayStatus(stay.id, {
      status: "annule",
      absenceConfirmed: late,
      notes: late ? "Absence client constatée depuis le registre." : "Réservation annulée depuis le registre.",
    });
  };

  const markRoomClean = async (roomId: string) => {
    const res = await fetch("/api/admin/chambres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: roomId, status: "disponible" }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Impossible de marquer la chambre comme propre");
      return;
    }

    toast.success("Chambre remise en disponible.");
    await loadStays();
  };

  const submitDiscountRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await fetch(`/api/admin/stays/${discountRequestDialog.stayId}/discount-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discountRequestForm),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Demande de remise impossible");
      return;
    }
    toast.success("Demande de remise envoyée.");
    setDiscountRequestDialog({ open: false, stayId: "" });
    setDiscountRequestForm(defaultDiscountRequestForm);
    await loadStays();
  };

  const submitDiscountReview = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await fetch(`/api/admin/discount-requests/${discountReviewDialog.requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discountReviewForm),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Traitement de la remise impossible");
      return;
    }
    toast.success(discountReviewForm.decision === "approuvee" ? "Remise approuvée." : "Demande refusée.");
    setDiscountReviewDialog({ open: false, requestId: "" });
    setDiscountReviewForm(defaultDiscountReviewForm);
    await loadStays();
  };


  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-primary">Registre</h1>
          <p className="text-sm text-muted-foreground">
            {activeView === "web"
              ? ""
              : activeView === "reservation"
                ? "Enregistrement direct, réservation comptoir et pré-enregistrements."
                : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-2xl border bg-muted/40 p-1">
          <Button type="button" size="sm" variant={activeView === "web" ? "default" : "ghost"} className={activeView === "web" ? "gradient-teal text-accent-foreground shadow-sm" : "text-muted-foreground"} onClick={() => setActiveView("web")}>Réservations</Button>
          <Button type="button" size="sm" variant={activeView === "reservation" ? "default" : "ghost"} className={activeView === "reservation" ? "gradient-teal text-accent-foreground shadow-sm" : "text-muted-foreground"} onClick={() => setActiveView("reservation")}>Enregistrements</Button>
          <Button type="button" size="sm" variant={activeView === "sejours" ? "default" : "ghost"} className={activeView === "sejours" ? "gradient-teal text-accent-foreground shadow-sm" : "text-muted-foreground"} onClick={() => setActiveView("sejours")}>Séjours</Button>
        </div>
      </div>

      <Dialog open={discountRequestDialog.open} onOpenChange={(open) => {
        setDiscountRequestDialog(open ? discountRequestDialog : { open: false, stayId: "" });
        if (!open) setDiscountRequestForm(defaultDiscountRequestForm);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Demande de remise</DialogTitle></DialogHeader>
          <form onSubmit={submitDiscountRequest} className="space-y-4 pt-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Type</Label>
                <Select value={discountRequestForm.discountType} onValueChange={(value) => setDiscountRequestForm({ ...discountRequestForm, discountType: value as "percent" | "fixed" })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Pourcentage</SelectItem>
                    <SelectItem value="fixed">Montant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valeur</Label>
                <Input className="h-11" type="number" min="0" value={discountRequestForm.discountValue} onChange={(e) => setDiscountRequestForm({ ...discountRequestForm, discountValue: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Motif</Label>
              <Textarea
                className="min-h-28"
                value={discountRequestForm.reason}
                onChange={(e) => setDiscountRequestForm({ ...discountRequestForm, reason: e.target.value })}
                placeholder="Motif transmis à l'administrateur"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDiscountRequestDialog({ open: false, stayId: "" })}>Annuler</Button>
              <Button type="submit" className="gradient-teal text-accent-foreground">Envoyer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={discountReviewDialog.open} onOpenChange={(open) => {
        setDiscountReviewDialog(open ? discountReviewDialog : { open: false, requestId: "" });
        if (!open) setDiscountReviewForm(defaultDiscountReviewForm);
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Traitement de la remise</DialogTitle></DialogHeader>
          <form onSubmit={submitDiscountReview} className="space-y-3 pt-2">
            <div>
              <Label>Décision</Label>
              <Select value={discountReviewForm.decision} onValueChange={(value) => setDiscountReviewForm({ ...discountReviewForm, decision: value as "approuvee" | "refusee" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approuvee">Approuver</SelectItem>
                  <SelectItem value="refusee">Refuser</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {discountReviewForm.decision === "approuvee" && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Type approuvé</Label>
                  <Select value={discountReviewForm.approvedDiscountType} onValueChange={(value) => setDiscountReviewForm({ ...discountReviewForm, approvedDiscountType: value as "percent" | "fixed" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Pourcentage</SelectItem>
                      <SelectItem value="fixed">Montant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valeur approuvée</Label>
                  <Input type="number" min="0" value={discountReviewForm.approvedDiscountValue} onChange={(e) => setDiscountReviewForm({ ...discountReviewForm, approvedDiscountValue: Number(e.target.value) || 0 })} />
                </div>
              </div>
            )}
            <div>
              <Label>Note</Label>
              <Input value={discountReviewForm.reviewNote} onChange={(e) => setDiscountReviewForm({ ...discountReviewForm, reviewNote: e.target.value })} placeholder="Note interne" />
            </div>
            <Button type="submit" className="w-full gradient-teal text-accent-foreground">Valider</Button>
          </form>
        </DialogContent>
      </Dialog>

      {activeView === "web" && (
        <div className="space-y-4">
          <WebReservationsPanel refreshToken={workflowRefreshToken} onMutation={handleWorkflowMutation} />
          <WebAttributionsPanel refreshToken={workflowRefreshToken} onMutation={handleWorkflowMutation} />
        </div>
      )}

      {activeView === "sejours" && (
        <div className="space-y-4">
          <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            <Card className="space-y-4 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex-1 min-w-[280px] space-y-2">
                  <Label>Recherche registre</Label>
                  <Input
                    value={filters.query}
                    onChange={(e) => setFilters((current) => ({ ...current, query: e.target.value }))}
                    placeholder="Code, client, pièce, téléphone, chambre..."
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="outline">
                      <SlidersHorizontal className="mr-1 h-4 w-4" />
                      Filtres
                    </Button>
                  </CollapsibleTrigger>
                  <Button type="button" variant="outline" onClick={() => setFilters(defaultFilters)}>
                    Réinitialiser
                  </Button>
                  <Button asChild className="gradient-teal text-accent-foreground">
                    <a href={exportUrl} target="_blank" rel="noreferrer"><Download className="mr-1 h-4 w-4" /> Export PDF</a>
                  </Button>
                </div>
              </div>

              <CollapsibleContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <Label>Statut séjour</Label>
                    <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        <SelectItem value="planifie">Réservation</SelectItem>
                        <SelectItem value="en_cours">En cours</SelectItem>
                        <SelectItem value="termine">Terminés</SelectItem>
                        <SelectItem value="annule">Annulés</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Source</Label>
                    <Select value={filters.source} onValueChange={(value) => setFilters((current) => ({ ...current, source: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes</SelectItem>
                        <SelectItem value="direct">Enregistrement</SelectItem>
                        <SelectItem value="comptoir">Présentiel</SelectItem>
                        <SelectItem value="appel">Appel</SelectItem>
                        <SelectItem value="web">Réservation web</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Statut paiement</Label>
                    <Select value={filters.paymentStatus} onValueChange={(value) => setFilters((current) => ({ ...current, paymentStatus: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        <SelectItem value="en_attente_paiement">Aucun acompte</SelectItem>
                        <SelectItem value="avance_versee">Acompte</SelectItem>
                        <SelectItem value="solde_en_cours">Solde à payer</SelectItem>
                        <SelectItem value="solde">Soldés</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Début période</Label>
                    <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters((current) => ({ ...current, dateFrom: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Fin période</Label>
                    <Input type="date" value={filters.dateTo} onChange={(e) => setFilters((current) => ({ ...current, dateTo: e.target.value }))} />
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      )}

      {activeView === "reservation" && (
        <Card id="registre-presentiel" className="p-5 space-y-4">
          <div className="space-y-6">
            {/* Section 0: Bouton enregistrement direct */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-primary">Enregistrement séjour</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <DirectStayDialog
                  workflow="direct"
                  initialDraft={form}
                  clientPreview={selectedClientPreview ? { visitCount: selectedClientPreview.visitCount, phone: selectedClientPreview.phone, email: selectedClientPreview.email, nationality: selectedClientPreview.nationality, gender: selectedClientPreview.gender, sejours: selectedClientPreview.sejours, clientNotes: selectedClientPreview.clientNotes } : null}
                  onCompleted={handleDirectStayCompleted}
                />
                <DirectStayDialog
                  workflow="appel"
                  initialDraft={form}
                  clientPreview={selectedClientPreview ? { visitCount: selectedClientPreview.visitCount, phone: selectedClientPreview.phone, email: selectedClientPreview.email, nationality: selectedClientPreview.nationality, gender: selectedClientPreview.gender, sejours: selectedClientPreview.sejours, clientNotes: selectedClientPreview.clientNotes } : null}
                  onCompleted={handleDirectStayCompleted}
                />
              </div>
            </div>

            {selectedClientPreview && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium text-emerald-800 dark:text-emerald-300">Client pré-sélectionné :</span>{" "}
                  <span className="text-emerald-700 dark:text-emerald-400">{selectedClientPreview.firstName} {selectedClientPreview.lastName} — {selectedClientPreview.phone}</span>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={clearPresentielDraft}>Effacer</Button>
              </div>
            )}

            <div className="border-t" />

            {/* Section 1: Recherche et sélection client existant */}
            <div className="space-y-3">
              <div className="text-lg font-semibold text-primary">Rechercher un client</div>
              <p className="text-sm text-muted-foreground">Recherche dans la base clients et signale les pré-enregistrements à finaliser.</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[260px]">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pièce, email, téléphone, nom, nationalité..."
                  />
                </div>
                <Button variant="outline" onClick={searchClients}>
                  <Search className="mr-1 h-4 w-4" /> Rechercher
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-[320px] overflow-y-auto pr-1">
                  <div className="grid gap-2 md:grid-cols-2">
                    {searchResults.map((client) => {
                      const pendingPreRegistration = client.sejours?.find((stay) => stay.status === "planifie" && stay.workflowKind === "direct");
                      const hasVisits = (client.visitCount ?? 0) > 0;

                      return (
                        <div key={client.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{client.firstName} {client.lastName}</div>
                              <div className="text-sm text-muted-foreground">{client.documentNumber || client.email || client.phone}</div>
                              <div className="text-xs text-muted-foreground">{client.nationality || "Nationalité non renseignée"}{client.gender ? " • " + (clientGenderLabels[client.gender] ?? client.gender) : ""}</div>
                              <div className="text-xs text-muted-foreground">{formatVisitCount(client.visitCount)}</div>
                            </div>
                            <Button size="sm" variant="outline" asChild>
                              <Link href={"/admin/clients/" + client.id}><UserSquare2 className="mr-1 h-4 w-4" /> Profil</Link>
                            </Button>
                          </div>
                          {pendingPreRegistration && (
                            <div className="mt-3 rounded-lg border bg-amber-50 p-3 text-sm text-amber-900">
                              <div className="font-medium">Pré-enregistrement à terminer</div>
                              <div className="text-xs">{pendingPreRegistration.code} • Chambre {pendingPreRegistration.chambre?.numero ?? "-"}</div>
                              <Button type="button" size="sm" className="mt-2" onClick={() => openPreRegistration(pendingPreRegistration)}>
Finaliser
                              </Button>
                            </div>
                          )}
                          <div className="pt-3 space-y-2">
                            <Button
                              type="button"
                              size="sm"
                              className="w-full gradient-teal text-accent-foreground"
                              onClick={() => applyClientSelection(client)}
                            >
                              Nouveau séjour
                            </Button>
                            {hasVisits && (
                              <div className="text-xs p-2 rounded border bg-blue-50 text-blue-700">
                                <div className="font-medium">Historique:</div>
                                <div className="mt-1 space-y-1">
                                  {client.sejours?.slice(0, 2).map((stay) => (
                                    <div key={stay.id} className="text-xs">
                                      • {stay.code} - {stay.offer} ({format(new Date(stay.startedAt), "dd/MM")})
                                    </div>
                                  ))}
                                  {(client.visitCount ?? 0) > 2 && <div className="text-xs">• +{(client.visitCount ?? 0) - 2} autre(s)</div>}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Aucun client trouvé. Vérifiez les termes de recherche.
                </div>
              )}
            </div>

            {/* Section 2: Pré-enregistrements en attente */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-primary">Pré-enregistrements en attente</div>
                {loadingPreRegs && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {loadingPreRegs ? (
                <div className="text-sm text-muted-foreground">Chargement...</div>
              ) : pendingPreRegs.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Aucun pré-enregistrement en attente.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {pendingPreRegs.map((stay) => (
                    <Card key={stay.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{stay.client.firstName} {stay.client.lastName}</div>
                          <div className="text-sm text-muted-foreground">Chambre {stay.chambre.numero} ({stay.chambre.type})</div>
                          <div className="text-xs text-muted-foreground">{stay.code}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(stay.startedAt), "dd/MM/yyyy HH:mm")} au {format(new Date(stay.currentEndAt), "dd/MM/yyyy HH:mm")}
                          </div>
                        </div>
                        <Badge variant="outline">En attente</Badge>
                      </div>
                      <div className="grid gap-2 text-xs text-muted-foreground">
                        <div>Pièce: {stay.client.documentNumber || "à compléter"}</div>
                        <div>Clé: non remise</div>
                      </div>
                      <Button size="sm" className="w-full gradient-teal text-accent-foreground" onClick={() => setPlannedArrivalStayId(stay.id)}>
                        Finaliser
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* PlannedArrivalDialog pour pré-enregistrement sélectionné dans l&apos;onglet Réservation */}
            {(() => {
              const selectedStay = plannedArrivalStayId ? pendingPreRegs.find((s) => s.id === plannedArrivalStayId) ?? null : null;
              if (!selectedStay) return null;
              return (
                <PlannedArrivalDialog
                  stay={selectedStay}
                  onCompleted={async () => {
                    await loadPendingPreRegs();
                    setPlannedArrivalStayId(null);
                  }}
                  open={true}
                  onOpenChange={(open) => { if (!open) setPlannedArrivalStayId(null); }}
                />
              );
            })()}
          </div>
        </Card>
      )}

      {activeView === "sejours" && (
        <div id="registre-sejours">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : stays.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">Aucun séjour pour les filtres courants.</Card>
          ) : (() => {
            const planifies = sortStaysByDate(stays.filter((s) => s.status === "planifie"), "startedAt", "asc");
            const enCours = sortStaysByDate(stays.filter((s) => s.status === "en_cours"), "currentEndAt", "asc");
            const clotures = sortStaysByDate(stays.filter((s) => s.status === "termine" || s.status === "annule"), "currentEndAt", "desc");
            const sections = [
              { key: "planifie", title: "Réservations", items: planifies, color: "text-amber-600", dot: "bg-amber-500" },
              { key: "en_cours", title: "Séjours en cours", items: enCours, color: "text-emerald-600", dot: "bg-emerald-500" },
              { key: "clotures", title: "Terminés / Annulés", items: clotures, color: "text-zinc-500", dot: "bg-zinc-400" },
            ].filter((section) => section.items.length > 0);

            return (
              <div className="space-y-6">
                {sections.map((section) => (
                  <div key={section.key} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${section.dot}`} />
                      <h2 className={`text-lg font-semibold ${section.color}`}>{section.title}</h2>
                      <Badge variant="outline" className="ml-1">{section.items.length}</Badge>
                    </div>
                    <div className="grid gap-4">
                      {section.items.map((stay) => {
                        const extensionNet = stay.extensions.reduce((sum, extension) => sum + toNumber(extension.netAmount), 0);
                        const extensionPaid = stay.extensions.reduce((sum, extension) => sum + toNumber(extension.amountPaid), 0);
                        const extensionBalance = stay.extensions.reduce((sum, extension) => sum + toNumber(extension.balanceDue), 0);
                        const totalNet = toNumber(stay.netAmount) + extensionNet;
                        const totalPaid = toNumber(stay.amountPaid) + extensionPaid;
                        const baseBalance = toNumber(stay.balanceDue);
                        const totalBalance = baseBalance + extensionBalance;
                        const selectedExtensionForPayment = stay.extensions.find((extension) => extension.id === paymentDialog.extensionId) ?? null;
                        const selectedPaymentBalance = paymentDialog.extensionId ? toNumber(selectedExtensionForPayment?.balanceDue ?? 0) : baseBalance;
                        const paymentRequiresTrace = paymentForm.method !== "especes";
                        const paymentTraceMissing = paymentRequiresTrace && (!paymentForm.paymentOperator.trim() || !paymentForm.payerPhone.trim() || !paymentForm.paymentReference.trim());
                        const canPaySelectedTarget = selectedPaymentBalance > 0 && (!paymentDialog.extensionId || baseBalance <= 0);
                        const unpaid = totalBalance > 0;
                        const isSolde = totalBalance <= 0;
                        const isClosed = stay.status === "termine" || stay.status === "annule";
                        const isPlanifie = stay.status === "planifie";
                        const isActive = stay.status === "en_cours";
                        const isLateArrival = isPlanifie && new Date(stay.startedAt).getTime() <= nowMs;
                        const isOverdueCheckout = isActive && new Date(stay.currentEndAt).getTime() < nowMs;
                        const reminderDue = isPlanifie && shouldShowReminder(stay.startedAt);
                        const latestPayment = [...stay.payments, ...stay.extensions.flatMap((extension) => extension.payments)]
                          .sort((left, right) => new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime())[0] ?? null;
                        const pendingDiscountRequest = (stay.discountRequests ?? []).find((request) => request.status === "en_attente") ?? null;
                        const appliedDiscountAmount = toNumber(stay.discountAmount);
                        const villaDeposit = (stay.deposits ?? []).find((deposit) => deposit.type === "caution_villa") ?? null;
                        const roomNeedsCleaning = stay.status === "termine" && stay.chambre.status === "attente_nettoyage";
                        const stayDurationLabel = formatStayDuration(stay.startedAt, stay.currentEndAt);
                        const releaseCountdownLabel = formatReleaseCountdown(stay.currentEndAt, nowMs);

                        return (
                          <Card
                            key={stay.id}
                            className={`p-5 space-y-3 ${isClosed ? "opacity-70" : ""} ${(isPlanifie || (isActive && (unpaid || isSolde))) ? "cursor-pointer" : ""}`}
                            onDoubleClick={() => {
                              if (isPlanifie) {
                                setPlannedArrivalStayId(stay.id);
                                return;
                              }

                              if (isActive && unpaid) {
                                setPaymentDialog({ open: true, stayId: stay.id, extensionId: "" });
                                setPaymentForm(defaultPaymentForm);
                                return;
                              }

                              if (isActive && isSolde) {
                                setCheckoutStayId(stay.id);
                              }
                            }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-semibold text-primary">{stay.client.firstName} {stay.client.lastName}</h3>
                                  <Badge variant="outline">{getWorkflowLabel((stay as { workflowKind?: string | null }).workflowKind, stay.code, stay.source)}</Badge>
                                  <Badge className={paymentStatusMeta[stay.paymentStatus]?.className}>{paymentStatusMeta[stay.paymentStatus]?.label ?? stay.paymentStatus}</Badge>
                                  <Badge variant="outline">{formatVisitCount(stay.visitCount)}</Badge>
                                  {reminderDue && <Badge variant="outline" className="border-amber-300 text-amber-700">Rappel le client</Badge>}
                                  {isLateArrival && <Badge variant="destructive">Retard</Badge>}
                                  {isOverdueCheckout && <Badge variant="destructive">À libérer</Badge>}
                                  {pendingDiscountRequest && <Badge variant="outline" className="border-primary/40 text-primary">Remise en attente</Badge>}
                                  {isClosed && <Badge variant="destructive" className="flex items-center gap-1"><Ban className="w-3 h-3" /> {stay.status === "termine" ? "Terminé" : "Annulé"}</Badge>}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Pièce: {stay.client.documentNumber || "-"} • Tél: {stay.client.phone} • {stay.client.nationality || "Nationalité non renseignée"}
                                  {stay.client.gender ? " • " + (clientGenderLabels[stay.client.gender] ?? stay.client.gender) : ""}
                                </div>
                                <div className="text-sm">
                                  Chambre <span className={unpaid ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>{stay.chambre.numero}</span> ({stay.chambre.type}) • {offerLabels[stay.offer] ?? stay.offer}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {isPlanifie ? "Dates prévues" : "Dates d'entrée"}: {format(new Date(stay.startedAt), "dd/MM/yyyy HH:mm")} au {format(new Date(stay.currentEndAt), "dd/MM/yyyy HH:mm")}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Total séjour: {stayDurationLabel}{isActive ? ` • Libération: ${releaseCountdownLabel}` : ""}
                                </div>
                              
                                <div className="text-sm">Total net: {formatCurrency(totalNet)}  Payé: {formatCurrency(totalPaid)}  Reste: <span className={unpaid ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>{formatCurrency(totalBalance)}</span></div>
                                <div className="text-xs text-muted-foreground">Code séjour: {stay.code}</div>
                                {stay.reservation?.reference && <div className="text-xs text-muted-foreground">Réf. web: {stay.reservation.reference}</div>}
                                {stay.extensions.length > 0 && (
                                  <div className="text-xs text-muted-foreground">Extensions: {stay.extensions.length}</div>
                                )}
                                {appliedDiscountAmount > 0 && (
                                  <div className="text-xs text-emerald-700">Remise appliquée: - {formatCurrency(appliedDiscountAmount)}</div>
                                )}
                                {villaDeposit && (
                                  <div className="text-xs text-muted-foreground">
                                    Caution villa: {formatCurrency(villaDeposit.heldAmount)} / {formatCurrency(villaDeposit.expectedAmount)} • {depositStatusLabels[villaDeposit.status] ?? villaDeposit.status}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-start justify-end gap-2">
                                {isPlanifie && (
                                  <PlannedArrivalDialog
                                    stay={stay}
                                    onCompleted={loadStays}
                                    open={plannedArrivalStayId === stay.id}
                                    onOpenChange={(open) => setPlannedArrivalStayId(open ? stay.id : null)}
                                  />
                                )}

                                {isPlanifie && (
                                  <StayReportDialog
                                    stay={stay}
                                    onCompleted={loadStays}
                                    open={reportStayId === stay.id}
                                    onOpenChange={(open) => setReportStayId(open ? stay.id : null)}
                                    hideTrigger
                                  />
                                )}

                                {!isClosed && !isSolde && (
                                  <Dialog open={paymentDialog.open && paymentDialog.stayId === stay.id} onOpenChange={(open) => {
                                    if (open) {
                                      setPaymentDialog({ open: true, stayId: stay.id, extensionId: "" });
                                      setPaymentForm(defaultPaymentForm);
                                    } else {
                                      setPaymentDialog({ open: false, stayId: "", extensionId: "" });
                                    }
                                  }}>
                                    <Button size="sm" variant="outline" onClick={() => {
                                      setPaymentDialog({ open: true, stayId: stay.id, extensionId: "" });
                                      setPaymentForm(defaultPaymentForm);
                                    }}>
                                      <Receipt className="mr-1 h-4 w-4" /> {isPlanifie ? "Acompte" : "Encaisser"}
                                    </Button>
                                    <DialogContent>
                                      <DialogHeader><DialogTitle>{isPlanifie ? "Encaisser un acompte" : "Encaisser un paiement"}</DialogTitle></DialogHeader>
                                      <div className="space-y-1 text-sm text-muted-foreground mb-2">
                                        <div>Solde total: <span className="font-semibold text-red-600">{formatCurrency(totalBalance)}</span></div>
                                        <div>Solde ciblé: <span className="font-semibold text-primary">{formatCurrency(selectedPaymentBalance)}</span></div>
                                        {isPlanifie && (
                                          <div></div>
                                        )}
                                        {baseBalance > 0 && stay.extensions.length > 0 && (
                                          <div className="text-xs text-amber-700">La prolongation sera encaissable après le solde du séjour de base.</div>
                                        )}
                                      </div>
                                      <form onSubmit={submitPayment} className="space-y-3">
                                        <div>
                                          <Label>Montant (FCFA)</Label>
                                          <Input type="number" min="1" max={selectedPaymentBalance} value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) || 0 })} />
                                          {paymentForm.amount > selectedPaymentBalance && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Le montant dépasse le solde ciblé</p>}
                                        </div>
                                        <div>
                                          <Label>Type</Label>
                                          <Select value={isPlanifie ? "acompte" : paymentForm.type} disabled={isPlanifie} onValueChange={(value) => {
                                            const newForm = { ...paymentForm, type: value };
                                            if (value === "solde") newForm.amount = selectedPaymentBalance;
                                            setPaymentForm(newForm);
                                          }}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="acompte">Acompte</SelectItem>
                                              {!isPlanifie && <SelectItem value="solde">Solde ({formatCurrency(selectedPaymentBalance)})</SelectItem>}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <Label>Mode</Label>
                                          <Select value={paymentForm.method} onValueChange={(value) => setPaymentForm({
                                            ...paymentForm,
                                            method: value,
                                            paymentOperator: value === "especes" ? "" : paymentForm.paymentOperator,
                                            payerPhone: value === "especes" ? "" : paymentForm.payerPhone,
                                            paymentReference: value === "especes" ? "" : paymentForm.paymentReference,
                                          })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="especes">Espèces</SelectItem>
                                              <SelectItem value="mobile_money">Mobile money</SelectItem>
                                              <SelectItem value="carte">Carte</SelectItem>
                                              <SelectItem value="virement">Virement</SelectItem>
                                              <SelectItem value="autre">Autre</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <Label>Heure du paiement</Label>
                                          <Input type="datetime-local" value={paymentForm.paidAt} onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })} />
                                        </div>
                                        {paymentRequiresTrace && (
                                          <div className="grid gap-3 md:grid-cols-3">
                                            <div>
                                              <Label>Opérateur</Label>
                                              <Input value={paymentForm.paymentOperator} onChange={(e) => setPaymentForm({ ...paymentForm, paymentOperator: e.target.value })} placeholder="Wave, Orange..." />
                                            </div>
                                            <div>
                                              <Label>Numéro payeur</Label>
                                              <Input value={paymentForm.payerPhone} onChange={(e) => setPaymentForm({ ...paymentForm, payerPhone: e.target.value })} placeholder="Numéro utilisé" />
                                            </div>
                                            <div>
                                              <Label>Référence</Label>
                                              <Input value={paymentForm.paymentReference} onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })} placeholder="Transaction" />
                                            </div>
                                          </div>
                                        )}
                                        {!isPlanifie && stay.extensions.length > 0 && (
                                          <div>
                                            <Label>Extension concernée (optionnel)</Label>
                                            <Select value={paymentDialog.extensionId || "stay"} onValueChange={(value) => {
                                              if (value !== "stay" && baseBalance > 0) {
                                                toast.error("Solde d'abord le séjour de base avant la prolongation.");
                                                return;
                                              }
                                              setPaymentDialog({ ...paymentDialog, extensionId: value === "stay" ? "" : value });
                                              setPaymentForm({ ...paymentForm, amount: 0 });
                                            }}>
                                              <SelectTrigger><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="stay">Séjour de base</SelectItem>
                                                {stay.extensions.map((extension) => (
                                                  <SelectItem key={extension.id} value={extension.id} disabled={baseBalance > 0}>
                                                    Extension du {format(new Date(extension.startedAt), "dd/MM")} au {format(new Date(extension.endedAt), "dd/MM")}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        )}
                                        <div><Label>Note</Label><Input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} /></div>
                                        <Button type="submit" className="w-full gradient-teal text-accent-foreground" disabled={!canPaySelectedTarget || paymentTraceMissing || paymentForm.amount <= 0 || paymentForm.amount > selectedPaymentBalance}>
                                          Enregistrer ({formatCurrency(paymentForm.amount)})
                                        </Button>
                                      </form>
                                    </DialogContent>
                                  </Dialog>
                                )}

                                {!isClosed && (
                                  <Dialog open={extensionDialog.open && extensionDialog.stayId === stay.id} onOpenChange={(open) => setExtensionDialog(open ? { open: true, stayId: stay.id } : { open: false, stayId: "" })}>
                                    <DialogContent>
                                      <DialogHeader><DialogTitle>Ajouter une extension</DialogTitle></DialogHeader>
                                      <form onSubmit={submitExtension} className="space-y-3 pt-2">
                                        <div>
                                          <Label>Offre</Label>
                                          <Select value={extensionForm.offer} onValueChange={(value) => setExtensionForm({ ...extensionForm, offer: value })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              {Object.entries(offerLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div><Label>Date de fin extension</Label><Input type="datetime-local" value={extensionForm.endAt} onChange={(e) => setExtensionForm({ ...extensionForm, endAt: e.target.value })} required /></div>
                                        {isAdmin ? (
                                          <div className="grid grid-cols-2 gap-3">
                                            <div>
                                              <Label>Réduction</Label>
                                              <Select value={extensionForm.discountType} onValueChange={(value) => setExtensionForm({ ...extensionForm, discountType: value })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="none">Aucune</SelectItem>
                                                  <SelectItem value="percent">Pourcentage</SelectItem>
                                                  <SelectItem value="fixed">Montant</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div><Label>Valeur</Label><Input type="number" min="0" value={extensionForm.discountValue} onChange={(e) => setExtensionForm({ ...extensionForm, discountValue: Number(e.target.value) || 0 })} /></div>
                                          </div>
                                        ) : (
                                          <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                                            La remise d'une prolongation doit être validée séparément par un administrateur.
                                          </div>
                                        )}
                                        {extensionForm.offer === "personnalise" && <div><Label>Montant</Label><Input type="number" min="0" value={extensionForm.customAmount} onChange={(e) => setExtensionForm({ ...extensionForm, customAmount: Number(e.target.value) || 0 })} /></div>}
                                        <div>
                                          <Label>Paiement initial extension</Label>
                                          <Input
                                            type="number"
                                            min="0"
                                            value={extensionForm.initialPayment}
                                            disabled={totalBalance > 0}
                                            onChange={(e) => setExtensionForm({ ...extensionForm, initialPayment: Number(e.target.value) || 0 })}
                                          />
                                        </div>
                                        {totalBalance > 0 && (
                                          <div className="rounded-xl border p-3 text-sm text-muted-foreground">
                                            Règle de caisse: règle d'abord le séjour de base avant d'encaisser la prolongation.
                                          </div>
                                        )}
                                        <div><Label>Note</Label><Input value={extensionForm.notes} onChange={(e) => setExtensionForm({ ...extensionForm, notes: e.target.value })} /></div>
                                        <Button type="submit" className="w-full gradient-teal text-accent-foreground">Ajouter l&apos;extension</Button>
                                      </form>
                                    </DialogContent>
                                  </Dialog>
                                )}

                                {isActive && isSolde && (
                                  <StayCheckoutDialog
                                    stay={stay}
                                    totalBalance={totalBalance}
                                    onCompleted={loadStays}
                                    open={checkoutStayId === stay.id}
                                    onOpenChange={(open) => setCheckoutStayId(open ? stay.id : null)}
                                  />
                                )}

                                {roomNeedsCleaning && (
                                  <Button size="sm" variant="outline" onClick={() => markRoomClean(stay.chambre.id)}>
                                    <Brush className="mr-1 h-4 w-4" /> Marquer propre
                                  </Button>
                                )}

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline">
                                      <MoreHorizontal className="mr-1 h-4 w-4" /> Actions
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    {isPlanifie && (
                                      <DropdownMenuItem onClick={() => setReportStayId(stay.id)}>
                                        Reporter Séjour
                                      </DropdownMenuItem>
                                    )}
                                    {isPlanifie && (
                                      <DropdownMenuItem onClick={() => sendReminder(stay)}>
                                        Rappeler le client
                                      </DropdownMenuItem>
                                    )}
                                    {isPlanifie && (
                                      <DropdownMenuItem onClick={() => markNoShow(stay)}>
                                        {isLateArrival ? "Confirmer l'absence client" : "Annuler la réservation"}
                                      </DropdownMenuItem>
                                    )}
                                    {!isPlanifie && !isClosed && (
                                      <DropdownMenuItem onClick={() => setExtensionDialog({ open: true, stayId: stay.id })}>
                                        Prolonger
                                      </DropdownMenuItem>
                                    )}
                                    {pendingDiscountRequest && isAdmin && (
                                      <DropdownMenuItem onClick={() => {
                                        setDiscountReviewDialog({ open: true, requestId: pendingDiscountRequest.id });
                                        setDiscountReviewForm({
                                          decision: "approuvee",
                                          approvedDiscountType: (pendingDiscountRequest.discountType === "none" ? "percent" : pendingDiscountRequest.discountType) as "percent" | "fixed",
                                          approvedDiscountValue: pendingDiscountRequest.discountValue,
                                          reviewNote: pendingDiscountRequest.reviewNote ?? "",
                                        });
                                      }}>
                                        Traiter la remise
                                      </DropdownMenuItem>
                                    )}
                                    {!isAdmin && !isClosed && !isSolde && !pendingDiscountRequest && (
                                      <DropdownMenuItem onClick={() => {
                                        setDiscountRequestDialog({ open: true, stayId: stay.id });
                                        setDiscountRequestForm(defaultDiscountRequestForm);
                                      }}>
                                        Demander une remise
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    {latestPayment && !isSolde && (
                                      <DropdownMenuItem onClick={() => window.open("/api/admin/stays/" + stay.id + "/invoice?paymentId=" + latestPayment.id, "_blank")}>
                                        Facture acompte
                                      </DropdownMenuItem>
                                    )}
                                    {isSolde && (
                                      <DropdownMenuItem onClick={() => window.open("/api/admin/stays/" + stay.id + "/invoice", "_blank")}>
                                        Facture finale
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => { window.location.href = "/admin/clients/" + stay.client.id; }}>
                                      Dossier client
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
