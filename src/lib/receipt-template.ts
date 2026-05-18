import fs from "fs";
import path from "path";
import { format } from "date-fns";
import { offerLabels, paymentMethodLabels, paymentTypeLabels, sourceLabels, documentTypeLabels } from "@/lib/hotel-display";
import { generateInvoiceCode } from "@/lib/reference";

let cachedLogoBase64: string | null = null;

function getLogoBase64(): string {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const logoPath = path.join(process.cwd(), "public/assets/logo1.png");
    const buffer = fs.readFileSync(logoPath);
    cachedLogoBase64 = buffer.toString("base64");
    return cachedLogoBase64;
  } catch {
    return "";
  }
}

interface ReceiptPayment {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  type: string;
  notes?: string | null;
  scopeLabel?: string;
}

interface ReceiptExtension {
  id: string;
  startedAt: string;
  endedAt: string;
  offer: string;
  netAmount: number;
  amountPaid: number;
  balanceDue: number;
  payments: ReceiptPayment[];
}

interface ReceiptStay {
  id: string;
  code: string;
  source: string;
  offer: string;
  startedAt: string;
  endedAt: string;
  currentEndAt: string;
  netAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  client: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    documentNumber?: string | null;
    documentType?: string | null;
  };
  chambre: {
    numero: string;
    type: string;
    prix: number;
  };
  reservation?: {
    reference?: string | null;
  } | null;
  payments: ReceiptPayment[];
  extensions: ReceiptExtension[];
}

interface ReceiptOptions {
  stay: ReceiptStay;
  type: "final" | "acompte";
  payment?: ReceiptPayment | null;
  cumulativePaid?: number;
  balanceAfter?: number;
  handledBy?: string;
}

function fmtCurrency(value: unknown): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount);
}

