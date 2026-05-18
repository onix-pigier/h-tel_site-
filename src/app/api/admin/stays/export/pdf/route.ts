import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff } from "@/lib/api-utils";
import { buildStayWhere } from "@/lib/stay-filters";
import { formatCurrency, offerLabels, paymentStatusLabels, sourceLabels, stayStatusLabels } from "@/lib/hotel-display";

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
    query: searchParams.get("query"),
  });

  const items = await prisma.sejour.findMany({
    where,
    include: {
      client: true,
      chambre: true,
      reservation: { select: { reference: true } },
      extensions: true,
    },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
  });

  const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm");
  const rows = items.map((item) => {
    const extensionNet = item.extensions.reduce((sum, extension) => sum + Number(extension.netAmount), 0);
    const extensionPaid = item.extensions.reduce((sum, extension) => sum + Number(extension.amountPaid), 0);
    const extensionBalance = item.extensions.reduce((sum, extension) => sum + Number(extension.balanceDue), 0);

    return `
      <tr>
        <td>${escapeHtml(item.code)}</td>
        <td>${escapeHtml(sourceLabels[item.source] ?? item.source)}</td>
        <td>${escapeHtml(stayStatusLabels[item.status] ?? item.status)}</td>
        <td>${escapeHtml(paymentStatusLabels[item.paymentStatus] ?? item.paymentStatus)}</td>
        <td>${escapeHtml(item.client.firstName)} ${escapeHtml(item.client.lastName)}</td>
        <td>${escapeHtml(item.chambre.numero)}</td>
        <td>${escapeHtml(offerLabels[item.offer] ?? item.offer)}</td>
        <td>${escapeHtml(format(item.startedAt, "dd/MM/yyyy HH:mm"))}</td>
        <td>${escapeHtml(format(item.currentEndAt, "dd/MM/yyyy HH:mm"))}</td>
        <td>${escapeHtml(formatCurrency(Number(item.netAmount) + extensionNet))}</td>
        <td>${escapeHtml(formatCurrency(Number(item.amountPaid) + extensionPaid))}</td>
        <td>${escapeHtml(formatCurrency(Number(item.balanceDue) + extensionBalance))}</td>
      </tr>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>REGISTRE CHANAUDE</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: Arial, sans-serif; color: #1f2937; margin: 0; }
      .header { display: flex; justify-content: space-between; align-items: end; margin-bottom: 16px; }
      .title { font-size: 22px; font-weight: 700; color: #0f3557; }
      .meta { font-size: 12px; color: #6b7280; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #d1d5db; padding: 7px 8px; text-align: left; vertical-align: top; }
      th { background: #0f3557; color: white; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
      tr:nth-child(even) td { background: #f8fafc; }
      .count { margin-bottom: 12px; font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="title">Registre  Chanaude</div>
        <div class="meta">Export PDF imprimable</div>
      </div>
      <div class="meta">Généré le ${escapeHtml(generatedAt)}</div>
    </div>
    <div class="count">${items.length} séjour(s)</div>
    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Source</th>
          <th>Statut</th>
          <th>Paiement</th>
          <th>Client</th>
          <th>Chambre</th>
          <th>Offre</th>
          <th>Début</th>
          <th>Fin</th>
          <th>Total</th>
          <th>Payé</th>
          <th>Reste à payer</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.addEventListener("load", () => window.print());</script>
  </body>
  </html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
