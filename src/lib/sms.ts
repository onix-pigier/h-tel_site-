/**
 * SMS Service — Abstract layer ready for Twilio, Vonage, etc.
 *
 * When SMS_PROVIDER is not configured, messages are logged to console.
 * To enable real SMS, set environment variables and implement the provider.
 */

interface SmsResult {
  success: boolean;
  preview?: boolean;
  error?: unknown;
}

async function sendSms(to: string, message: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER;

  if (!provider) {
    console.log(` [SMS PREVIEW] To: ${to}`);
    console.log(`   Message: ${message}`);
    return { success: true, preview: true };
  }

  // ─── Twilio implementation (uncomment when ready) ──────
  // if (provider === "twilio") {
  //   const accountSid = process.env.SMS_ACCOUNT_SID!;
  //   const authToken = process.env.SMS_AUTH_TOKEN!;
  //   const from = process.env.SMS_FROM_NUMBER!;
  //   const client = require("twilio")(accountSid, authToken);
  //   try {
  //     const result = await client.messages.create({ body: message, from, to });
  //     console.log(` SMS sent to ${to} — SID: ${result.sid}`);
  //     return { success: true };
  //   } catch (error) {
  //     console.error(` SMS failed to ${to}:`, error);
  //     return { success: false, error };
  //   }
  // }

  console.warn(`⚠️  Unknown SMS provider: ${provider}`);
  return { success: false, error: "Unknown provider" };
}

// ─── Public API ──────────────────────────────────────────────

export async function smsReservationReceived(clientPhone: string, firstName: string) {
  const message = `Résidences Chanaude — Bonjour ${firstName}, votre demande de réservation a bien été reçue. Notre équipe l'examine et vous répondra sous 24-48h. Merci de votre confiance !`;
  return sendSms(clientPhone, message);
}

export async function smsReservationAccepted(
  clientPhone: string,
  firstName: string,
  chambreNumero?: string
) {
  const chambreText = chambreNumero ? ` Chambre N°${chambreNumero} attribuée.` : "";
  const message = `Résidences Chanaude — Félicitations ${firstName} ! 🎉 Votre réservation est acceptée.${chambreText} Nous avons hâte de vous accueillir. Consultez votre email pour les détails.`;
  return sendSms(clientPhone, message);
}

export async function smsReservationRefused(clientPhone: string, firstName: string) {
  const message = `Résidences Chanaude — Bonjour ${firstName}, après examen de votre dossier, nous ne pouvons malheureusement pas donner suite à votre demande. N'hésitez pas à nous recontacter. Cordialement, L'équipe Résidences Chanaude.`;
  return sendSms(clientPhone, message);
}

export async function smsNotifyManager(message: string) {
  const managerPhone = process.env.MANAGER_PHONE;
  if (!managerPhone) {
    console.log(`📱 [SMS MANAGER — no phone configured] ${message}`);
    return { success: true, preview: true };
  }
  return sendSms(managerPhone, message);
}

/** Notify manager of a new reservation */
export async function smsManagerNewReservation(firstName: string, lastName: string) {
  return smsNotifyManager(
    `Résidences Chanaude Admin — Nouvelle demande de réservation de ${firstName} ${lastName}. Connectez-vous au tableau de bord pour la traiter.`
  );
}

/** Notify manager that a reservation has been processed */
export async function smsManagerReservationProcessed(
  firstName: string,
  lastName: string,
  status: "acceptée" | "refusée"
) {
  return smsNotifyManager(
    `Résidences Chanaude Admin — La réservation de ${firstName} ${lastName} a été ${status}. Le client a été notifié par email et SMS.`
  );
}
