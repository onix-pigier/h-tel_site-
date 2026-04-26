"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check, X, Loader2, Mail, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Status = "en_attente" | "acceptee" | "refusee";

interface Reservation {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateArrivee: string | null;
  dateDepart: string | null;
  notes: string | null;
  status: Status;
  createdAt: string;
}

const statusVariant: Record<Status, { label: string; className: string }> = {
  en_attente: { label: "En attente", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  acceptee: { label: "Acceptée", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  refusee: { label: "Refusée", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export default function ClientsPage() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (filter !== "all") params.set("status", filter);
    const res = await fetch(`/api/admin/reservations?${params}`);
    if (!res.ok) {
      toast.error("Erreur de chargement");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.items ?? []);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [page, filter]);

  const updateStatus = async (id: string, status: Status) => {
    const res = await fetch("/api/admin/reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) return toast.error("Erreur de mise à jour");
    toast.success(`Réservation ${status === "acceptee" ? "acceptée" : "refusée"}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Réservations</h1>
          <p className="text-sm text-muted-foreground">Gérez les demandes de réservation</p>
        </div>
        <div className="flex gap-2">
          {(["all", "en_attente", "acceptee", "refusee"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => { setFilter(s); setPage(1); }}
              className="rounded-full"
            >
              {s === "all" ? "Toutes" : statusVariant[s as Status].label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Aucune réservation</Card>
      ) : (
        <div className="grid gap-3">
          {items.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-primary">{r.firstName} {r.lastName}</h3>
                    <Badge className={statusVariant[r.status].className}>{statusVariant[r.status].label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{r.email}</span>
                    <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{r.phone}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reçue le {format(new Date(r.createdAt), "dd/MM/yyyy à HH:mm")}
                  </p>
                  {r.notes && <p className="text-sm pt-1">{r.notes}</p>}
                </div>
                {r.status === "en_attente" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateStatus(r.id, "acceptee")} className="gradient-teal text-accent-foreground">
                      <Check className="w-4 h-4 mr-1" /> Accepter
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "refusee")}>
                      <X className="w-4 h-4 mr-1" /> Refuser
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
