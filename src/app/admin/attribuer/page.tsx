"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, ClipboardList, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Attribution {
  id: string;
  reservationId: string;
  chambreId: string;
  checkIn: string | null;
  checkOut: string | null;
  reservation: { firstName: string; lastName: string; email: string } | null;
  chambre: { numero: string; type: string } | null;
}

export default function AttribuerPage() {
  const [items, setItems] = useState<Attribution[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [chambres, setChambres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ reservationId: "", chambreId: "" });

  const load = async () => {
    setLoading(true);
    const [attRes, availRes] = await Promise.all([
      fetch("/api/admin/attributions"),
      fetch("/api/admin/attributions/available"),
    ]);
    if (attRes.ok) {
      const data = await attRes.json();
      setItems(data.items ?? []);
    }
    if (availRes.ok) {
      const avail = await availRes.json();
      setReservations(avail.reservations ?? []);
      setChambres(avail.chambres ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reservationId || !form.chambreId) return toast.error("Sélection requise");
    const res = await fetch("/api/admin/attributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) return toast.error("Erreur");
    toast.success("Chambre attribuée");
    setOpen(false);
    setForm({ reservationId: "", chambreId: "" });
    load();
  };

  const remove = async (id: string, chambreId: string) => {
    if (!confirm("Supprimer cette attribution ?")) return;
    const res = await fetch(`/api/admin/attributions?id=${id}&chambreId=${chambreId}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Erreur");
    toast.success("Attribution supprimée");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Attributions</h1>
          <p className="text-sm text-muted-foreground">Affectez les chambres aux réservations acceptées</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-teal text-accent-foreground rounded-full">
              <Plus className="w-4 h-4 mr-1" /> Nouvelle attribution
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Attribuer une chambre</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3 pt-2">
              <div>
                <Label>Réservation acceptée</Label>
                <Select value={form.reservationId} onValueChange={(v) => setForm({ ...form, reservationId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {reservations.length === 0 && <div className="p-2 text-sm text-muted-foreground">Aucune réservation disponible</div>}
                    {reservations.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.firstName} {r.lastName} — {r.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chambre disponible</Label>
                <Select value={form.chambreId} onValueChange={(v) => setForm({ ...form, chambreId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {chambres.length === 0 && <div className="p-2 text-sm text-muted-foreground">Aucune chambre disponible</div>}
                    {chambres.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>N° {c.numero} — {c.type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full gradient-teal text-accent-foreground">Confirmer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
          Aucune attribution
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((a) => (
            <Card key={a.id} className="p-5 flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-primary">
                  {a.reservation?.firstName} {a.reservation?.lastName}
                </div>
                <div className="text-sm text-muted-foreground">
                  Chambre N° {a.chambre?.numero} ({a.chambre?.type}) · {a.reservation?.email}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => remove(a.id, a.chambreId)} className="text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
