"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Plus, Printer, Receipt, Search, UserSquare2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, offerLabels, paymentStatusMeta, sourceLabels } from "@/lib/hotel-display";
import { toNumber } from "@/lib/stay-utils";
import { toast } from "sonner";

interface ClientLookupItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  documentNumber: string | null;
  documentType: string | null;
  birthDate: string | null;
  age: number | null;
  visitCount: number;
}

interface RoomItem {
  id: string;
  numero: string;
  type: string;
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
  paymentStatus: string;
  payments: PaymentItem[];
}

interface StayItem {
  id: string;
  source: string;
  status: string;
  offer: string;
  startedAt: string;
  currentEndAt: string;
  netAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  visitCount: number;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    documentNumber: string | null;
  };
  chambre: {
    numero: string;
    type: string;
  };
  reservation: {
    reference: string;
    status: string;
  } | null;
  payments: PaymentItem[];
  extensions: ExtensionItem[];
}

const defaultForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  documentNumber: "",
  documentType: "cni",
  birthDate: "",
  age: "",
  chambreId: "",
  offer: "nuitee",
  startAt: "",
  endAt: "",
  customAmount: 0,
  discountType: "none",
  discountValue: 0,
  paymentArrangement: "fin_sejour",
  initialPayment: 0,
  notes: "",
  behaviorBefore: "",
};

const defaultPaymentForm = { amount: 0, method: "especes", type: "partiel", notes: "" };
const defaultExtensionForm = { offer: "nuitee", endAt: "", customAmount: 0, discountType: "none", discountValue: 0, initialPayment: 0, notes: "" };
const defaultFilters = { status: "all", source: "all", paymentStatus: "all", dateFrom: "", dateTo: "" };

