import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PrintButton } from "@/components/admin/PrintButton";
import { prisma } from "@/lib/prisma";
import { documentTypeLabels, formatCurrency, offerLabels, paymentMethodLabels, paymentStatusMeta, paymentTypeLabels, sourceLabels } from "@/lib/hotel-display";
import { toNumber } from "@/lib/stay-utils";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paymentId?: string }>;
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

function flattenPayments(stay: any) {
  const basePayments = stay.payments.map((payment: any) => ({
    ...payment,
    scopeLabel: "Séjour de base",
  }));

  const extensionPayments = stay.extensions.flatMap((extension: any) =>
    extension.payments.map((payment: any) => ({
      ...payment,
      scopeLabel:
        "Extension du " +
        format(new Date(extension.startedAt), "dd/MM/yyyy HH:mm") +
        " au " +
        format(new Date(extension.endedAt), "dd/MM/yyyy HH:mm"),
    }))
  );

  return [...basePayments, ...extensionPayments].sort(
    (left, right) => new Date(left.paidAt).getTime() - new Date(right.paidAt).getTime()
  );
}

export default async function ReceiptPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { paymentId } = await searchParams;

  const stay = await prisma.sejour.findUnique({
    where: { id },
    include: {
      client: true,
      chambre: true,
      reservation: { select: { reference: true } },
      payments: { where: { extensionId: null }, orderBy: { paidAt: "asc" } },
      extensions: { include: { payments: { orderBy: { paidAt: "asc" } } }, orderBy: { startedAt: "asc" } },
    },
  });

  if (!stay) notFound();

  const totals = getStayTotals(stay);
  const orderedPayments = flattenPayments(stay);
  const requestedPayment = paymentId ? orderedPayments.find((payment: any) => payment.id === paymentId) : null;

  if (paymentId && !requestedPayment) notFound();

  const paymentIndex = requestedPayment ? orderedPayments.findIndex((payment: any) => payment.id === requestedPayment.id) : -1;
  const cumulativePaid = paymentIndex >= 0
    ? orderedPayments.slice(0, paymentIndex + 1).reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0)
    : totals.totalPaid;
  const balanceAfterPayment = Math.max(0, totals.totalNet - cumulativePaid);
  const isFinalReceipt = !requestedPayment;
  const receiptTitle = isFinalReceipt
    ? "Reçu final"
    : requestedPayment?.type === "solde" && balanceAfterPayment <= 0
      ? "Reçu de solde"
      : "Reçu d'acompte";
  const documentTitle = [
    receiptTitle.toLowerCase().replaceAll(" ", "-"),
    stay.code,
    stay.client.lastName,
    stay.client.firstName,
  ]
    .filter(Boolean)
    .join("-");

  return (
    <div className="min-h-screen bg-muted/20 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-4xl space-y-6 px-4">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Button asChild variant="outline">
            <Link href="/admin/registre"><ArrowLeft className="mr-2 h-4 w-4" /> Retour registre</Link>
          </Button>
          <PrintButton label="PDF / Imprimer" documentTitle={documentTitle} />
        </div>

        <Card className="p-4 text-sm text-muted-foreground print:hidden">
          Pour obtenir un PDF, cliquez sur <span className="font-medium text-primary">PDF / Imprimer</span>, puis choisissez
          <span className="font-medium text-primary"> Enregistrer au format PDF</span> dans la boîte d'impression du navigateur.
        </Card>

        {!isFinalReceipt && requestedPayment ? null : totals.totalBalance > 0 ? (
          <Card className="p-6 print:border-0 print:shadow-none">
            <h1 className="text-xl font-semibold text-primary">Reçu final indisponible</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Le solde du séjour n'est pas encore nul. Total restant: {formatCurrency(totals.totalBalance)}.
            </p>
          </Card>
        ) : null}

        {!isFinalReceipt && requestedPayment || totals.totalBalance <= 0 ? (
          <Card className="p-8 space-y-6 print:border-0 print:shadow-none">
            <div className="flex items-start justify-between gap-4 border-b pb-6">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Résidences Chanaude</div>
                <h1 className="mt-2 text-3xl font-semibold text-primary">{receiptTitle}</h1>
                <p className="mt-1 text-sm text-muted-foreground">Émis le {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
              </div>
              <div className="text-right text-sm">
                <div>Code séjour: <span className="font-medium">{stay.code}</span></div>
                {stay.reservation?.reference ? <div>Réf. web: <span className="font-medium">{stay.reservation.reference}</span></div> : null}
                <div>Source: <span className="font-medium">{sourceLabels[stay.source] ?? stay.source}</span></div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                <div className="font-medium text-primary">Client</div>
                <div>{stay.client.firstName} {stay.client.lastName}</div>
                <div>Téléphone: {stay.client.phone}</div>
                {stay.client.email ? <div>Email: {stay.client.email}</div> : null}
                <div>
                  Pièce: {stay.client.documentNumber || "-"}
                  {stay.client.documentType ? " • " + (documentTypeLabels[stay.client.documentType] ?? stay.client.documentType) : ""}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="font-medium text-primary">Séjour</div>
                <div>Chambre {stay.chambre.numero} ({stay.chambre.type})</div>
                <div>Offre: {offerLabels[stay.offer] ?? stay.offer}</div>
                <div>Début: {format(new Date(stay.startedAt), "dd/MM/yyyy HH:mm")}</div>
                <div>Fin actuelle: {format(new Date(stay.currentEndAt), "dd/MM/yyyy HH:mm")}</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Montant total</div>
                <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.totalNet)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Déjà encaissé</div>
                <div className="mt-2 text-2xl font-semibold">{formatCurrency(isFinalReceipt ? totals.totalPaid : cumulativePaid)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Reste dû</div>
                <div className="mt-2 text-2xl font-semibold">{formatCurrency(isFinalReceipt ? totals.totalBalance : balanceAfterPayment)}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="font-medium text-primary">Détail de facturation</div>
                <Badge className={paymentStatusMeta[stay.paymentStatus]?.className}>{paymentStatusMeta[stay.paymentStatus]?.label ?? stay.paymentStatus}</Badge>
              </div>
              <div className="rounded-lg border">
                <div className="grid grid-cols-[1.8fr_1fr_1fr] gap-3 border-b px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <div>Ligne</div>
                  <div>Dates</div>
                  <div className="text-right">Montant net</div>
                </div>
                <div className="grid grid-cols-[1.8fr_1fr_1fr] gap-3 px-4 py-3 text-sm">
                  <div>{offerLabels[stay.offer] ?? stay.offer}</div>
                  <div>{format(new Date(stay.startedAt), "dd/MM/yyyy HH:mm")} - {format(new Date(stay.endedAt), "dd/MM/yyyy HH:mm")}</div>
                  <div className="text-right">{formatCurrency(stay.netAmount)}</div>
                </div>
                {stay.extensions.map((extension: any) => (
                  <div key={extension.id} className="grid grid-cols-[1.8fr_1fr_1fr] gap-3 border-t px-4 py-3 text-sm">
                    <div>Extension • {offerLabels[extension.offer] ?? extension.offer}</div>
                    <div>{format(new Date(extension.startedAt), "dd/MM/yyyy HH:mm")} - {format(new Date(extension.endedAt), "dd/MM/yyyy HH:mm")}</div>
                    <div className="text-right">{formatCurrency(extension.netAmount)}</div>
                  </div>
                ))}
              </div>
            </div>

            {requestedPayment ? (
              <div className="space-y-3">
                <div className="font-medium text-primary">Versement concerné</div>
                <div className="rounded-lg border p-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>Date: {format(new Date(requestedPayment.paidAt), "dd/MM/yyyy HH:mm")}</div>
                    <div>Montant: {formatCurrency(requestedPayment.amount)}</div>
                    <div>Type: {paymentTypeLabels[requestedPayment.type] ?? requestedPayment.type}</div>
                    <div>Méthode: {paymentMethodLabels[requestedPayment.method] ?? requestedPayment.method}</div>
                    <div className="md:col-span-2">Imputation: {requestedPayment.scopeLabel}</div>
                    {requestedPayment.notes ? <div className="md:col-span-2">Note: {requestedPayment.notes}</div> : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="font-medium text-primary">Historique des paiements</div>
                <div className="rounded-lg border">
                  <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr] gap-3 border-b px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <div>Date</div>
                    <div>Type</div>
                    <div>Méthode</div>
                    <div className="text-right">Montant</div>
                  </div>
                  {orderedPayments.map((payment: any) => (
                    <div key={payment.id} className="grid grid-cols-[1fr_1fr_1fr_1.5fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                      <div>{format(new Date(payment.paidAt), "dd/MM/yyyy HH:mm")}</div>
                      <div>{paymentTypeLabels[payment.type] ?? payment.type}</div>
                      <div>{paymentMethodLabels[payment.method] ?? payment.method}</div>
                      <div className="text-right">{formatCurrency(payment.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
