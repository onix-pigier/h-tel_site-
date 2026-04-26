"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Loader2, BedDouble, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Status = "disponible" | "occupee" | "maintenance";

interface Chambre {
  id: string;
  numero: string;
  type: string;
  prix: number;
  capacite: number;
  description: string | null;
  status: Status;
}

const statusBadge: Record<Status, string> = {
  disponible: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  occupee: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  maintenance: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const empty = { numero: "", type: "Standard", prix: 0, capacite: 1, description: "", status: "disponible" as Status };

export default function ChambresPage() {
  const [items, setItems] = useState<Chambre[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Chambre | null>(null);
  const [form, setForm] = useState(empty);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/chambres?page=${page}&limit=20`);
    if (!res.ok) { toast.error("Erreur de chargement"); setLoading(false); return; }
    const data = await res.json();
    setItems(data.items ?? []);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Chambre) => {
    setEditing(c);
    setForm({ numero: c.numero, type: c.type, prix: c.prix, capacite: c.capacite, description: c.description ?? "", status: c.status });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numero.trim()) return toast.error("Numéro requis");
    const payload = { ...form, prix: Number(form.prix), capacite: Number(form.capacite) };

    const res = editing
      ? await fetch("/api/admin/chambres", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...payload }) })
      : await fetch("/api/admin/chambres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

    if (!res.ok) return toast.error("Erreur");
    toast.success(editing ? "Chambre modifiée" : "Chambre ajoutée");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette chambre ?")) return;
    const res = await fetch(`/api/admin/chambres?id=${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Erreur");
    toast.success("Chambre supprimée");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Chambres</h1>
          <p className="text-sm text-muted-foreground">Gérez le parc de chambres</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gradient-teal text-accent-foreground rounded-full">
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier la chambre" : "Nouvelle chambre"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Numéro</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} required /></div>
                <div><Label>Type</Label><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></div>
                <div><Label>Prix / nuit (FCFA)</Label><Input type="number" min="0" step="0.01" value={form.prix} onChange={(e) => setForm({ ...form, prix: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>Capacité</Label><Input type="number" min="1" value={form.capacite} onChange={(e) => setForm({ ...form, capacite: parseInt(e.target.value) || 1 })} /></div>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponible">Disponible</SelectItem>
                    <SelectItem value="occupee">Occupée</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button type="submit" className="w-full gradient-teal text-accent-foreground">
                {editing ? "Enregistrer" : "Créer"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <BedDouble className="w-10 h-10 mx-auto mb-3 opacity-40" />
          Aucune chambre. Ajoutez-en une pour commencer.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-lg text-primary">N° {c.numero}</h3>
                    <Badge className={statusBadge[c.status]}>{c.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.type} · {c.capacite} pers.</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-accent">{c.prix}FCFA</div>
                  <div className="text-xs text-muted-foreground">/ nuit</div>
                </div>
              </div>
              {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="flex-1">
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Modifier
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(c.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
