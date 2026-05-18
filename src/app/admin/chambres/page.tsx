"use client";

import { useCallback, useEffect, useState } from "react";
import { BedDouble, Brush, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/hotel-display";

type Status = "disponible" | "occupee" | "attente_nettoyage" | "maintenance";
type Category = "standard" | "villa_1ch" | "villa_2ch";

interface Chambre {
  id: string;
  numero: string;
  type: string;
  categorie: Category;
  prix: number;
  capacite: number;
  description: string | null;
  status: Status;
  sejours: { id: string; code: string; paymentStatus: string }[];
}

const statusBadge: Record<Status, string> = {
  disponible: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  occupee: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  attente_nettoyage: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  maintenance: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const categoryLabel: Record<Category, string> = {
  standard: "Standard",
  villa_1ch: "Villa 1 chambre",
  villa_2ch: "Villa 2 chambres",
};

const empty = {
  numero: "",
  type: "Standard",
  categorie: "standard" as Category,
  prix: 0,
  capacite: 1,
  description: "",
  status: "disponible" as Status,
};

export default function ChambresPage() {
  const [items, setItems] = useState<Chambre[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Chambre | null>(null);
  const [form, setForm] = useState(empty);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/chambres?page=" + page + "&limit=20");
    if (!res.ok) {
      toast.error("Erreur de chargement");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.items ?? []);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = { ...form, prix: Number(form.prix), capacite: Number(form.capacite) };
    const res = editing
      ? await fetch("/api/admin/chambres", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...payload }) })
      : await fetch("/api/admin/chambres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

    const response = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(response.error || "Erreur");
      return;
    }

    toast.success(editing ? "Chambre modifiée" : "Chambre ajoutée");
    setOpen(false);
    setEditing(null);
    setForm(empty);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette chambre ?")) return;
    const res = await fetch("/api/admin/chambres?id=" + id, { method: "DELETE" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Erreur");
      return;
    }
    toast.success("Chambre supprimée");
    load();
  };

  const markClean = async (id: string) => {
    const res = await fetch("/api/admin/chambres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "disponible" }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || "Impossible de remettre la chambre en disponible");
      return;
    }
    toast.success("Chambre marquée propre");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Chambres</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setForm(empty); }} className="gradient-teal text-accent-foreground rounded-full">
              <Plus className="mr-1 h-4 w-4" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifier la chambre" : "Nouvelle chambre"}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Numéro</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} required /></div>
                <div><Label>Type</Label><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></div>
                <div>
                  <Label>Catégorie</Label>
                  <Select value={form.categorie} onValueChange={(value) => setForm({ ...form, categorie: value as Category })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="villa_1ch">Villa 1 chambre</SelectItem>
                      <SelectItem value="villa_2ch">Villa 2 chambres</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Prix / nuit</Label><Input type="number" min="0" value={form.prix} onChange={(e) => setForm({ ...form, prix: Number(e.target.value) || 0 })} /></div>
                <div><Label>Capacité</Label><Input type="number" min="1" value={form.capacite} onChange={(e) => setForm({ ...form, capacite: Number(e.target.value) || 1 })} /></div>
                <div>
                  <Label>Statut</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disponible">Disponible</SelectItem>
                      <SelectItem value="occupee">Occupée</SelectItem>
                      <SelectItem value="attente_nettoyage">Attente nettoyage</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button type="submit" className="w-full gradient-teal text-accent-foreground">Enregistrer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground"><BedDouble className="w-10 h-10 mx-auto mb-3 opacity-40" />Aucune chambre.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-primary">N° {item.numero}</h3>
                    <Badge className={statusBadge[item.status]}>{item.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{categoryLabel[item.categorie]} • {item.capacite} pers.</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-accent">{formatCurrency(item.prix)}</div>
                  <div className="text-xs text-muted-foreground">/ nuit</div>
                </div>
              </div>
              {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
              {item.sejours[0] && <p className="text-xs text-muted-foreground">Séjour actif: {item.sejours[0].code} • {item.sejours[0].paymentStatus}</p>}
              <div className="flex gap-2 pt-2 border-t">
                {item.status === "attente_nettoyage" && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => markClean(item.id)}>
                    <Brush className="mr-1 h-3.5 w-3.5" /> Marquer propre
                  </Button>
                )}
                <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                  setEditing(item);
                  setForm({
                    numero: item.numero,
                    type: item.type,
                    categorie: item.categorie,
                    prix: item.prix,
                    capacite: item.capacite,
                    description: item.description ?? "",
                    status: item.status,
                  });
                  setOpen(true);
                }}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Modifier
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => remove(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
