import Link from "next/link";
import { ArrowRight, Search, UserSquare2 } from "lucide-react";
import { format } from "date-fns";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { documentTypeLabels, formatCurrency, paymentStatusLabels, stayStatusLabels } from "@/lib/hotel-display";
import { toNumber } from "@/lib/stay-utils";

const PAGE_SIZE = 12;

type PageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

function getPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function getClientWhere(query: string): Prisma.ClientWhereInput {
  if (!query) return {};

  return {
    OR: [
      { firstName: { contains: query } },
      { lastName: { contains: query } },
      { phone: { contains: query } },
      { email: { contains: query } },
      { documentNumber: { contains: query } },
    ],
  };
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
  const query = (params.q ?? "").trim();
  const page = getPage(params.page);
  const where = getClientWhere(query);

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        reservations: {
          select: { id: true },
        },
        sejours: {
          orderBy: { startedAt: "desc" },
          include: {
            chambre: {
              select: { numero: true, type: true },
            },
            extensions: {
              select: {
                netAmount: true,
                amountPaid: true,
                balanceDue: true,
              },
            },
          },
        },
      },
    }),
    prisma.client.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Clients</h1>
          <p className="text-sm text-muted-foreground">Dossiers, historique des venues et encaissements cumulés</p>
        </div>
        <Badge variant="outline">{total} client(s)</Badge>
      </div>

      <Card className="p-5">
        <form className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={query}
              placeholder="Nom, téléphone, email, numéro de pièce..."
              className="pl-9"
            />
          </div>
          <Button type="submit">Rechercher</Button>
          {query ? (
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/clients">Réinitialiser</Link>
            </Button>
          ) : null}
        </form>
      </Card>

      {clients.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Aucun client trouvé.</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {clients.map((client) => {
            const totals = getClientTotals(client);
            const latestStay = client.sejours[0] ?? null;

            return (
              <Card key={client.id} className="p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-primary">{client.firstName} {client.lastName}</h2>
                      <Badge variant="outline">{client.sejours.length} séjour(s)</Badge>
                      <Badge variant="outline">{client.reservations.length} réservation(s)</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Tél: {client.phone}
                      {client.email ? " • " + client.email : ""}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Pièce: {client.documentNumber || "-"}
                      {client.documentType ? " • " + (documentTypeLabels[client.documentType] ?? client.documentType) : ""}
                    </div>
                    {client.birthDate ? (
                      <div className="text-sm text-muted-foreground">
                        Naissance: {format(new Date(client.birthDate), "dd/MM/yyyy")}
                      </div>
                    ) : null}
                  </div>

                  <Button variant="outline" asChild>
                    <Link href={"/admin/clients/" + client.id}>
                      <UserSquare2 className="mr-2 h-4 w-4" />
                      Ouvrir
                    </Link>
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-3 text-sm">
                  <div className="rounded-lg bg-muted/40 p-3">
                    Total net
                    <div className="mt-1 font-medium">{formatCurrency(totals.totalNet)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    Encaissé
                    <div className="mt-1 font-medium">{formatCurrency(totals.totalPaid)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    Reste dû
                    <div className="mt-1 font-medium">{formatCurrency(totals.totalBalance)}</div>
                  </div>
                </div>

                {latestStay ? (
                  <div className="rounded-lg border p-4 text-sm">
                    <div className="font-medium text-primary">Dernier séjour</div>
                    <div className="mt-2">
                      Chambre {latestStay.chambre.numero} ({latestStay.chambre.type})
                    </div>
                    <div className="text-muted-foreground">
                      {format(new Date(latestStay.startedAt), "dd/MM/yyyy HH:mm")} au{" "}
                      {format(new Date(latestStay.currentEndAt), "dd/MM/yyyy HH:mm")}
                    </div>
                    <div className="text-muted-foreground">
                      Statut: {stayStatusLabels[latestStay.status] ?? latestStay.status} • Paiement:{" "}
                      {paymentStatusLabels[latestStay.paymentStatus] ?? latestStay.paymentStatus}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    Aucun séjour enregistré pour ce client.
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={page <= 1}
            asChild={page > 1}
          >
            {page > 1 ? (
              <Link href={`/admin/clients?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page - 1) }).toString()}`}>
                Page précédente
              </Link>
            ) : (
              <span>Page précédente</span>
            )}
          </Button>

          <div className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </div>

          <Button
            variant="outline"
            disabled={page >= totalPages}
            asChild={page < totalPages}
          >
            {page < totalPages ? (
              <Link href={`/admin/clients?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page + 1) }).toString()}`}>
                Suivante
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            ) : (
              <span>Suivante</span>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
