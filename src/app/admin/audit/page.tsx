"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, History, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface AuditItem {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  createdAt: string;
}

interface UserItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface FieldChangeItem {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

const detailLabels: Record<string, string> = {
  previousStatus: "Statut avant",
  newStatus: "Statut après",
  reservationId: "Réservation",
  reference: "Référence",
  chambre: "Chambre",
  amount: "Montant",
  method: "Mode",
  paymentStatus: "Paiement",
  previousStartAt: "Début avant",
  nextStartAt: "Début après",
  previousEndAt: "Fin avant",
  nextEndAt: "Fin après",
  depositHeldAmount: "Caution",
};

const actionLabels: Record<string, { label: string; className: string }> = {
  "reservation.confirmee": { label: "Réservation confirmée", className: "bg-emerald-100 text-emerald-800" },
  "reservation.refusee": { label: "Réservation refusée", className: "bg-red-100 text-red-800" },
  "reservation.annulee": { label: "Réservation annulée", className: "bg-gray-100 text-gray-800" },
  "reservation.reportee": { label: "Réservation reportée", className: "bg-amber-100 text-amber-800" },
  "reservation.delete": { label: "Réservation supprimée", className: "bg-red-100 text-red-800" },
  "attribution.create": { label: "Attribution créée", className: "bg-blue-100 text-blue-800" },
  "attribution.delete": { label: "Attribution annulée", className: "bg-red-100 text-red-800" },
  "stay.create": { label: "Séjour créé", className: "bg-emerald-100 text-emerald-800" },
  "stay.en_cours": { label: "Arrivée", className: "bg-blue-100 text-blue-800" },
  "stay.check_in": { label: "Arrivée validée", className: "bg-blue-100 text-blue-800" },
  "stay.termine": { label: "Départ", className: "bg-gray-100 text-gray-800" },
  "stay.annule": { label: "Séjour annulé", className: "bg-red-100 text-red-800" },
  "payment.create": { label: "Paiement enregistré", className: "bg-emerald-100 text-emerald-800" },
  "extension.create": { label: "Extension ajoutée", className: "bg-violet-100 text-violet-800" },
  "invoice.print.final": { label: "Facture finale imprimée", className: "bg-sky-100 text-sky-800" },
  "invoice.print.acompte": { label: "Facture acompte imprimée", className: "bg-sky-100 text-sky-800" },
};

export default function AuditPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ userId: "all", action: "", query: "", dateFrom: "", dateTo: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filters.userId !== "all") params.set("userId", filters.userId);
    if (filters.action) params.set("action", filters.action);
    if (filters.query.trim().length >= 2) params.set("query", filters.query.trim());
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);

    const res = await fetch("/api/admin/audit?" + params.toString());
    if (!res.ok) {
      toast.error("Erreur de chargement du journal");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.items ?? []);
    setUsers(data.users ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [page, filters.userId, filters.action, filters.query, filters.dateFrom, filters.dateTo]);

  useEffect(() => { void load(); }, [load]);

  function getActionMeta(action: string) {
    return actionLabels[action] ?? { label: action, className: "bg-gray-100 text-gray-800" };
  }

  function parseDetails(details: string | null): Record<string, unknown> | null {
    if (!details) return null;
    try { return JSON.parse(details); } catch { return null; }
  }

  function formatDetailValue(value: unknown) {
    if (value instanceof Date) return format(value, "dd/MM/yyyy HH:mm");
    if (typeof value === "string") {
      const date = new Date(value);
      if (/^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(date.getTime())) {
        return format(date, "dd/MM/yyyy HH:mm");
      }
      return value;
    }
    if (typeof value === "number") return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
  }

  function getFieldChanges(details: Record<string, unknown> | null): FieldChangeItem[] {
    const rawChanges = details?.fieldChanges;
    if (!Array.isArray(rawChanges)) return [];

    return rawChanges
      .filter((item): item is FieldChangeItem => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Record<string, unknown>;
        return typeof candidate.field === "string" && typeof candidate.label === "string";
      })
      .slice(0, 12);
  }

  function buildAuditSentence(item: AuditItem, details: Record<string, unknown> | null) {
    const action = getActionMeta(item.action).label.toLowerCase();
    const reference = details?.reference ? ` (${String(details.reference)})` : "";
    const chambre = details?.chambre ? ` chambre ${String(details.chambre)}` : "";

    if (item.action === "payment.create") {
      return `${item.userName} a enregistré un paiement sur ${item.targetType}${reference}.`;
    }
    if (item.action === "stay.check_in") {
      return `${item.userName} a validé l'arrivée et la remise de clé${chambre}.`;
    }
    if (item.action === "stay.report") {
      return `${item.userName} a reporté un séjour${reference}.`;
    }
    if (item.action.startsWith("reservation.")) {
      return `${item.userName} a mis à jour une réservation${reference}: ${action}.`;
    }
    if (item.action.startsWith("discount_request.")) {
      return `${item.userName} a traité une demande de remise: ${action}.`;
    }
    if (item.action.startsWith("chambre.")) {
      return `${item.userName} a modifié une chambre: ${action}.`;
    }
    return `${item.userName} a effectué l'action: ${getActionMeta(item.action).label}.`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Journal d&apos;audit</h1>
        </div>
        <Badge variant="outline">{total} action(s)</Badge>
      </div>

      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <Label>Utilisateur</Label>
            <Select value={filters.userId} onValueChange={(v) => { setFilters({ ...filters, userId: v }); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Action (recherche)</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                placeholder="reservation, stay, payment..."
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label>Client / chambre</Label>
            <Input
              value={filters.query}
              onChange={(e) => { setFilters({ ...filters, query: e.target.value }); setPage(1); }}
              placeholder="Nom, chambre, référence"
            />
          </div>
          <div>
            <Label>Début</Label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div>
            <Label>Fin</Label>
            <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={() => { setFilters({ userId: "all", action: "", query: "", dateFrom: "", dateTo: "" }); setPage(1); }}>
              Réinitialiser
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
          Aucune action enregistrée pour ces filtres.
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const meta = getActionMeta(item.action);
            const details = parseDetails(item.details);
            const fieldChanges = getFieldChanges(details);
            return (
              <Card key={item.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={meta.className}>{meta.label}</Badge>
                      <span className="text-xs text-muted-foreground">{item.targetType}</span>
                    </div>
                    <div className="text-sm font-medium text-primary">{buildAuditSentence(item, details)}</div>
                    <div className="text-sm text-muted-foreground">
                      Référence interne: <span className="font-mono text-xs">{item.targetId.slice(0, 12)}…</span>
                    </div>
                    {details && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {Object.entries(details).filter(([key]) => key !== "fieldChanges").slice(0, 8).map(([key, val]) => (
                          <span key={key} className="rounded-full border px-2 py-1">
                            {detailLabels[key] ?? key}: <span className="font-medium">{formatDetailValue(val)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {fieldChanges.length > 0 && (
                      <div className="grid gap-2 pt-2 text-xs text-muted-foreground md:grid-cols-2">
                        {fieldChanges.map((change, index) => (
                          <div key={`${change.field}-${index}`} className="rounded-lg border bg-muted/30 px-3 py-2">
                            <span className="font-medium text-primary">{change.label}</span>
                            <span> : {formatDetailValue(change.before)} -&gt; {formatDetailValue(change.after)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm:ss")}
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