export default function RegistrePage() {
  const [loading, setLoading] = useState(true);
  const [stays, setStays] = useState<StayItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClientLookupItem[]>([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [form, setForm] = useState(defaultForm);
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; stayId: string; extensionId: string }>({ open: false, stayId: "", extensionId: "" });
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm);
  const [extensionDialog, setExtensionDialog] = useState<{ open: boolean; stayId: string }>({ open: false, stayId: "" });
  const [extensionForm, setExtensionForm] = useState(defaultExtensionForm);

  const loadStays = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.source !== "all") params.set("source", filters.source);
    if (filters.paymentStatus !== "all") params.set("paymentStatus", filters.paymentStatus);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);

    const res = await fetch("/api/admin/stays?" + params.toString());
    if (!res.ok) {
      toast.error("Chargement du registre impossible");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setStays(data.items ?? []);
    setLoading(false);
  }, [filters.dateFrom, filters.dateTo, filters.paymentStatus, filters.source, filters.status]);

  const refreshRooms = useCallback(async (nextForm = defaultForm) => {
    const params = new URLSearchParams({
      offer: nextForm.offer,
      startAt: nextForm.startAt,
      endAt: nextForm.endAt,
    });
    const res = await fetch("/api/admin/attributions/available?" + params.toString());
    if (!res.ok) return;
    const data = await res.json();
    setRooms(data.chambres ?? []);
  }, []);

  useEffect(() => {
    void loadStays();
  }, [loadStays]);

  useEffect(() => {
    void refreshRooms(defaultForm);
  }, [refreshRooms]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.source !== "all") params.set("source", filters.source);
    if (filters.paymentStatus !== "all") params.set("paymentStatus", filters.paymentStatus);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    return "/api/admin/stays/export?" + params.toString();
  }, [filters.dateFrom, filters.dateTo, filters.paymentStatus, filters.source, filters.status]);

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
    setForm((current) => ({
      ...current,
      firstName: client.firstName ?? "",
      lastName: client.lastName ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      documentNumber: client.documentNumber ?? "",
      documentType: client.documentType ?? "cni",
      birthDate: client.birthDate ? client.birthDate.slice(0, 10) : "",
      age: client.age ? String(client.age) : "",
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await fetch("/api/admin/stays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        age: form.age ? Number(form.age) : null,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Création du séjour impossible");
      return;
    }
    toast.success("Séjour présentiel enregistré");
    setForm(defaultForm);
    setSearchResults([]);
    await Promise.all([loadStays(), refreshRooms(defaultForm)]);
  };

  const updateStayStatus = async (stayId: string, status: string) => {
    const behaviorAfter = status === "termine" ? window.prompt("Note de comportement / fin de séjour (optionnel)") : null;
    const res = await fetch("/api/admin/stays/" + stayId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, behaviorAfter }),
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
    const res = await fetch("/api/admin/stays/" + paymentDialog.stayId + "/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...paymentForm, extensionId: paymentDialog.extensionId || null }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Paiement impossible");
      return;
    }
    toast.success("Paiement enregistré");
    setPaymentDialog({ open: false, stayId: "", extensionId: "" });
    setPaymentForm(defaultPaymentForm);
    await loadStays();
  };

  const submitExtension = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await fetch("/api/admin/stays/" + extensionDialog.stayId + "/extensions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(extensionForm),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-primary">Registre présentiel</h1>
        <p className="text-sm text-muted-foreground">Clients en présence directe, séjours en cours, paiements, reçus et prolongations</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <Label>Statut séjour</Label>
            <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="planifie">Planifiés</SelectItem>
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
                <SelectItem value="presence">Présence directe</SelectItem>
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
                <SelectItem value="en_attente_paiement">En attente</SelectItem>
                <SelectItem value="avance_versee">Avance versée</SelectItem>
                <SelectItem value="solde_en_cours">Solde en cours</SelectItem>
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
          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setFilters(defaultFilters)}>Réinitialiser</Button>
            <Button asChild className="flex-1 gradient-teal text-accent-foreground">
              <a href={exportUrl}><Download className="mr-1 h-4 w-4" /> Export CSV</a>
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <Label>Recherche client existant</Label>
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="CNI, email, téléphone, nom..." />
          </div>
          <Button variant="outline" onClick={searchClients}><Search className="mr-1 h-4 w-4" /> Rechercher</Button>
        </div>
        {searchResults.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {searchResults.map((client) => (
              <div key={client.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{client.firstName} {client.lastName}</div>
                    <div className="text-sm text-muted-foreground">{client.documentNumber || client.email || client.phone}</div>
                    <div className="text-xs text-muted-foreground">{client.visitCount} dernier(s) séjour(s) chargé(s)</div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={"/admin/clients/" + client.id}><UserSquare2 className="mr-1 h-4 w-4" /> Dossier</Link>
                  </Button>
                </div>
                <div className="pt-3">
                  <Button type="button" size="sm" onClick={() => applyClientSelection(client)}>Pré-remplir la fiche</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div><Label>Prénom</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
            <div><Label>Nom</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Numéro de pièce</Label><Input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} required /></div>
            <div>
              <Label>Type de pièce</Label>
              <Select value={form.documentType} onValueChange={(value) => setForm({ ...form, documentType: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cni">CNI</SelectItem>
                  <SelectItem value="passport">Passeport</SelectItem>
                  <SelectItem value="titre_sejour">Titre de séjour</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date de naissance</Label><Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></div>
            <div><Label>Âge</Label><Input type="number" min="0" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label>Offre</Label>
              <Select value={form.offer} onValueChange={(value) => {
                const next = { ...form, offer: value, chambreId: "" };
                setForm(next);
                void refreshRooms(next);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(offerLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Début</Label><Input type="datetime-local" value={form.startAt} onChange={(e) => {
              const next = { ...form, startAt: e.target.value, chambreId: "" };
              setForm(next);
              void refreshRooms(next);
            }} required /></div>
            <div><Label>Fin</Label><Input type="datetime-local" value={form.endAt} onChange={(e) => {
              const next = { ...form, endAt: e.target.value, chambreId: "" };
              setForm(next);
              void refreshRooms(next);
            }} /></div>
            <div>
              <Label>Chambre disponible</Label>
              <Select value={form.chambreId} onValueChange={(value) => setForm({ ...form, chambreId: value })}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => <SelectItem key={room.id} value={room.id}>N° {room.numero} - {room.type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <div><Label>Valeur réduction</Label><Input type="number" min="0" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) || 0 })} /></div>
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
            <div><Label>Montant encaissé</Label><Input type="number" min="0" value={form.initialPayment} onChange={(e) => setForm({ ...form, initialPayment: Number(e.target.value) || 0 })} /></div>
          </div>

          {form.offer === "personnalise" && (
            <div><Label>Montant personnalisé</Label><Input type="number" min="0" value={form.customAmount} onChange={(e) => setForm({ ...form, customAmount: Number(e.target.value) || 0 })} /></div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Notes séjour</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div><Label>Note comportement avant séjour</Label><Input value={form.behaviorBefore} onChange={(e) => setForm({ ...form, behaviorBefore: e.target.value })} /></div>
          </div>

          <Button type="submit" className="gradient-teal text-accent-foreground"><Plus className="mr-1 h-4 w-4" /> Enregistrer au registre</Button>
        </form>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : stays.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Aucun séjour pour les filtres courants.</Card>
      ) : (
        <div className="grid gap-4">
          {stays.map((stay) => {
            const extensionNet = stay.extensions.reduce((sum, extension) => sum + toNumber(extension.netAmount), 0);
            const extensionPaid = stay.extensions.reduce((sum, extension) => sum + toNumber(extension.amountPaid), 0);
            const extensionBalance = stay.extensions.reduce((sum, extension) => sum + toNumber(extension.balanceDue), 0);
            const totalNet = toNumber(stay.netAmount) + extensionNet;
            const totalPaid = toNumber(stay.amountPaid) + extensionPaid;
            const totalBalance = toNumber(stay.balanceDue) + extensionBalance;
            const unpaid = totalBalance > 0;
            const latestPayment = [...stay.payments, ...stay.extensions.flatMap((extension) => extension.payments)]
              .sort((left, right) => new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime())[0] ?? null;
            const finalReceiptHref = "/admin/registre/" + stay.id + "/recu";
            const paymentReceiptHref = latestPayment ? "/admin/registre/" + stay.id + "/recu?paymentId=" + latestPayment.id : "";

            return (
              <Card key={stay.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-primary">{stay.client.firstName} {stay.client.lastName}</h3>
                      <Badge variant="outline">{sourceLabels[stay.source] ?? stay.source}</Badge>
                      <Badge className={paymentStatusMeta[stay.paymentStatus]?.className}>{paymentStatusMeta[stay.paymentStatus]?.label ?? stay.paymentStatus}</Badge>
                      <Badge variant="outline">{stay.visitCount} venue(s)</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">Pièce: {stay.client.documentNumber || "-"} • Tél: {stay.client.phone}</div>
                    <div className="text-sm">
                      Chambre <span className={unpaid ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>{stay.chambre.numero}</span> ({stay.chambre.type}) • {offerLabels[stay.offer] ?? stay.offer}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(stay.startedAt), "dd/MM/yyyy HH:mm")} au {format(new Date(stay.currentEndAt), "dd/MM/yyyy HH:mm")}
                    </div>
                    <div className="text-sm">Total net: {formatCurrency(totalNet)} • Payé: {formatCurrency(totalPaid)} • Reste: {formatCurrency(totalBalance)}</div>
                    {stay.reservation?.reference && (
                      <div className="text-xs text-muted-foreground">Réservation source: {stay.reservation.reference}</div>
                    )}
                    {stay.extensions.length > 0 && (
                      <div className="text-xs text-muted-foreground">Extensions: {stay.extensions.length}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={"/admin/clients/" + stay.client.id}><UserSquare2 className="mr-1 h-4 w-4" /> Dossier client</Link>
                    </Button>
                    {latestPayment ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={paymentReceiptHref} target="_blank"><Receipt className="mr-1 h-4 w-4" /> Reçu acompte</Link>
                      </Button>
                    ) : null}
                    {totalBalance <= 0 ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={finalReceiptHref} target="_blank"><Printer className="mr-1 h-4 w-4" /> Reçu final</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled><Printer className="mr-1 h-4 w-4" /> Reçu final</Button>
                    )}
                    {stay.status === "planifie" && (
                      <Button size="sm" onClick={() => updateStayStatus(stay.id, "en_cours")} className="gradient-teal text-accent-foreground">Valider l'arrivée</Button>
                    )}
                    <Dialog open={paymentDialog.open && paymentDialog.stayId === stay.id} onOpenChange={(open) => setPaymentDialog(open ? { open: true, stayId: stay.id, extensionId: "" } : { open: false, stayId: "", extensionId: "" })}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline"><Receipt className="mr-1 h-4 w-4" /> Encaisser</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Encaisser un paiement</DialogTitle></DialogHeader>
                        <form onSubmit={submitPayment} className="space-y-3 pt-2">
                          <div><Label>Montant</Label><Input type="number" min="0" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) || 0 })} /></div>
                          <div>
                            <Label>Type</Label>
                            <Select value={paymentForm.type} onValueChange={(value) => setPaymentForm({ ...paymentForm, type: value })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="acompte">Acompte</SelectItem>
                                <SelectItem value="partiel">Partiel</SelectItem>
                                <SelectItem value="solde">Solde</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Méthode</Label>
                            <Select value={paymentForm.method} onValueChange={(value) => setPaymentForm({ ...paymentForm, method: value })}>
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
                          {stay.extensions.length > 0 && (
                            <div>
                              <Label>Extension concernée (optionnel)</Label>
                              <Select value={paymentDialog.extensionId || "stay"} onValueChange={(value) => setPaymentDialog({ ...paymentDialog, extensionId: value === "stay" ? "" : value })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="stay">Séjour de base</SelectItem>
                                  {stay.extensions.map((extension) => (
                                    <SelectItem key={extension.id} value={extension.id}>
                                      Extension du {format(new Date(extension.startedAt), "dd/MM")} au {format(new Date(extension.endedAt), "dd/MM")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div><Label>Note</Label><Input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} /></div>
                          <Button type="submit" className="w-full gradient-teal text-accent-foreground">Enregistrer</Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={extensionDialog.open && extensionDialog.stayId === stay.id} onOpenChange={(open) => setExtensionDialog(open ? { open: true, stayId: stay.id } : { open: false, stayId: "" })}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">Prolonger</Button>
                      </DialogTrigger>
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
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Réduction</Label>
                              <Select value={extensionForm.discountType} onValueChange={(value) => setExtensionForm({ ...extensionForm, discountType: value })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Aucune</SelectItem>
                                  <SelectItem value="percent">Pourcentage</SelectItem>
                                  <SelectItem value="fixed">Montant fixe</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div><Label>Valeur</Label><Input type="number" min="0" value={extensionForm.discountValue} onChange={(e) => setExtensionForm({ ...extensionForm, discountValue: Number(e.target.value) || 0 })} /></div>
                          </div>
                          {extensionForm.offer === "personnalise" && <div><Label>Montant personnalisé</Label><Input type="number" min="0" value={extensionForm.customAmount} onChange={(e) => setExtensionForm({ ...extensionForm, customAmount: Number(e.target.value) || 0 })} /></div>}
                          <div><Label>Paiement initial extension</Label><Input type="number" min="0" value={extensionForm.initialPayment} onChange={(e) => setExtensionForm({ ...extensionForm, initialPayment: Number(e.target.value) || 0 })} /></div>
                          <div><Label>Note</Label><Input value={extensionForm.notes} onChange={(e) => setExtensionForm({ ...extensionForm, notes: e.target.value })} /></div>
                          <Button type="submit" className="w-full gradient-teal text-accent-foreground">Ajouter l'extension</Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    {stay.status !== "termine" && (
                      <Button size="sm" variant="outline" onClick={() => updateStayStatus(stay.id, "termine")}>Clôturer</Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
