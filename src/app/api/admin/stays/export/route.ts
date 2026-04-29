import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff } from "@/lib/api-utils";
import { buildStayWhere } from "@/lib/stay-filters";
import { formatCurrency, offerLabels, paymentStatusLabels, sourceLabels, stayStatusLabels } from "@/lib/hotel-display";

function csvCell(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replace(/"/g, '""');
  return '"' + normalized + '"';
}

export const GET = withErrorHandler(async (req: Request) => {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const where = buildStayWhere({
    status: searchParams.get("status"),
    source: searchParams.get("source"),
    paymentStatus: searchParams.get("paymentStatus"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
  });

  const items = await prisma.sejour.findMany({
    where,
    include: {
      client: { include: { sejours: { select: { id: true } } } },
      chambre: true,
      reservation: { select: { reference: true } },
      extensions: true,
    },
    orderBy: { startedAt: "desc" },
  });

  const headers = [
    "code",
    "source",
    "statut_sejour",
    "statut_paiement",
    "reference_reservation",
    "prenom",
    "nom",
    "telephone",
    "email",
    "numero_piece",
    "numero_chambre",
    "type_chambre",
    "offre",
    "debut",
    "fin_actuelle",
    "montant_net",
    "montant_paye",
    "reste_du",
    "nb_extensions",
    "nb_venues_client",
  ];

  const rows = items.map((item) => {
    const extensionNet = item.extensions.reduce((sum, extension) => sum + Number(extension.netAmount), 0);
    const extensionPaid = item.extensions.reduce((sum, extension) => sum + Number(extension.amountPaid), 0);
    const extensionBalance = item.extensions.reduce((sum, extension) => sum + Number(extension.balanceDue), 0);

    return [
    item.code,
    sourceLabels[item.source] ?? item.source,
    stayStatusLabels[item.status] ?? item.status,
    paymentStatusLabels[item.paymentStatus] ?? item.paymentStatus,
    item.reservation?.reference ?? "",
    item.client.firstName,
    item.client.lastName,
    item.client.phone,
    item.client.email ?? "",
    item.client.documentNumber ?? "",
    item.chambre.numero,
    item.chambre.type,
    offerLabels[item.offer] ?? item.offer,
    format(item.startedAt, "yyyy-MM-dd HH:mm"),
    format(item.currentEndAt, "yyyy-MM-dd HH:mm"),
    formatCurrency(Number(item.netAmount) + extensionNet),
    formatCurrency(Number(item.amountPaid) + extensionPaid),
    formatCurrency(Number(item.balanceDue) + extensionBalance),
    item.extensions.length,
    item.client.sejours.length,
  ];
  });

  const csv = [headers, ...rows].map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\n");
  const filename = "registre-sejours-" + format(new Date(), "yyyyMMdd-HHmm") + ".csv";

  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + filename + '"',
    },
  });
});
