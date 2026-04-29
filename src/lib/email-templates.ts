/**
 * Email templates HTML premium — Branding Résidences Chanaude (Orange & Blue)
 */

const baseStyle = `
  font-family: 'Helvetica Neue', Arial, sans-serif;
  background-color: #fdf6f0;
  margin: 0;
  padding: 0;
`;

const cardStyle = `
  max-width: 600px;
  margin: 40px auto;
  background: #ffffff;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 20px 60px -20px rgba(25, 50, 80, 0.15);
`;

const headerStyle = `
  background: linear-gradient(135deg, #1a3a5c 0%, #2a5580 40%, #e86e24 100%);
  padding: 48px 40px;
  text-align: center;
`;

const logoStyle = `
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #e86e24, #f5a623);
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
`;

const bodyStyle = `
  padding: 40px;
`;

const footerStyle = `
  padding: 24px 40px;
  background: #fdf9f5;
  text-align: center;
  border-top: 1px solid #f0e8e0;
`;

function layout(title: string, body: string) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="${baseStyle}">
  <div style="${cardStyle}">
    <div style="${headerStyle}">
      <div style="${logoStyle}">
        <span style="font-family: 'Georgia', serif; font-weight: bold; color: white; font-size: 24px;">C</span>
      </div>
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0; letter-spacing: -0.5px;">
        ${title}
      </h1>
    </div>
    <div style="${bodyStyle}">
      ${body}
    </div>
    <div style="${footerStyle}">
      <p style="color: #7a8a9e; font-size: 13px; margin: 0 0 8px;">
        Les Résidences Chanaude Mondoukou
      </p>
      <p style="color: #a0aec0; font-size: 12px; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Template : Demande reçue ────────────────────────────────

export function templateReservationReceived(firstName: string, lastName: string) {
  const body = `
    <h2 style="color: #1a3a5c; font-size: 22px; font-weight: 600; margin: 0 0 16px;">
      Bonjour ${firstName} ${lastName},
    </h2>
    <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
      Nous avons bien reçu votre demande de réservation aux <strong>Résidences Chanaude</strong>.
      Notre équipe examine votre dossier avec la plus grande attention.
    </p>
    <div style="background: linear-gradient(135deg, #fdf2e9, #fef0e0); border-radius: 16px; padding: 24px; margin: 24px 0;">
      <p style="color: #e86e24; font-size: 14px; font-weight: 600; margin: 0 0 8px;">
        Statut de votre demande
      </p>
      <p style="color: #1a3a5c; font-size: 18px; font-weight: 700; margin: 0;">
        En cours d'examen
      </p>
      <p style="color: #7a8a9e; font-size: 13px; margin: 8px 0 0;">
        Vous recevrez une réponse sous 24 à 48 heures ouvrées.
      </p>
    </div>
    <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 8px;">
      En attendant, n'hésitez pas à nous contacter pour toute question.
    </p>
    <p style="color: #7a8a9e; font-size: 14px; margin: 24px 0 0;">
      Cordialement,<br />
      <strong style="color: #1a3a5c;">L'équipe Résidences Chanaude</strong>
    </p>
  `;
  return layout("Demande de réservation reçue", body);
}

// ─── Template : Réservation acceptée ─────────────────────────

export function templateReservationAccepted(
  firstName: string,
  lastName: string,
  chambreInfo?: { numero: string; type: string } | null
) {
  const chambreDetail = chambreInfo
    ? `
    <div style="background: linear-gradient(135deg, #fdf2e9, #fef0e0); border-radius: 16px; padding: 24px; margin: 24px 0;">
      <p style="color: #e86e24; font-size: 14px; font-weight: 600; margin: 0 0 8px;">
        🏨 Votre résidence
      </p>
      <p style="color: #1a3a5c; font-size: 18px; font-weight: 700; margin: 0;">
        Chambre N° ${chambreInfo.numero} — ${chambreInfo.type}
      </p>
      <p style="color: #7a8a9e; font-size: 13px; margin: 8px 0 0;">
        Les détails complets vous seront communiqués à votre arrivée.
      </p>
    </div>`
    : "";

  const body = `
    <h2 style="color: #1a3a5c; font-size: 22px; font-weight: 600; margin: 0 0 16px;">
      Félicitations ${firstName} ${lastName} ! 🎉
    </h2>
    <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
      Nous avons le plaisir de vous informer que votre demande de réservation
      aux <strong>Résidences Chanaude</strong> a été <strong style="color: #059669;">acceptée</strong>.
    </p>
    <div style="background: linear-gradient(135deg, #e6faf5, #d4f5ec); border-radius: 16px; padding: 24px; margin: 24px 0;">
      <p style="color: #059669; font-size: 14px; font-weight: 600; margin: 0 0 8px;">
        ✅ Statut de votre réservation
      </p>
      <p style="color: #1a3a5c; font-size: 18px; font-weight: 700; margin: 0;">
        Acceptée
      </p>
    </div>
    ${chambreDetail}
    <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 8px;">
      Bienvenue aux Résidences Chanaude. Nous nous réjouissons de vous accueillir
      et de vous offrir une expérience résidentielle d'exception.
    </p>
    <p style="color: #7a8a9e; font-size: 14px; margin: 24px 0 0;">
      Cordialement,<br />
      <strong style="color: #1a3a5c;">L'équipe Résidences Chanaude</strong>
    </p>
  `;
  return layout("Réservation acceptée", body);
}

