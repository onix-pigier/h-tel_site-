import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, requireStaff } from "@/lib/api-utils";
import { buildClientWhere } from "@/lib/client-filters";
import { clientGenderLabels, documentTypeLabels } from "@/lib/hotel-display";

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
  const where = buildClientWhere({
    q: searchParams.get("q"),
    month: searchParams.get("month"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    type: searchParams.get("type"),
    nationality: searchParams.get("nationality"),
    status: searchParams.get("status"),
  });

  const clients = await prisma.client.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      sejours: { select: { id: true, status: true } },
      reservations: { select: { id: true } },
    },
  });

  const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm");
  const rows = clients.map((client) => {
    const documentLabel = client.documentNumber
      ? `${client.documentType ? (documentTypeLabels[client.documentType] ?? client.documentType) + " " : ""}${client.documentNumber}`
      : "-";

    return `
      <tr>
        <td>${escapeHtml(client.lastName)}</td>
        <td>${escapeHtml(client.firstName)}</td>
        <td>${escapeHtml(client.nationality || "-")}</td>
        <td>${escapeHtml(documentLabel)}</td>
        <td>${escapeHtml(client.phone)}${client.email ? `<br>${escapeHtml(client.email)}` : ""}</td>
        <td>${escapeHtml(client.gender ? clientGenderLabels[client.gender] ?? client.gender : "-")}</td>
        <td>${client.sejours.length}</td>
        <td>${client.reservations.length}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>CLIENTS CHANAUDE</title>
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
        <div class="title">Clients Chanaude</div>
        <div class="meta">Export basé sur les filtres actifs</div>
      </div>
      <div class="meta">Généré le ${escapeHtml(generatedAt)}</div>
    </div>
    <div class="count">${clients.length} client(s)</div>
    <table>
      <thead>
        <tr>
          <th>Nom</th>
          <th>Prénom</th>
          <th>Nationalité</th>
          <th>N° pièce</th>
          <th>Contact</th>
          <th>Sexe</th>
          <th>Séjours</th>
          <th>Réservations</th>
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
