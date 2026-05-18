"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Loader2, Mail, Phone, Receipt, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clientGenderLabels, formatCurrency, formatVisitCount, offerLabels, reservationStatusLabels, workflowLabels } from "@/lib/hotel-display";
import { toast } from "sonner";

type Status = "en_attente" | "confirmee" | "convertie" | "refusee" | "annulee" | "reportee";

interface ReservationItem {
  id: string;
  reference: string;
  source: "web" | "presence";
  workflowKind: "web" | "direct" | "comptoir" | "appel";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string | null;
  gender: "homme" | "femme" | "autre" | null;
  guestCount: number | null;
  dateArrivee: string | null;
  dateDepart: string | null;
  offer: string | null;
  status: Status;
  notes: string | null;
  createdAt: string;
  visitCount: number;
  requestedAdvanceAmount: number | null;
  requestedAdvanceNote: string | null;
  sejour?: {
    id: string;
    code: string;
    status: string;
    netAmount: number;
    amountPaid: number;
    balanceDue: number;
    paymentStatus: string;
    chambre: { numero: string; type: string };
  } | null;
}

interface WebReservationsPanelProps {
  refreshToken?: number;
  onMutation?: () => void | Promise<void>;
}

type ConfirmDialogState = {
  open: boolean;
  reservationId: string;
  advanceAmount: number;
  advanceNote: string;
};

type PaymentDialogState = {
  open: boolean;
  reservationId: string;
  amount: number;
  method: "especes" | "mobile_money" | "carte" | "virement" | "autre";
  paidAt: string;
  paymentOperator: string;
  payerPhone: string;
  paymentReference: string;
  notes: string;
};