// ─── Template : Réservation refusée ──────────────────────────

export function templateReservationRefused(firstName: string, lastName: string) {
  const body = `
    <h2 style="color: #1a3a5c; font-size: 22px; font-weight: 600; margin: 0 0 16px;">
      Bonjour ${firstName} ${lastName},
    </h2>
    <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
      Nous vous remercions pour l'intérêt que vous portez aux <strong>Résidences Chanaude</strong>.
      Après examen attentif de votre dossier, nous sommes au regret de vous informer
      que nous ne sommes pas en mesure de donner suite à votre demande pour le moment.
    </p>
    <div style="background: linear-gradient(135deg, #fef2f2, #fee2e2); border-radius: 16px; padding: 24px; margin: 24px 0;">
      <p style="color: #dc2626; font-size: 14px; font-weight: 600; margin: 0 0 8px;">
        ❌ Statut de votre réservation
      </p>
      <p style="color: #1a3a5c; font-size: 18px; font-weight: 700; margin: 0;">
        Non retenue
      </p>
    </div>
    <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 8px;">
      Cette décision ne remet pas en cause la qualité de votre candidature.
      Nous vous invitons à soumettre une nouvelle demande ultérieurement,
      sous réserve de disponibilité.
    </p>
    <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 8px;">
      Pour toute question, notre équipe reste à votre disposition.
    </p>
    <p style="color: #7a8a9e; font-size: 14px; margin: 24px 0 0;">
      Cordialement,<br />
      <strong style="color: #1a3a5c;">L'équipe Résidences Chanaude</strong>
    </p>
  `;
  return layout("Mise à jour de votre demande", body);
}

// ─── Template : Notification admin — nouvelle réservation ────

export function templateAdminNewReservation(
  firstName: string,
  lastName: string,
  email: string,
  phone: string
) {
  const body = `
    <h2 style="color: #1a3a5c; font-size: 22px; font-weight: 600; margin: 0 0 16px;">
      Nouvelle demande de réservation
    </h2>
    <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
      Un nouveau client vient de soumettre une demande de réservation sur <strong>Résidences Chanaude</strong>.
      Connectez-vous au tableau de bord pour l'examiner.
    </p>
    <div style="background: linear-gradient(135deg, #fdf2e9, #fef0e0); border-radius: 16px; padding: 24px; margin: 24px 0;">
      <p style="color: #e86e24; font-size: 14px; font-weight: 600; margin: 0 0 12px;">
        👤 Informations client
      </p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #7a8a9e; font-size: 13px; padding: 4px 0;">Nom complet</td>
          <td style="color: #1a3a5c; font-size: 14px; font-weight: 600; padding: 4px 0; text-align: right;">${firstName} ${lastName}</td>
        </tr>
        <tr>
          <td style="color: #7a8a9e; font-size: 13px; padding: 4px 0;">Email</td>
          <td style="color: #1a3a5c; font-size: 14px; padding: 4px 0; text-align: right;">${email}</td>
        </tr>
        <tr>
          <td style="color: #7a8a9e; font-size: 13px; padding: 4px 0;">Téléphone</td>
          <td style="color: #1a3a5c; font-size: 14px; padding: 4px 0; text-align: right;">${phone}</td>
        </tr>
      </table>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin"
         style="display: inline-block; background: linear-gradient(135deg, #e86e24, #f5a623); color: #fff; font-size: 14px; font-weight: 600; padding: 14px 32px; border-radius: 12px; text-decoration: none;">
        Voir le tableau de bord →
      </a>
    </div>
    <p style="color: #7a8a9e; font-size: 14px; margin: 24px 0 0;">
      Cordialement,<br />
      <strong style="color: #1a3a5c;">Système Résidences Chanaude</strong>
    </p>
  `;
  return layout("Nouvelle demande de réservation", body);
}
