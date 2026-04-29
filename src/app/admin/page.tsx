"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Loader2, Mail, Phone, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Status = "en_attente" | "validee" | "convertie" | "refusee" | "annulee" | "acceptee";

interface ReservationItem {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateArrivee: string | null;
  dateDepart: string | null;
  offer: string | null;
  status: Status;
  notes: string | null;
  createdAt: string;
  visitCount: number;
  sejour?: {
    id: string;
    code: string;
    status: string;
    chambre: { numero: string; type: string };
  } | null;
}

const statusMeta: Record<Status, { label: string; className: string }> = {
  en_attente: { label: "En attente", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  validee: { label: "Validée", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  acceptee: { label: "Acceptée", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  convertie: { label: "Convertie", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  refusee: { label: "Refusée", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  annulee: { label: "Annulée", className: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300" },
};

const fallbackStatusMeta = { label: "Inconnu", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900/30 dark:text-zinc-400" };

const statusFilters = ["all", "en_attente", "validee", "acceptee", "convertie", "refusee", "annulee"] as const;

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

const offerLabels: Record<string, string> = {
  nuitee: "Nuitée",
  forfait: "Forfait",
  passage: "Passage 2h",
  villa_1ch: "Villa 1 chambre",
  villa_2ch: "Villa 2 chambres",
  longue_duree: "Longue durée",
  personnalise: "Personnalisé",
};

export default function ReservationsPage() {
  const [items, setItems] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filter !== "all") params.set("status", filter);
      const res = await fetch("/api/admin/reservations?" + params.toString(), { cache: "no-store" });
      if (!res.ok) {
        toast.error("Erreur de chargement");
        setItems([]);
        setTotalPages(1);
        return;
      }

      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 1);
    } catch {
      toast.error("Erreur de chargement");
      setItems([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter]);

  const changeStatus = async (id: string, status: Exclude<Status, "convertie">) => {
    const res = await fetch("/api/admin/reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
      cache: "no-store",
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast.error(payload.error || "Erreur de mise à jour");
      return;
    }

    toast.success("Statut mis à jour");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Réservations web</h1>
          <p className="text-sm text-muted-foreground">Validation des demandes issues de la landing page</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
              {status === "all" ? "Toutes" : getStatusMeta(status).label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items?.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Aucune réservation trouvée.</Card>
      ) : (
        <div className="grid gap-4">
          {items.filter((item): item is ReservationItem => Boolean(item?.id)).map((item) => {
            if (!item.status || !item.firstName || !item.lastName) return null;
            const meta = getStatusMeta(item.status);
            return (
              <Card key={item.id} className="p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-primary">{item.firstName} {item.lastName}</h3>
                      <Badge className={meta.className}>{meta.label}</Badge>
                      <Badge variant="outline">{item.reference}</Badge>
                      <Badge variant="outline">{item.visitCount} venue(s)</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{item.email || "-"}</span>
                      <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{item.phone || "-"}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Reçue le {formatDateValue(item.createdAt, "dd/MM/yyyy à HH:mm")}
                    </div>
                    <div className="text-sm">
                      Séjour demandé: {formatDateValue(item.dateArrivee, "dd/MM/yyyy")} au{" "}
                      {formatDateValue(item.dateDepart, "dd/MM/yyyy")} • {item.offer ? offerLabels[item.offer] ?? item.offer : "Offre non précisée"}
                    </div>
                    {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                    {item.sejour && item.sejour.chambre && (
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        Séjour {item.sejour.code || ""} • Chambre {item.sejour.chambre.numero || ""} ({item.sejour.chambre.type || ""})
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.status === "en_attente" && (
                      <>
                        <Button size="sm" className="gradient-sunset text-accent-foreground" onClick={() => changeStatus(item.id, "validee")}>
                          <Check className="mr-1 h-4 w-4" /> Valider
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => changeStatus(item.id, "refusee")}>
                          <X className="mr-1 h-4 w-4" /> Refuser
                        </Button>
                      </>
                    )}
                    {(item.status === "validee" || item.status === "acceptee") && (
                      <Button size="sm" asChild className="gradient-sunset text-accent-foreground">
                        <Link href="/admin/attribuer">Attribuer une chambre</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
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