const statusMeta: Record<Status, { label: string; className: string }> = {
  en_attente: { label: reservationStatusLabels.en_attente, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  confirmee: { label: reservationStatusLabels.confirmee, className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  convertie: { label: reservationStatusLabels.convertie, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  refusee: { label: "Refusée", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  annulee: { label: "Annulée", className: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300" },
  reportee: { label: "Reportée", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
};

const fallbackStatusMeta = { label: "Inconnu", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900/30 dark:text-zinc-400" };
const statusFilters = ["all", "en_attente", "confirmee", "convertie", "reportee", "refusee", "annulee"] as const;
const channelFilters = ["all", "web", "comptoir", "appel"] as const;
const defaultConfirmDialog: ConfirmDialogState = { open: false, reservationId: "", advanceAmount: 0, advanceNote: "" };
const defaultPaymentDialog: PaymentDialogState = { open: false, reservationId: "", amount: 0, method: "especes", paidAt: "", paymentOperator: "", payerPhone: "", paymentReference: "", notes: "" };

function getStatusMeta(status: string | null | undefined) {
  if (!status) return fallbackStatusMeta;
  return statusMeta[status as Status] ?? fallbackStatusMeta;
}

function formatDateValue(value: string | null | undefined, pattern: string) {
  if (!value) return "-";

  try {
    return format(new Date(value), pattern);
  } catch {
    return "Date invalide";
  }
}

function toDateTimeLocalValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function WebReservationsPanel({ refreshToken = 0, onMutation }: WebReservationsPanelProps) {
  const [items, setItems] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [channelFilter, setChannelFilter] = useState<(typeof channelFilters)[number]>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(defaultConfirmDialog);
  const [paymentDialog, setPaymentDialog] = useState<PaymentDialogState>(defaultPaymentDialog);
  const selectedReservation = items.find((item) => item.id === confirmDialog.reservationId) ?? null;
  const selectedPaymentReservation = items.find((item) => item.id === paymentDialog.reservationId) ?? null;
  const paymentRequiresTrace = paymentDialog.amount > 0 && paymentDialog.method !== "especes";
  const showPaymentTrace = paymentDialog.method !== "especes";

  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (filter !== "all") params.set("status", filter);
      if (channelFilter !== "all") params.set("channel", channelFilter);
      const res = await fetch("/api/admin/reservations?" + params.toString(), { cache: "no-store" });
      if (!res.ok) {
        toast.error("Erreur de chargement des réservations");
        setItems([]);
        setTotalPages(1);
        return;
      }

      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 1);
    } catch {
      toast.error("Erreur de chargement des réservations");
      setItems([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter, channelFilter, refreshToken]);

  const changeStatus = async (
    id: string,
    status: Exclude<Status, "convertie">,
    extras?: { requestedAdvanceAmount?: number | null; requestedAdvanceNote?: string | null },
  ) => {
    const res = await fetch("/api/admin/reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, ...extras }),
      cache: "no-store",
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast.error(payload.error || "Erreur de mise à jour");
      return false;
    }

    toast.success(status === "confirmee" ? "Réservation confirmée" : "Statut mis à jour");
    await load();
    await onMutation?.();
    return true;
  };

  const openConfirmDialog = (item: ReservationItem) => {
    setConfirmDialog({
      open: true,
      reservationId: item.id,
      advanceAmount: item.requestedAdvanceAmount ?? 0,
      advanceNote: item.requestedAdvanceNote ?? "",
    });
  };

  const submitConfirmation = async () => {
    if (!selectedReservation) return;
    if (confirmDialog.advanceAmount < 0) {
      toast.error("L'acompte demandé ne peut pas être négatif.");
      return;
    }

    const ok = await changeStatus(selectedReservation.id, "confirmee", {
      requestedAdvanceAmount: confirmDialog.advanceAmount,
      requestedAdvanceNote: confirmDialog.advanceNote.trim() || null,
    });

    if (!ok) return;
    setConfirmDialog(defaultConfirmDialog);
  };

  const openAttribution = (reservationId: string) => {
    window.dispatchEvent(new CustomEvent("open-web-attribution", { detail: { reservationId } }));
    toast.success("Attribution ouverte");
  };

  const openPaymentDialog = (item: ReservationItem) => {
    setPaymentDialog({
      ...defaultPaymentDialog,
      open: true,
      reservationId: item.id,
      amount: Math.max(0, item.requestedAdvanceAmount ?? 0),
      paidAt: toDateTimeLocalValue(new Date()),
      notes: item.requestedAdvanceNote ?? "Acompte de réservation",
    });
  };

  const submitReservationPayment = async () => {
    const stay = selectedPaymentReservation?.sejour;
    if (!stay) return;
    if (paymentDialog.amount <= 0) {
      toast.error("Montant d'acompte requis.");
      return;
    }
    if (paymentDialog.amount > Number(stay.balanceDue ?? 0)) {
      toast.error("L'acompte dépasse le solde de la réservation.");
      return;
    }
    if (paymentRequiresTrace && (!paymentDialog.paymentOperator.trim() || !paymentDialog.payerPhone.trim() || !paymentDialog.paymentReference.trim())) {
      toast.error("Opérateur, numéro payeur et référence requis.");
      return;
    }

    const res = await fetch(`/api/admin/stays/${stay.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: paymentDialog.amount,
        method: paymentDialog.method,
        type: "acompte",
        paidAt: paymentDialog.paidAt,
        paymentOperator: paymentDialog.paymentOperator,
        payerPhone: paymentDialog.payerPhone,
        paymentReference: paymentDialog.paymentReference,
        notes: paymentDialog.notes,
      }),
      cache: "no-store",
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Acompte impossible");
      return;
    }

    toast.success("Acompte enregistré.");
    setPaymentDialog(defaultPaymentDialog);
    await load();
    await onMutation?.();
  };

  return (
    <section id="demandes-web" className="space-y-4">
      <div className="rounded-3xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-primary">Réservations</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {channelFilters.map((channel) => (
            <Button
              key={channel}
              size="sm"
              variant={channelFilter === channel ? "default" : "outline"}
              className="rounded-full"
              onClick={() => {
                setChannelFilter(channel);
                setPage(1);
              }}
            >
              {channel === "all" ? "Toutes" : workflowLabels[channel] ?? channel}
            </Button>
          ))}
          <div className="mx-1 hidden h-8 w-px bg-border xl:block" />
          {statusFilters.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={filter === status ? "default" : "outline"}
              className="rounded-full"
              onClick={() => {
                setFilter(status);
                setPage(1);
              }}
            >
              {status === "all" ? "Tous statuts" : getStatusMeta(status).label}
            </Button>
          ))}
        </div>
        </div>
      </div>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(open ? confirmDialog : defaultConfirmDialog)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmer la réservation</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div className="rounded-2xl border p-4 text-sm">
                <div className="font-semibold text-primary">{selectedReservation.firstName} {selectedReservation.lastName}</div>
                <div className="mt-1 text-muted-foreground">{formatDateValue(selectedReservation.dateArrivee, "dd/MM/yyyy")} au {formatDateValue(selectedReservation.dateDepart, "dd/MM/yyyy")}</div>
                <div className="text-muted-foreground">{selectedReservation.offer ? offerLabels[selectedReservation.offer] ?? selectedReservation.offer : "Offre non précisée"}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reservation-advance">Acompte demandé au client</Label>
                <div className="flex gap-2">
                  <Input
                    id="reservation-advance"
                    type="number"
                    min="0"
                    value={confirmDialog.advanceAmount}
                    onChange={(event) => setConfirmDialog((current) => ({ ...current, advanceAmount: Number(event.target.value) || 0 }))}
                  />
                  <Button type="button" variant="outline" onClick={() => setConfirmDialog((current) => ({ ...current, advanceAmount: 0 }))}>
                    Sans acompte
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Saisir 0 si aucun acompte n'est demandé avant l'arrivée.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reservation-advance-note">Note interne</Label>
                <Textarea
                  id="reservation-advance-note"
                  className="min-h-24"
                  value={confirmDialog.advanceNote}
                  onChange={(event) => setConfirmDialog((current) => ({ ...current, advanceNote: event.target.value }))}
                  placeholder="Ex: acompte Wave attendu, appel effectué, précision transmise au client."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDialog(defaultConfirmDialog)}>Annuler</Button>
            <Button type="button" className="gradient-sunset text-accent-foreground" onClick={submitConfirmation}>
              <Check className="mr-1 h-4 w-4" /> Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialog.open} onOpenChange={(open) => setPaymentDialog(open ? paymentDialog : defaultPaymentDialog)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Encaisser un acompte</DialogTitle>
          </DialogHeader>
          {selectedPaymentReservation?.sejour && (
            <div className="space-y-4">
              <div className="rounded-2xl border p-4 text-sm">
                <div className="font-semibold text-primary">{selectedPaymentReservation.firstName} {selectedPaymentReservation.lastName}</div>
                <div className="mt-1 text-muted-foreground">Séjour {selectedPaymentReservation.sejour.code} • Chambre {selectedPaymentReservation.sejour.chambre.numero}</div>
                <div className="text-muted-foreground">Reste: {formatCurrency(selectedPaymentReservation.sejour.balanceDue ?? 0)}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Montant</Label>
                  <Input type="number" min="1" max={selectedPaymentReservation.sejour.balanceDue} value={paymentDialog.amount} onChange={(event) => setPaymentDialog((current) => ({ ...current, amount: Number(event.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Mode</Label>
                  <Select value={paymentDialog.method} onValueChange={(value) => setPaymentDialog((current) => ({ ...current, method: value as PaymentDialogState["method"], paymentOperator: value === "especes" ? "" : current.paymentOperator, payerPhone: value === "especes" ? "" : current.payerPhone, paymentReference: value === "especes" ? "" : current.paymentReference }))}>
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
              </div>
              <div>
                <Label>Heure paiement</Label>
                <Input type="datetime-local" value={paymentDialog.paidAt} onChange={(event) => setPaymentDialog((current) => ({ ...current, paidAt: event.target.value }))} />
              </div>
              {showPaymentTrace && (
                <div className="grid gap-3 rounded-2xl border p-3 md:grid-cols-3">
                  <div>
                    <Label>Opérateur</Label>
                    <Input value={paymentDialog.paymentOperator} onChange={(event) => setPaymentDialog((current) => ({ ...current, paymentOperator: event.target.value }))} placeholder="Wave, Orange..." />
                  </div>
                  <div>
                    <Label>Numéro payeur</Label>
                    <Input value={paymentDialog.payerPhone} onChange={(event) => setPaymentDialog((current) => ({ ...current, payerPhone: event.target.value }))} placeholder="Numéro utilisé" />
                  </div>
                  <div>
                    <Label>Référence</Label>
                    <Input value={paymentDialog.paymentReference} onChange={(event) => setPaymentDialog((current) => ({ ...current, paymentReference: event.target.value }))} placeholder="Transaction" />
                  </div>
                </div>
              )}
              <div>
                <Label>Note</Label>
                <Textarea className="min-h-20" value={paymentDialog.notes} onChange={(event) => setPaymentDialog((current) => ({ ...current, notes: event.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPaymentDialog(defaultPaymentDialog)}>Annuler</Button>
            <Button type="button" className="gradient-teal text-accent-foreground" onClick={submitReservationPayment}>
              <Receipt className="mr-1 h-4 w-4" /> Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center text-muted-foreground">Aucune réservation pour ce filtre.</Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.filter((item): item is ReservationItem => Boolean(item?.id)).map((item) => {
            if (!item.status || !item.firstName || !item.lastName) return null;
            const meta = getStatusMeta(item.status);
            const canOpenAttribution = item.status === "confirmee" && !item.sejour;

            return (
              <Card
                key={item.id}
                className={`rounded-2xl border p-4 transition shadow-sm ${canOpenAttribution ? "cursor-pointer hover:border-primary/40" : ""}`}
                onDoubleClick={() => {
                  if (canOpenAttribution) openAttribution(item.id);
                }}
              >
                <div className="flex flex-col gap-4">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-primary">{item.firstName} {item.lastName}</h3>
                      <Badge className={meta.className}>{meta.label}</Badge>
                      <Badge variant="outline">{workflowLabels[item.workflowKind] ?? item.workflowKind}</Badge>
                      <Badge variant="outline">{item.reference}</Badge>
                      <Badge variant="outline">{formatVisitCount(item.visitCount)}</Badge>
                    </div>

                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div className="rounded-2xl border bg-background/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Contact</div>
                        <div className="mt-2 space-y-1 text-muted-foreground">
                          <div className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{item.email || "-"}</div>
                          <div className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{item.phone || "-"}</div>
                        </div>
                      </div>
                      <div className="rounded-2xl border bg-background/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Séjour demandé</div>
                        <div className="mt-2 font-medium">{item.offer ? offerLabels[item.offer] ?? item.offer : "Offre non précisée"}</div>
                        <div className="text-muted-foreground">{formatDateValue(item.dateArrivee, "dd/MM/yyyy")} au {formatDateValue(item.dateDepart, "dd/MM/yyyy")}</div>
                      </div>
                      <div className="rounded-2xl border bg-background/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Profil</div>
                        <div className="mt-2 text-muted-foreground">{item.nationality || "Nationalité non renseignée"}</div>
                        <div className="text-muted-foreground">{item.gender ? clientGenderLabels[item.gender] ?? item.gender : "Sexe non renseigné"} • {item.guestCount ?? "-"} pers.</div>
                      </div>
                      <div className="rounded-2xl border bg-background/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Acompte demandé</div>
                        <div className="mt-2 inline-flex items-center gap-2 font-medium text-primary"><Wallet className="h-4 w-4" />{formatCurrency(item.requestedAdvanceAmount ?? 0)}</div>
                        <div className="text-muted-foreground">{item.requestedAdvanceNote || (item.requestedAdvanceAmount ? "À encaisser avant attribution" : "Sans acompte demandé")}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span>Reçue le {formatDateValue(item.createdAt, "dd/MM/yyyy à HH:mm")}</span>
                      {item.sejour?.chambre && <span>Séjour {item.sejour.code} • Chambre {item.sejour.chambre.numero}</span>}
                    </div>
                    {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                    {item.status === "en_attente" && (
                      <>
                        <Button size="sm" className="gradient-sunset text-accent-foreground" onClick={() => openConfirmDialog(item)}>
                          <Check className="mr-1 h-4 w-4" /> Confirmer
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void changeStatus(item.id, "refusee")}>
                          <X className="mr-1 h-4 w-4" /> Refuser
                        </Button>
                      </>
                    )}
                    {canOpenAttribution && (
                      <Button size="sm" variant="outline" onClick={() => openAttribution(item.id)}>
                        Attribuer <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    )}
                    {item.status === "confirmee" && item.sejour && (
                      <>
                        {Number(item.sejour.balanceDue ?? 0) > 0 && (
                          <Button size="sm" variant="outline" onClick={() => openPaymentDialog(item)}>
                            <Receipt className="mr-1 h-4 w-4" /> Acompte
                          </Button>
                        )}
                        <Button size="sm" variant="outline" disabled>
                          Séjour créé
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </section>
  );
}
