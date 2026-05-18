import Link from "next/link";
import { ArrowRight, Download, Search, UserSquare2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { clientGenderLabels, documentTypeLabels, formatCurrency, stayStatusLabels } from "@/lib/hotel-display";
import { buildClientWhere } from "@/lib/client-filters";
import { toNumber } from "@/lib/stay-utils";

const PAGE_SIZE = 20;

type PageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    month?: string;
    dateFrom?: string;
    dateTo?: string;
    type?: string;
    nationality?: string;
    status?: string;
  }>;
};

function getPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function getFilterParams(params: Awaited<PageProps["searchParams"]>) {
  return {
    q: (params.q ?? "").trim(),
    month: params.month ?? "",
    dateFrom: params.dateFrom ?? "",
    dateTo: params.dateTo ?? "",
    type: params.type ?? "all",
    nationality: params.nationality ?? "all",
    status: params.status ?? "all",
  };
}

function buildUrl(path: string, filters: ReturnType<typeof getFilterParams>, page?: number) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value);
  });
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function getClientTotals(client: {
  sejours: Array<{
    netAmount: unknown;
    amountPaid: unknown;
    balanceDue: unknown;
    extensions: Array<{
      netAmount: unknown;
      amountPaid: unknown;
      balanceDue: unknown;
    }>;
  }>;
}) {
  return client.sejours.reduce(
    (totals, stay) => {
      totals.totalNet += toNumber(stay.netAmount);
      totals.totalPaid += toNumber(stay.amountPaid);
      totals.totalBalance += toNumber(stay.balanceDue);

      for (const extension of stay.extensions) {
        totals.totalNet += toNumber(extension.netAmount);
        totals.totalPaid += toNumber(extension.amountPaid);
        totals.totalBalance += toNumber(extension.balanceDue);
      }

      return totals;
    },
    { totalNet: 0, totalPaid: 0, totalBalance: 0 }
  );
}

export default async function ClientsListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = getFilterParams(params);
  const page = getPage(params.page);
  const where = buildClientWhere(filters);

  const [clients, total, nationalities] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        reservations: { select: { id: true } },
        sejours: {
          orderBy: { startedAt: "desc" },
          include: {
            chambre: { select: { numero: true, type: true } },
            extensions: { select: { netAmount: true, amountPaid: true, balanceDue: true } },
          },
        },
      },
    }),
    prisma.client.count({ where }),
    prisma.client.findMany({
      where: { nationality: { not: null } },
      distinct: ["nationality"],
      select: { nationality: true },
      orderBy: { nationality: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportUrl = buildUrl("/api/admin/clients/export/pdf", filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Clients</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{total} client(s)</Badge>
          <Button variant="outline" asChild>
            <Link href={exportUrl} target="_blank">
              <Download className="mr-2 h-4 w-4" /> Export PDF
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={filters.q} placeholder="Nom, contact, pièce..." className="pl-9" />
          </div>
          <Input name="month" type="month" defaultValue={filters.month} />
          <Input name="dateFrom" type="date" defaultValue={filters.dateFrom} />
          <Input name="dateTo" type="date" defaultValue={filters.dateTo} />
          <select name="type" defaultValue={filters.type} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">Tous types</option>
            <option value="avec_sejour">Avec séjour</option>
            <option value="sans_sejour">Sans séjour</option>
            <option value="avec_reservation">Avec réservation</option>
          </select>
          <select name="status" defaultValue={filters.status} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">Tous statuts</option>
            <option value="planifie">Réservation</option>
            <option value="en_cours">En cours</option>
            <option value="termine">Terminé</option>
            <option value="impaye">Reste à payer</option>
          </select>
          <select name="nationality" defaultValue={filters.nationality} className="h-10 rounded-md border border-input bg-background px-3 text-sm xl:col-span-2">
            <option value="all">Toutes nationalités</option>
            {nationalities.map((item) => item.nationality ? <option key={item.nationality} value={item.nationality}>{item.nationality}</option> : null)}
          </select>
          <div className="flex gap-2 xl:col-span-5">
            <Button type="submit">Filtrer</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/clients">Réinitialiser</Link>
            </Button>
          </div>
        </form>
      </Card>

      {clients.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Aucun client trouvé.</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Prénom</th>
                  <th className="px-4 py-3">Nationalité</th>
                  <th className="px-4 py-3">N° pièce</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Séjours</th>
                  <th className="px-4 py-3">Reste</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map((client) => {
                  const totals = getClientTotals(client);
                  const latestStay = client.sejours[0] ?? null;
                  const documentLabel = client.documentNumber
                    ? `${client.documentType ? (documentTypeLabels[client.documentType] ?? client.documentType) + " " : ""}${client.documentNumber}`
                    : "-";

                  return (
                    <tr key={client.id} className="align-top hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-primary">{client.lastName}</td>
                      <td className="px-4 py-3">{client.firstName}</td>
                      <td className="px-4 py-3">
                        {client.nationality || "-"}
                        {client.gender ? <div className="text-xs text-muted-foreground">{clientGenderLabels[client.gender] ?? client.gender}</div> : null}
                      </td>
                      <td className="px-4 py-3">{documentLabel}</td>
                      <td className="px-4 py-3">
                        <div>{client.phone}</div>
                        {client.email ? <div className="text-xs text-muted-foreground">{client.email}</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div>{client.sejours.length} séjour(s)</div>
                        <div className="text-xs text-muted-foreground">{client.reservations.length} réservation(s)</div>
                        {latestStay ? <div className="text-xs text-muted-foreground">{stayStatusLabels[latestStay.status] ?? latestStay.status} • Ch. {latestStay.chambre.numero}</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className={totals.totalBalance > 0 ? "font-semibold text-red-600" : "text-muted-foreground"}>{formatCurrency(totals.totalBalance)}</div>
                        <div className="text-xs text-muted-foreground">Payé {formatCurrency(totals.totalPaid)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/clients/${client.id}`}>
                            <UserSquare2 className="mr-2 h-4 w-4" /> Ouvrir
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? <Link href={buildUrl("/admin/clients", filters, page - 1)}>Page précédente</Link> : <span>Page précédente</span>}
          </Button>
          <div className="text-sm text-muted-foreground">Page {page} / {totalPages}</div>
          <Button variant="outline" disabled={page >= totalPages} asChild={page < totalPages}>
            {page < totalPages ? (
              <Link href={buildUrl("/admin/clients", filters, page + 1)}>
                Suivante <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            ) : <span>Suivante</span>}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
