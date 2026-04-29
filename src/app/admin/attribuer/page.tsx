"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ReservationChoice {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateArrivee: string | null;
  dateDepart: string | null;
  offer: string | null;
  visitCount: number;
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

const offerLabels: Record<string, string> = {
  nuitee: "Nuitée",
  forfait: "Forfait",
  passage: "Passage 2h",
  villa_1ch: "Villa 1 chambre",
  villa_2ch: "Villa 2 chambres",
  longue_duree: "Longue durée",
  personnalise: "Personnalisé",
};

export default function AttribuerPage() {
  const [items, setItems] = useState<StayItem[]>([]);
  const [reservations, setReservations] = useState<ReservationChoice[]>([]);
  const [rooms, setRooms] = useState<RoomChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    reservationId: "",
    chambreId: "",
    offer: "nuitee",
    startAt: "",
    endAt: "",
    discountType: "none",
    discountValue: 0,
    paymentArrangement: "fin_sejour",
    initialPayment: 0,
    notes: "",
    customAmount: 0,
  });

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => reservation.id === form.reservationId),
    [reservations, form.reservationId]
  );

  const load = useCallback(async (query?: { offer?: string; startAt?: string; endAt?: string }) => {
    setLoading(true);
    const [stayRes, availableRes] = await Promise.all([
      fetch("/api/admin/attributions"),
      fetch(
        "/api/admin/attributions/available?" +
          new URLSearchParams({
            offer: query?.offer ?? form.offer,
            startAt: query?.startAt ?? form.startAt,
            endAt: query?.endAt ?? form.endAt,
          }).toString()
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
  }, [load]);

  useEffect(() => {
    if (!selectedReservation) return;
    setForm((current) => ({
      ...current,
      offer: selectedReservation.offer ?? current.offer,
      startAt: selectedReservation.dateArrivee ? selectedReservation.dateArrivee.slice(0, 10) : current.startAt,
      endAt: selectedReservation.dateDepart ? selectedReservation.dateDepart.slice(0, 10) : current.endAt,
      notes: current.notes || ("Réservation " + selectedReservation.reference),
    }));
  }, [selectedReservation]);

  const refreshAvailability = async (nextForm = form) => {
    const res = await fetch(
      "/api/admin/attributions/available?" +
        new URLSearchParams({
          offer: nextForm.offer,
          startAt: nextForm.startAt,
          endAt: nextForm.endAt,
        }).toString()
    );
    if (!res.ok) return;
    const data = await res.json();
    setReservations(data.reservations ?? []);
    setRooms(data.chambres ?? []);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.reservationId || !form.chambreId || !form.startAt) {
      toast.error("Réservation, chambre et date de début sont requises.");
      return;
    }

    const res = await fetch("/api/admin/attributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Erreur d'attribution");
      return;
    }

    toast.success("Séjour planifié créé");
    setOpen(false);
    setForm({
      reservationId: "",
      chambreId: "",
      offer: "nuitee",
      startAt: "",
      endAt: "",
      discountType: "none",
      discountValue: 0,
      paymentArrangement: "fin_sejour",
      initialPayment: 0,
      notes: "",
      customAmount: 0,
    });
    load();
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
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Attributions web</h1>
          <p className="text-sm text-muted-foreground">Conversion des réservations validées en séjours planifiés</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-teal text-accent-foreground rounded-full">
              <Plus className="mr-1 h-4 w-4" /> Nouvelle attribution
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Attribuer une chambre à une réservation validée</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4 pt-2">
              <div>
                <Label>Réservation validée</Label>
                <Select value={form.reservationId} onValueChange={(value) => setForm({ ...form, reservationId: value })}>
                  <SelectTrigger><SelectValue placeholder="Choisir une réservation" /></SelectTrigger>
                  <SelectContent>
                    {reservations
                      .filter((reservation: any) => 
                        reservation && 
                        reservation.id && 
                        ["validee", "acceptee"].includes(reservation.status ?? "validee")
                      )
                      .map((reservation) => (
                        <SelectItem key={reservation.id} value={reservation.id}>
                          {reservation.reference || reservation.id.slice(0, 8)} - {reservation.firstName || ""} {reservation.lastName || ""} ({reservation.visitCount || 0} venue(s))
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Offre</Label>
                  <Select value={form.offer} onValueChange={(value) => {
                    const next = { ...form, offer: value, chambreId: "" };
                    setForm(next);
                    refreshAvailability(next);
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
                        <SelectItem key={room.id} value={room.id}>N° {room.numero} - {room.type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Début</Label>
                  <Input type="date" value={form.startAt} onChange={(e) => {
                    const next = { ...form, startAt: e.target.value, chambreId: "" };
                    setForm(next);
                    refreshAvailability(next);
                  }} required />
                </div>
                <div>
                  <Label>Fin</Label>
                  <Input type="date" value={form.endAt} onChange={(e) => {
                    const next = { ...form, endAt: e.target.value, chambreId: "" };
                    setForm(next);
                    refreshAvailability(next);
                  }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Réduction</Label>
                  <Select value={form.discountType} onValueChange={(value) => setForm({ ...form, discountType: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      <SelectItem value="percent">Pourcentage</SelectItem>
                      <SelectItem value="fixed">Montant fixe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valeur réduction</Label>
                  <Input type="number" min="0" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mode de paiement</Label>
                  <Select value={form.paymentArrangement} onValueChange={(value) => setForm({ ...form, paymentArrangement: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fin_sejour">Paiement fin de séjour</SelectItem>
                      <SelectItem value="avance_partielle">Avance partielle</SelectItem>
                      <SelectItem value="immediat">Paiement immédiat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Montant payé à l'attribution</Label>
                  <Input type="number" min="0" value={form.initialPayment} onChange={(e) => setForm({ ...form, initialPayment: Number(e.target.value) || 0 })} />
                </div>
              </div>

              {form.offer === "personnalise" && (
                <div>
                  <Label>Montant personnalisé</Label>
                  <Input type="number" min="0" value={form.customAmount} onChange={(e) => setForm({ ...form, customAmount: Number(e.target.value) || 0 })} />
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              <Button type="submit" className="w-full gradient-teal text-accent-foreground">Créer le séjour planifié</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
          Aucun séjour web planifié.
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id} className="p-5 flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-primary">{item.client.firstName} {item.client.lastName}</div>
                <div className="text-sm text-muted-foreground">
                  {item.reservation?.reference ?? item.code} • Chambre {item.chambre.numero} ({item.chambre.type})
                </div>
                <div className="text-xs text-muted-foreground">Statut séjour: {item.status} • Paiement: {item.paymentStatus}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => remove(item.id)} className="text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
