"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatVisitCount, offerLabels, paymentMethodLabels, paymentStatusLabels, stayStatusLabels } from "@/lib/hotel-display";
import { DiscountCode, OfferCode, PaymentArrangementCode } from "@/lib/pricing";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface ReservationChoice {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateArrivee: string | null;
  dateDepart: string | null;
  offer: OfferCode | null;
  visitCount: number;
  requestedAdvanceAmount: number;
  requestedAdvanceNote: string | null;
}

interface RoomChoice {
  id: string;
  numero: string;
  type: string;
  categorie: string;
  prix: number;
}

interface StayItem {
  id: string;
  code: string;
  status: string;
  paymentStatus: string;
  client: { firstName: string; lastName: string };
  chambre: { numero: string; type: string };
  reservation: { reference: string } | null;
}

type AttributionForm = {
  reservationId: string;
  chambreId: string;
  offer: OfferCode;
  startAt: string;
  endAt: string;
  discountType: DiscountCode;
  discountValue: number;
  paymentArrangement: PaymentArrangementCode;
  paymentMethod: "especes" | "mobile_money" | "carte" | "virement" | "autre";
  initialPayment: number;
  paymentOperator: string;
  payerPhone: string;
  paymentReference: string;
  paymentPaidAt: string;
  notes: string;
  customAmount: number;
};

interface WebAttributionsPanelProps {
  refreshToken?: number;
  onMutation?: () => void | Promise<void>;
}

const defaultForm: AttributionForm = {
  reservationId: "",
  chambreId: "",
  offer: "nuitee",
  startAt: "",
  endAt: "",
  discountType: "none",
  discountValue: 0,
  paymentArrangement: "fin_sejour",
  paymentMethod: "especes",
  initialPayment: 0,
  paymentOperator: "",
  payerPhone: "",
  paymentReference: "",
  paymentPaidAt: "",
  notes: "",
  customAmount: 0,
};

function toDateTimeLocalValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function WebAttributionsPanel({ refreshToken = 0, onMutation }: WebAttributionsPanelProps) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<StayItem[]>([]);
  const [reservations, setReservations] = useState<ReservationChoice[]>([]);
  const [rooms, setRooms] = useState<RoomChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AttributionForm>(defaultForm);

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => reservation.id === form.reservationId),
    [reservations, form.reservationId],
  );
  const requestedAdvanceAmount = selectedReservation?.requestedAdvanceAmount ?? 0;
  const requiresPaymentTrace = form.initialPayment > 0 && form.paymentMethod !== "especes";
  const showPaymentTrace = form.paymentMethod !== "especes";

  const load = useCallback(async (query?: { offer?: OfferCode; startAt?: string; endAt?: string }) => {
    setLoading(true);
    const [stayRes, availableRes] = await Promise.all([
      fetch("/api/admin/attributions"),
      fetch(
        "/api/admin/attributions/available?" +
          new URLSearchParams({
            offer: query?.offer ?? form.offer,
            startAt: query?.startAt ?? form.startAt,
            endAt: query?.endAt ?? form.endAt,
          }).toString(),
      ),
    ]);

    if (stayRes.ok) {
      const stayData = await stayRes.json();
      setItems(stayData.items ?? []);
    }
    if (availableRes.ok) {
      const availableData = await availableRes.json();
      setReservations(availableData.reservations ?? []);
      setRooms(availableData.chambres ?? []);
    }
    setLoading(false);
  }, [form.endAt, form.offer, form.startAt]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ reservationId?: string }>).detail;
      if (!detail?.reservationId) return;
      setOpen(true);
      setForm((current) => ({ ...current, reservationId: detail.reservationId! }));
    };

    window.addEventListener("open-web-attribution", handleOpen as EventListener);
    return () => window.removeEventListener("open-web-attribution", handleOpen as EventListener);
  }, []);

  useEffect(() => {
    if (!selectedReservation) return;
    setForm((current) => ({
      ...current,
      offer: selectedReservation.offer ?? current.offer,
      startAt: selectedReservation.dateArrivee ? selectedReservation.dateArrivee.slice(0, 10) : current.startAt,
      endAt: selectedReservation.dateDepart ? selectedReservation.dateDepart.slice(0, 10) : current.endAt,
      initialPayment: selectedReservation.requestedAdvanceAmount ?? 0,
      paymentPaidAt: current.paymentPaidAt || toDateTimeLocalValue(new Date()),
      notes: current.notes || `Réservation ${selectedReservation.reference}`,
    }));
  }, [selectedReservation]);

  const refreshAvailability = async (nextForm = form) => {
    const res = await fetch(
      "/api/admin/attributions/available?" +
        new URLSearchParams({
          offer: nextForm.offer,
          startAt: nextForm.startAt,
          endAt: nextForm.endAt,
        }).toString(),
    );
    if (!res.ok) return;
    const data = await res.json();
    setReservations(data.reservations ?? []);
    setRooms(data.chambres ?? []);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.reservationId || !form.chambreId || !form.startAt) {
      toast.error("Réservation, chambre et date de début requises.");
      return;
    }
    if (requestedAdvanceAmount > 0 && form.initialPayment < requestedAdvanceAmount) {
      toast.error("Acompte encaissé inférieur à l'avance demandée.");
      return;
    }
    if (requiresPaymentTrace && (!form.paymentOperator.trim() || !form.payerPhone.trim() || !form.paymentReference.trim() || !form.paymentPaidAt)) {
      toast.error("Opérateur, numéro, référence et heure du paiement requis.");
      return;
    }

    const payloadBody = isAdmin ? form : { ...form, discountType: "none", discountValue: 0 };
    const res = await fetch("/api/admin/attributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBody),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Erreur d'attribution");
      return;
    }

    toast.success("Séjour planifié créé");
    setOpen(false);
    setForm(defaultForm);
    await load();
    await onMutation?.();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette attribution web ?")) return;
    const res = await fetch("/api/admin/attributions?id=" + id, { method: "DELETE" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Erreur");
      return;
    }
    toast.success("Attribution supprimée");
    await load();
    await onMutation?.();
  };

  return (
    <section id="attributions-web" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary">Attributions web</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-teal rounded-full text-accent-foreground">
              <Plus className="mr-1 h-4 w-4" /> Nouvelle attribution
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Attribuer une chambre</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4 pt-2">
              <div>
                <Label>Réservation confirmée</Label>
                <Select value={form.reservationId} onValueChange={(value) => setForm({ ...form, reservationId: value })}>
                  <SelectTrigger><SelectValue placeholder="Choisir une réservation" /></SelectTrigger>
                  <SelectContent>
                    {reservations.map((reservation) => (
                      <SelectItem key={reservation.id} value={reservation.id}>
                        {reservation.reference || reservation.id.slice(0, 8)} - {reservation.firstName || ""} {reservation.lastName || ""} ({formatVisitCount(reservation.visitCount || 0)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedReservation && (
                <div className="rounded-2xl border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Acompte demandé</span>
                    <strong>{formatCurrency(requestedAdvanceAmount)}</strong>
                  </div>
                  {selectedReservation.requestedAdvanceNote && (
                    <div className="mt-1 text-muted-foreground">{selectedReservation.requestedAdvanceNote}</div>
                  )}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Offre</Label>
                  <Select value={form.offer} onValueChange={(value) => {
                    const next = { ...form, offer: value as OfferCode, chambreId: "" };
                    setForm(next);
                    void refreshAvailability(next);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(offerLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Chambre disponible</Label>
                  <Select value={form.chambreId} onValueChange={(value) => setForm({ ...form, chambreId: value })}>
                    <SelectTrigger><SelectValue placeholder="Choisir une chambre" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>N° {room.numero} - {room.type} • {formatCurrency(room.prix)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Début</Label>
                  <Input type="date" value={form.startAt} onChange={(event) => {
                    const next = { ...form, startAt: event.target.value, chambreId: "" };
                    setForm(next);
                    void refreshAvailability(next);
                  }} required />
                </div>
                <div>
                  <Label>Fin</Label>
                  <Input type="date" value={form.endAt} onChange={(event) => {
                    const next = { ...form, endAt: event.target.value, chambreId: "" };
                    setForm(next);
                    void refreshAvailability(next);
                  }} />
                </div>
              </div>

              {isAdmin ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Réduction</Label>
                    <Select value={form.discountType} onValueChange={(value) => setForm({ ...form, discountType: value as DiscountCode })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        <SelectItem value="percent">Pourcentage</SelectItem>
                        <SelectItem value="fixed">Montant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Remise</Label>
                    <Input type="number"  value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: Number(event.target.value) || 0 })} />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                  La remise se traite ensuite depuis le registre.
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Modalité</Label>
                  <Select value={form.paymentArrangement} onValueChange={(value) => setForm({ ...form, paymentArrangement: value as PaymentArrangementCode })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fin_sejour">fin de séjour</SelectItem>
                      <SelectItem value="avance_partielle">Acompte</SelectItem>
                      <SelectItem value="immediat">immédiat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Acompte reçu</Label>
                  <Input type="number" min={requestedAdvanceAmount} value={form.initialPayment} onChange={(event) => setForm({ ...form, initialPayment: Number(event.target.value) || 0 })} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Mode de paiement</Label>
                  <Select value={form.paymentMethod} onValueChange={(value) => setForm({ ...form, paymentMethod: value as AttributionForm["paymentMethod"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(paymentMethodLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Heure paiement</Label>
                  <Input type="datetime-local" value={form.paymentPaidAt} onChange={(event) => setForm({ ...form, paymentPaidAt: event.target.value })} disabled={form.initialPayment <= 0} />
                </div>
              </div>

              {showPaymentTrace && (
                <div className="grid gap-3 rounded-2xl border p-3 md:grid-cols-3">
                  <div>
                    <Label>Opérateur</Label>
                    <Input value={form.paymentOperator} onChange={(event) => setForm({ ...form, paymentOperator: event.target.value })} placeholder="Wave, Orange Money..." />
                  </div>
                  <div>
                    <Label>Numéro payeur</Label>
                    <Input value={form.payerPhone} onChange={(event) => setForm({ ...form, payerPhone: event.target.value })} placeholder="Numéro utilisé" />
                  </div>
                  <div>
                    <Label>Référence</Label>
                    <Input value={form.paymentReference} onChange={(event) => setForm({ ...form, paymentReference: event.target.value })} placeholder="Transaction" />
                  </div>
                </div>
              )}

              {form.offer === "personnalise" && (
                <div>
                  <Label>Montant personnalisé</Label>
                  <Input type="number" min="0" value={form.customAmount} onChange={(event) => setForm({ ...form, customAmount: Number(event.target.value) || 0 })} />
                </div>
              )}

              <div>
                <Label>Note</Label>
                <Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </div>

              <Button type="submit" className="w-full gradient-teal text-accent-foreground">Créer la réservation</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center text-muted-foreground">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-40" />
          Aucun séjour web planifié.
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id} className="rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-semibold text-primary">{item.client.firstName} {item.client.lastName}</div>
                  <div className="text-sm text-muted-foreground">{item.reservation?.reference ?? item.code} • Chambre {item.chambre.numero} ({item.chambre.type})</div>
                  <div className="text-xs text-muted-foreground">{stayStatusLabels[item.status] ?? item.status} • {paymentStatusLabels[item.paymentStatus] ?? item.paymentStatus}</div>
                </div>
                {isAdmin ? (
                  <Button size="sm" variant="outline" onClick={() => remove(item.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled title="Suppression réservée à l'administrateur">
                    <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
