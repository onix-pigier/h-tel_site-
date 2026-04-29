import nodemailer from "nodemailer";
import {
  templateReservationReceived,
  templateReservationAccepted,
  templateReservationRefused,
  templateAdminNewReservation,
} from "./email-templates";

// ─── Transporter ─────────────────────────────────────────────

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("⚠️  SMTP not configured — emails will be logged to console only.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const FROM = process.env.SMTP_FROM ?? "Résidences Chanaude <noreply@chanaude.ci>";

async function sendMail(to: string, subject: string, html: string) {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`📧 [EMAIL PREVIEW] To: ${to} | Subject: ${subject}`);
    console.log(html.replace(/<[^>]*>/g, "").slice(0, 300) + "...");
    return { success: true, preview: true };
  }

  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`✅ Email sent to ${to} — messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error);
    return { success: false, error };
  }
}

// ─── Public API ──────────────────────────────────────────────

export async function sendReservationReceived(
  to: string,
  firstName: string,
  lastName: string
) {
  return sendMail(
    to,
    "Résidences Chanaude — Votre demande de réservation a été reçue",
    templateReservationReceived(firstName, lastName)
  );
}

export async function sendReservationAccepted(
  to: string,
  firstName: string,
  lastName: string,
  chambreInfo?: { numero: string; type: string } | null
) {
  return sendMail(
    to,
    "Résidences Chanaude — Votre réservation est acceptée ! 🎉",
    templateReservationAccepted(firstName, lastName, chambreInfo)
  );
}

export async function sendReservationRefused(
  to: string,
  firstName: string,
  lastName: string
) {
  return sendMail(
    to,
    "Résidences Chanaude — Mise à jour de votre demande de réservation",
    templateReservationRefused(firstName, lastName)
  );
}

export async function sendAdminNewReservation(
  firstName: string,
  lastName: string,
  email: string,
  phone: string
) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.log(`📧 [ADMIN EMAIL — no ADMIN_EMAIL configured] New reservation from ${firstName} ${lastName}`);
    return { success: true, preview: true };
  }
  return sendMail(
    adminEmail,
    `Résidences Chanaude Admin — Nouvelle demande de réservation de ${firstName} ${lastName}`,
    templateAdminNewReservation(firstName, lastName, email, phone)
  );
}