function calculateNights(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function generateReceiptHTML(options: ReceiptOptions): string {
  const { stay, type, payment, cumulativePaid, balanceAfter, handledBy } = options;
  const logoBase64 = getLogoBase64();
  const logoSrc = logoBase64 ? `data:image/png;base64,${logoBase64}` : "";

  const extensionNet = stay.extensions.reduce((sum, ext) => sum + Number(ext.netAmount), 0);
  const totalNet = Number(stay.netAmount) + extensionNet;
  const totalPaid = cumulativePaid ?? (Number(stay.amountPaid) + stay.extensions.reduce((s, e) => s + Number(e.amountPaid), 0));
  const totalBalance = balanceAfter ?? Math.max(0, totalNet - totalPaid);

  const isFinal = type === "final";
  const receiptTitle = isFinal ? "FACTURE FINALE" : "FACTURE D'ACOMPTE";
  const receiptNum = generateInvoiceCode({
    type,
    issuedAt: payment ? new Date(payment.paidAt) : new Date(stay.currentEndAt),
    stayCode: stay.code,
    paymentId: payment?.id ?? null,
  });
  const nights = calculateNights(stay.startedAt, stay.endedAt);
  const pricePerNight = Number(stay.chambre.prix);

  // Payments to show
  const allPayments: ReceiptPayment[] = [];
  for (const p of stay.payments) allPayments.push({ ...p, scopeLabel: "Séjour de base" });
  for (const ext of stay.extensions) {
    for (const p of ext.payments) {
      allPayments.push({
        ...p,
        scopeLabel: `Extension ${format(new Date(ext.startedAt), "dd/MM")} – ${format(new Date(ext.endedAt), "dd/MM")}`,
      });
    }
  }
  allPayments.sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());

  const paymentRows = payment
    ? [payment]
    : isFinal
      ? allPayments
      : [];

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${receiptTitle} – ${stay.code}</title>
<style>
  @page { margin: 0; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', -apple-system, Arial, sans-serif;
    color: #1a1a2e;
    margin: 1.5cm;
    line-height: 1.5;
    font-size: 13px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #e8731a;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .logo-block { display: flex; align-items: center; gap: 14px; }
  .logo { width: 90px; height: 90px; object-fit: contain; }
  .brand-name {
    font-size: 20px;
    font-weight: 700;
    color: #1a365d;
    line-height: 1.2;
  }
  .brand-sub { font-size: 11px; color: #4a5568; margin-top: 2px; }
  .receipt-title {
    font-size: 26px;
    font-weight: 800;
    color: #e8731a;
    text-align: right;
    letter-spacing: 1px;
  }
  .receipt-meta {
    font-size: 11px;
    color: #4a5568;
    text-align: right;
    margin-top: 4px;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }
  .info-box {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 16px;
  }
  .info-box.client { border-top: 3px solid #e8731a; }
  .info-box.hotel { border-top: 3px solid #1a365d; }
  .info-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #fff;
    padding: 3px 10px;
    border-radius: 3px;
    display: inline-block;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .info-label.orange { background: #e8731a; }
  .info-label.blue { background: #1a365d; }
  .info-value { font-size: 12px; line-height: 1.7; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 12px;
  }
  thead th {
    background: #1a365d;
    color: #fff;
    padding: 10px 12px;
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  thead th:last-child { text-align: right; }
  tbody td {
    padding: 10px 12px;
    border-bottom: 1px solid #e2e8f0;
  }
  tbody td:last-child { text-align: right; font-weight: 600; }
  tbody tr:nth-child(even) { background: #f7fafc; }
  .totals-section {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 20px;
  }
  .totals-box {
    width: 300px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 16px;
    font-size: 12px;
    border-bottom: 1px solid #e2e8f0;
  }
  .totals-row:last-child { border-bottom: none; }
  .totals-row.total-final {
    background: #e8731a;
    color: #fff;
    font-size: 16px;
    font-weight: 800;
    padding: 12px 16px;
  }
  .payment-method {
    font-size: 12px;
    margin-bottom: 20px;
    display: flex;
    gap: 32px;
  }
  .pm-item { display: flex; gap: 6px; align-items: center; }
  .pm-label { color: #4a5568; }
  .pm-value { font-weight: 600; }
  .conditions {
    font-size: 11px;
    color: #4a5568;
    margin-bottom: 24px;
    padding: 12px 16px;
    background: #f7fafc;
    border-radius: 6px;
    border-left: 3px solid #e8731a;
    line-height: 1.6;
  }
  .stamp-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px dashed #cbd5e0;
  }
  .stamp-box {
    width: 200px;
    text-align: center;
  }
  .stamp-border {
    border: 2px dashed #cbd5e0;
    border-radius: 8px;
    padding: 24px 16px 12px;
    min-height: 90px;
  }
  .stamp-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #4a5568;
    margin-top: 8px;
  }
  .footer {
    margin-top: 30px;
    padding-top: 14px;
    border-top: 2px solid #e8731a;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-logo { width: 50px; height: 50px; object-fit: contain; }
  .footer-text { font-size: 10px; color: #4a5568; text-align: right; line-height: 1.5; }
  .payment-history { margin-bottom: 16px; }
  .payment-history h3 { font-size: 13px; font-weight: 700; color: #1a365d; margin-bottom: 8px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<div class="header">
  <div class="logo-block">
    ${logoSrc ? `<img src="${logoSrc}" alt="Logo" class="logo" />` : ""}
    <div>
      <div class="brand-name">Résidences Les Chanaude</div>
    </div>
  </div>
  <div>
    <div class="receipt-title">${receiptTitle}</div>
    <div class="receipt-meta">
      N° ${receiptNum}<br/>
      Date: ${format(new Date(), "dd/MM/yyyy HH:mm")}<br/>
      Code séjour: <strong>${stay.code}</strong>
      ${stay.reservation?.reference ? `<br/>Réf. web: <strong>${stay.reservation.reference}</strong>` : ""}
    </div>
  </div>
</div>

<div class="info-grid">
  <div class="info-box client">
    <span class="info-label orange">Facturé à</span>
    <div class="info-value">
      <strong>${stay.client.firstName} ${stay.client.lastName}</strong><br/>
      Tél: ${stay.client.phone}<br/>
      ${stay.client.email ? `Email: ${stay.client.email}<br/>` : ""}
      Pièce: ${stay.client.documentNumber || "-"}
      ${stay.client.documentType ? ` • ${documentTypeLabels[stay.client.documentType] ?? stay.client.documentType}` : ""}
    </div>
  </div>
  <div class="info-box hotel">
    <span class="info-label blue">Facturé par</span>
    <div class="info-value">
      <strong>Résidences Les Chanaude</strong><br/>
      Abidjan, Côte d'Ivoire<br/>
      Source: ${sourceLabels[stay.source] ?? stay.source}<br/>
      Offre: ${offerLabels[stay.offer] ?? stay.offer}
    </div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Chambre / N°</th>
      <th>Nombre de nuits</th>
      <th>Prix / nuit</th>
      <th>Autres charges</th>
      <th>Total (FCFA)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>N° ${stay.chambre.numero} – ${stay.chambre.type}</td>
      <td>${nights}</td>
      <td>${fmtCurrency(pricePerNight)} FCFA</td>
      <td>—</td>
      <td>${fmtCurrency(stay.netAmount)} FCFA</td>
    </tr>
    ${stay.extensions.map((ext) => {
    const extNights = calculateNights(ext.startedAt, ext.endedAt);
    return `
    <tr>
      <td>Extension – ${offerLabels[ext.offer] ?? ext.offer}<br/><small>${format(new Date(ext.startedAt), "dd/MM")} au ${format(new Date(ext.endedAt), "dd/MM/yyyy")}</small></td>
      <td>${extNights}</td>
      <td>${fmtCurrency(pricePerNight)} FCFA</td>
      <td>—</td>
      <td>${fmtCurrency(ext.netAmount)} FCFA</td>
    </tr>`;
  }).join("")}
  </tbody>
</table>

<div class="totals-section">
  <div class="totals-box">
    <div class="totals-row"><span>Sous-total</span><span>${fmtCurrency(totalNet)} FCFA</span></div>
    <div class="totals-row"><span>Déjà encaissé</span><span>-${fmtCurrency(totalPaid)} FCFA</span></div>
    <div class="totals-row"><span>Reste dû</span><span>${fmtCurrency(totalBalance)} FCFA</span></div>
    <div class="totals-row total-final"><span>TOTAL</span><span>${fmtCurrency(totalNet)} FCFA</span></div>
  </div>
</div>

${paymentRows.length > 0 ? `
<div class="payment-history">
  <h3>${isFinal ? "Historique des paiements" : "Détail du versement"}</h3>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Mode</th>
        <th>Montant (FCFA)</th>
      </tr>
    </thead>
    <tbody>
      ${paymentRows.map((p) => `
      <tr>
        <td>${format(new Date(p.paidAt), "dd/MM/yyyy HH:mm")}</td>
        <td>${paymentTypeLabels[p.type] ?? p.type}</td>
        <td>${paymentMethodLabels[p.method] ?? p.method}</td>
        <td>${fmtCurrency(p.amount)} FCFA</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>
` : ""}

<div class="conditions">
  <strong>Modalités et conditions</strong><br/>
  Nous vous remercions de votre confiance. Cette facture fait foi de la transaction effectuée
  auprès de Résidences Les Chanaude. Veuillez conserver ce document pour toute réclamation.
  ${!isFinal ? "<br/><strong>Condition de réservation :</strong> l'acompte versé sert à garantir l'indisponibilité du logement pour autrui. En cas d'annulation, de désistement ou de non-présentation, cet acompte reste acquis à la résidence et aucun remboursement ne sera effectué." : ""}
  ${handledBy ? `<br/><strong>Traité par :</strong> ${handledBy}` : ""}
</div>

<div class="stamp-section">
  <div class="stamp-box">
    <div class="stamp-border"></div>
    <div class="stamp-label">Cachet de l'établissement</div>
  </div>
  <div class="stamp-box">
    <div class="stamp-border"></div>
    <div class="stamp-label">Signature autorisée</div>
  </div>
</div>

<div class="footer">
  ${logoSrc ? `<img src="${logoSrc}" alt="Logo" class="footer-logo" />` : ""}
  <div class="footer-text">
    <strong>Résidences Les Chanaude</strong><br/>
    Abidjan, Côte d'Ivoire<br/>
    © ${new Date().getFullYear()} — Tous droits réservés
  </div>
</div>

<style>
  .print-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #1a365d;
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 24px;
    font-family: 'Segoe UI', sans-serif;
    font-size: 14px;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .print-bar button {
    background: #e8731a;
    color: #fff;
    border: none;
    padding: 8px 24px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
  }
  .print-bar button:hover { opacity: 0.9; }
  @media print { .print-bar { display: none !important; } body { margin-top: 0 !important; } }
</style>
<div class="print-bar">
  <span>Aperçu de la facture — ${receiptTitle}</span>
  <button onclick="window.print()">🖨️ Imprimer</button>
</div>
<div style="height: 48px;"></div>

</body>
</html>`;
}
