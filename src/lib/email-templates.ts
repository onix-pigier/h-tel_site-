const APP_BASE_URL = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
const ADMIN_AUTH_URL = `${APP_BASE_URL}/auth?callbackUrl=${encodeURIComponent("/admin/registre")}`;
const PROPERTY_NAME = "Résidences Les Chanaude";
const PROPERTY_LOCATION = "Mondoukou, Grand-Bassam";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraph(content: string) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#111827;">${content}</p>`;
}

function detailsBlock(rows: Array<{ label: string; value: string }>) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:18px 0;">
      ${rows
        .map(
          (row) => `
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;vertical-align:top;">${escapeHtml(row.label)}</td>
              <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;vertical-align:top;">${escapeHtml(row.value)}</td>
            </tr>
          `,
        )
        .join("")}
    </table>
  `;
}

function signature() {
  return `
    <p style="margin:22px 0 0;font-size:15px;line-height:1.7;color:#111827;">
      Cordialement,<br />
      L'équipe ${PROPERTY_NAME}
    </p>
  `;
}

function simpleLayout(options: { title: string; preheader: string; body: string }) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:24px;background:#ffffff;font-family:Arial,'Helvetica Neue',sans-serif;color:#111827;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
  <div style="max-width:640px;margin:0 auto;">
    <p style="margin:0 0 22px;font-size:14px;color:#6b7280;">${PROPERTY_NAME} • ${PROPERTY_LOCATION}</p>
    <h1 style="margin:0 0 24px;font-size:24px;line-height:1.3;color:#111827;">${escapeHtml(options.title)}</h1>
    ${options.body}
    <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#9ca3af;">
      Email automatique envoyé par ${PROPERTY_NAME}. Merci de ne pas répondre directement à ce message.
    </p>
  </div>
</body>
</html>`;
}

export function templateReservationReceived(firstName: string, lastName: string) {
  const fullName = `${escapeHtml(firstName)} ${escapeHtml(lastName)}`;

  return simpleLayout({
    title: "Demande de réservation reçue",
    preheader: "Votre demande a bien été enregistrée.",
    body: `
      ${paragraph(`Bonjour ${fullName},`)}
      ${paragraph("Nous avons bien reçu votre demande de réservation.")}
      ${paragraph("Notre équipe prépare actuellement votre séjour et revient vers vous très rapidement avec la suite utile.")}
      ${paragraph("Aucune action supplémentaire n'est nécessaire pour le moment.")}
      ${signature()}
    `,
  });
}

export function templateReservationAccepted(
  firstName: string,
  lastName: string,
  chambreInfo?: { numero: string; type: string } | null,
) {
  const fullName = `${escapeHtml(firstName)} ${escapeHtml(lastName)}`;
  const roomDetails = chambreInfo
    ? detailsBlock([
        { label: "Chambre", value: `N° ${chambreInfo.numero}` },
        { label: "Catégorie", value: chambreInfo.type },
      ])
    : "";

  return simpleLayout({
    title: "Réservation confirmée",
    preheader: "Votre réservation est confirmée.",
    body: `
      ${paragraph(`Bonjour ${fullName},`)}
      ${paragraph("Votre réservation est bien confirmée.")}
      ${paragraph("Nous poursuivons la préparation de votre arrivée et restons disponibles si vous devez ajuster un élément de votre séjour.")}
      ${roomDetails}
      ${paragraph("Merci de conserver vos justificatifs et de rester joignable sur le numéro communiqué.")}
      ${signature()}
    `,
  });
}

export function templateReservationRefused(firstName: string, lastName: string) {
  const fullName = `${escapeHtml(firstName)} ${escapeHtml(lastName)}`;

  return simpleLayout({
    title: "Mise à jour de votre demande",
    preheader: "Nous revenons vers vous au sujet de votre demande.",
    body: `
      ${paragraph(`Bonjour ${fullName},`)}
      ${paragraph("Nous ne disposons malheureusement plus de disponibilité adaptée pour les dates souhaitées à ce stade.")}
      ${paragraph("Si vous le souhaitez, vous pourrez revenir vers nous avec d'autres dates ou une autre formule de séjour.")}
      ${signature()}
    `,
  });
}

export function templateAdminNewReservation(firstName: string, lastName: string, email: string, phone: string) {
  return simpleLayout({
    title: "Nouvelle demande de réservation",
    preheader: "Une nouvelle demande web attend une prise en charge.",
    body: `
      ${paragraph("Une nouvelle réservation vient d'être envoyée depuis le site public.")}
      ${detailsBlock([
        { label: "Nom complet", value: `${firstName} ${lastName}` },
        { label: "Email", value: email },
        { label: "Téléphone", value: phone },
      ])}
      ${paragraph(`Ouvrir le registre : ${ADMIN_AUTH_URL}`)}
      <p style="margin:22px 0 0;font-size:15px;line-height:1.7;color:#111827;">Système ${PROPERTY_NAME}</p>
    `,
  });
}

export function templateStayReminder(firstName: string, stayLabel: string) {
  return simpleLayout({
    title: "Rappel d'arrivée",
    preheader: "Votre arrivée approche.",
    body: `
      ${paragraph(`Bonjour ${escapeHtml(firstName)},`)}
      ${paragraph(`Nous vous rappelons votre arrivée prévue ${escapeHtml(stayLabel)} au sein des ${PROPERTY_NAME}.`)}
      ${paragraph("Si votre programme a changé, merci de prévenir la résidence afin que l'accueil soit ajusté dans de bonnes conditions.")}
      ${signature()}
    `,
  });
}
