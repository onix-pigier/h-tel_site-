import Link from "next/link";
import { ArrowLeft, Printer, Receipt, UserSquare2 } from "lucide-react";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import {
  documentTypeLabels,
  formatCurrency,
  offerLabels,
  paymentMethodLabels,
  paymentStatusMeta,
  paymentTypeLabels,
  sourceLabels,
  stayStatusLabels,
} from "@/lib/hotel-display";
import { toNumber } from "@/lib/stay-utils";

type PageProps = {
  params: Promise<{ id: string }>;
};

function getStayTotals(stay: any) {
  const extensionNet = stay.extensions.reduce((sum: number, extension: any) => sum + toNumber(extension.netAmount), 0);
  const extensionPaid = stay.extensions.reduce((sum: number, extension: any) => sum + toNumber(extension.amountPaid), 0);
  const extensionBalance = stay.extensions.reduce((sum: number, extension: any) => sum + toNumber(extension.balanceDue), 0);
  return {
    totalNet: toNumber(stay.netAmount) + extensionNet,
    totalPaid: toNumber(stay.amountPaid) + extensionPaid,
    totalBalance: toNumber(stay.balanceDue) + extensionBalance,
  };
}

function getLatestPaymentId(stay: any) {
  const payments = [
    ...stay.payments,
    ...stay.extensions.flatMap((extension: any) => extension.payments),
  ].sort((left: any, right: any) => new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime());

  return payments[0]?.id ?? null;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      reservations: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      sejours: {
        orderBy: { startedAt: "desc" },
        include: {
          chambre: true,
          reservation: { select: { reference: true, status: true } },
          payments: { where: { extensionId: null }, orderBy: { paidAt: "desc" } },
          extensions: { include: { payments: { orderBy: { paidAt: "desc" } } }, orderBy: { startedAt: "desc" } },
          clientNotes: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!client) notFound();

  const totalVisits = client.sejours.length;
  const totalPaid = client.sejours.reduce((sum: number, stay: any) => sum + getStayTotals(stay).totalPaid, 0);
  const totalOutstanding = client.sejours.reduce((sum: number, stay: any) => sum + getStayTotals(stay).totalBalance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/registre"><ArrowLeft className="mr-2 h-4 w-4" /> Retour registre</Link>
          </Button>
          <h1 className="mt-3 font-display text-2xl font-bold text-primary">{client.firstName} {client.lastName}</h1>
          <p className="text-sm text-muted-foreground">Historique client consolidé, séjours, paiements, extensions et comportement</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{totalVisits} séjour(s)</Badge>
          <Badge variant="outline">{client.reservations.length} réservation(s) web</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm font-medium text-primary">Identité</div>
          <div className="mt-3 space-y-2 text-sm">
            <div>Téléphone: {client.phone}</div>
            {client.email ? <div>Email: {client.email}</div> : null}
            <div>
              Pièce: {client.documentNumber || "-"}
              {client.documentType ? " • " + (documentTypeLabels[client.documentType] ?? client.documentType) : ""}
            </div>
            {client.birthDate ? <div>Naissance: {format(new Date(client.birthDate), "dd/MM/yyyy")}</div> : null}
            {client.age ? <div>Âge: {client.age} ans</div> : null}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-medium text-primary">Encaissements cumulés</div>
          <div className="mt-3 text-2xl font-semibold">{formatCurrency(totalPaid)}</div>
          <div className="mt-2 text-sm text-muted-foreground">Toutes venues confondues</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-medium text-primary">Restant dû cumulé</div>
          <div className="mt-3 text-2xl font-semibold">{formatCurrency(totalOutstanding)}</div>
          <div className="mt-2 text-sm text-muted-foreground">Séjours et extensions inclus</div>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserSquare2 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-primary">Historique des séjours</h2>
        </div>
        <div className="grid gap-4">
          {client.sejours.map((stay: any) => {
            const totals = getStayTotals(stay);
            const latestPaymentId = getLatestPaymentId(stay);
            return (
              <div key={stay.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{sourceLabels[stay.source] ?? stay.source}</Badge>
                      <Badge variant="outline">{stayStatusLabels[stay.status] ?? stay.status}</Badge>
                      <Badge className={paymentStatusMeta[stay.paymentStatus]?.className}>{paymentStatusMeta[stay.paymentStatus]?.label ?? stay.paymentStatus}</Badge>
                    </div>
                    <div>Chambre {stay.chambre.numero} ({stay.chambre.type}) • {offerLabels[stay.offer] ?? stay.offer}</div>
                    <div className="text-muted-foreground">Du {format(new Date(stay.startedAt), "dd/MM/yyyy HH:mm")} au {format(new Date(stay.currentEndAt), "dd/MM/yyyy HH:mm")}</div>
                    {stay.reservation?.reference ? <div className="text-muted-foreground">Réf. réservation: {stay.reservation.reference}</div> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {latestPaymentId ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={"/admin/registre/" + stay.id + "/recu?paymentId=" + latestPaymentId} target="_blank"><Receipt className="mr-1 h-4 w-4" /> Reçu acompte</Link>
                      </Button>
                    ) : null}
                    {totals.totalBalance <= 0 ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={"/admin/registre/" + stay.id + "/recu"} target="_blank"><Printer className="mr-1 h-4 w-4" /> Reçu final</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3 text-sm">
                  <div className="rounded-lg bg-muted/40 p-3">Total net: <span className="font-medium">{formatCurrency(totals.totalNet)}</span></div>
                  <div className="rounded-lg bg-muted/40 p-3">Payé: <span className="font-medium">{formatCurrency(totals.totalPaid)}</span></div>
                  <div className="rounded-lg bg-muted/40 p-3">Reste: <span className="font-medium">{formatCurrency(totals.totalBalance)}</span></div>
                </div>

                {stay.extensions.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium text-primary">Extensions</div>
                    {stay.extensions.map((extension: any) => (
                      <div key={extension.id} className="rounded-lg border p-3">
                        <div>{offerLabels[extension.offer] ?? extension.offer}</div>
                        <div className="text-muted-foreground">Du {format(new Date(extension.startedAt), "dd/MM/yyyy HH:mm")} au {format(new Date(extension.endedAt), "dd/MM/yyyy HH:mm")}</div>
                        <div>Net {formatCurrency(extension.netAmount)} • Payé {formatCurrency(extension.amountPaid)} • Reste {formatCurrency(extension.balanceDue)}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {(stay.payments.length > 0 || stay.extensions.some((extension: any) => extension.payments.length > 0)) ? (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium text-primary">Paiements</div>
                    <div className="rounded-lg border">
                      <div className="grid grid-cols-[1fr_1fr_1fr_1.4fr] gap-3 border-b px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <div>Date</div>
                        <div>Type</div>
                        <div>Méthode</div>
                        <div className="text-right">Montant</div>
                      </div>
                      {[...stay.payments, ...stay.extensions.flatMap((extension: any) => extension.payments)]
                        .sort((left: any, right: any) => new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime())
                        .map((payment: any) => (
                          <div key={payment.id} className="grid grid-cols-[1fr_1fr_1fr_1.4fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                            <div>{format(new Date(payment.paidAt), "dd/MM/yyyy HH:mm")}</div>
                            <div>{paymentTypeLabels[payment.type] ?? payment.type}</div>
                            <div>{paymentMethodLabels[payment.method] ?? payment.method}</div>
                            <div className="text-right">{formatCurrency(payment.amount)}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}

                {stay.clientNotes.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium text-primary">Comportement / notes</div>
                    {stay.clientNotes.map((note: any) => (
                      <div key={note.id} className="rounded-lg border p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{note.moment === "avant" ? "Avant séjour" : "Après séjour"}</div>
                        {note.comment ? <div className="mt-1">{note.comment}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-primary">Réservations web</h2>
        <div className="grid gap-3">
          {client.reservations.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune réservation web.</div>
          ) : (
            client.reservations.map((reservation: any) => (
              <div key={reservation.id} className="rounded-lg border p-4 text-sm">
                <div className="font-medium">{reservation.reference || reservation.id}</div>
                <div className="text-muted-foreground">Statut: {reservation.status}</div>
                <div className="text-muted-foreground">Créée le {format(new Date(reservation.createdAt), "dd/MM/yyyy HH:mm")}</div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-primary">Notes globales</h2>
        <div className="grid gap-3">
          {client.notes.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune note enregistrée.</div>
          ) : (
            client.notes.map((note: any) => (
              <div key={note.id} className="rounded-lg border p-4 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{note.moment === "avant" ? "Avant" : "Après"} • {format(new Date(note.createdAt), "dd/MM/yyyy HH:mm")}</div>
                {note.comment ? <div className="mt-1">{note.comment}</div> : null}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
