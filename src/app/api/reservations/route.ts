import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, validateBody } from "@/lib/api-utils";
import { sendReservationReceived, sendAdminNewReservation } from "@/lib/email";
import { smsReservationReceived, smsManagerNewReservation } from "@/lib/sms";

const schema = z.object({
  firstName: z.string().trim().min(2, "Prénom requis (2 caractères min)").max(50),
  lastName: z.string().trim().min(2, "Nom requis (2 caractères min)").max(50),
  email: z.string().trim().email("Email invalide").max(255),
  phone: z.string().trim().min(8, "Téléphone invalide (8 chiffres min)").max(20),
  idNumber: z.string().trim().min(4, "Pièce d'identité requise (4 caractères min)").max(30),
});

export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const data = validateBody(schema, body);

  const reservation = await prisma.reservation.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      notes: `Pièce: ${data.idNumber}`,
      status: "en_attente",
    },
  });

  // Send confirmation email (non-blocking)
  sendReservationReceived(data.email, data.firstName, data.lastName).catch((e) =>
    console.error("Email send failed:", e)
  );

  // SMS to client + manager (non-blocking)
  smsReservationReceived(data.phone, data.firstName).catch((e) =>
    console.error("SMS client failed:", e)
  );
  smsManagerNewReservation(data.firstName, data.lastName).catch((e) =>
    console.error("SMS manager failed:", e)
  );

  // Admin email notification (non-blocking)
  sendAdminNewReservation(data.firstName, data.lastName, data.email, data.phone).catch((e) =>
    console.error("Admin email failed:", e)
  );

  return NextResponse.json({ ok: true, id: reservation.id }, { status: 201 });
});
