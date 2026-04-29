import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, validateBody } from "@/lib/api-utils";
import { findOrCreateClient } from "@/lib/client-utils";
import { sendReservationReceived, sendAdminNewReservation } from "@/lib/email";
import { smsReservationReceived, smsManagerNewReservation } from "@/lib/sms";

const schema = z
  .object({
    firstName: z.string().trim().min(2, "Prénom requis").max(50),
    lastName: z.string().trim().min(2, "Nom requis").max(50),
    email: z.string().trim().email("Email invalide").max(255),
    phone: z.string().trim().min(8, "Téléphone invalide").max(20),
    documentNumber: z.string().trim().min(4, "Pièce d'identité requise").max(30),
    dateArrivee: z.string().min(1, "Date d'arrivée requise"),
    dateDepart: z.string().min(1, "Date de départ requise"),
    offer: z.enum(["nuitee", "forfait", "passage", "villa_1ch", "villa_2ch", "longue_duree", "personnalise"]),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const arrival = new Date(data.dateArrivee);
    const departure = new Date(data.dateDepart);

    if (Number.isNaN(arrival.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateArrivee"],
        message: "Date d'arrivée invalide",
      });
    }

    if (Number.isNaN(departure.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateDepart"],
        message: "Date de départ invalide",
      });
    }

    if (!Number.isNaN(arrival.getTime()) && !Number.isNaN(departure.getTime()) && departure <= arrival) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateDepart"],
        message: "La date de départ doit être postérieure à la date d'arrivée",
      });
    }
  });

export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const data = validateBody(schema, body);

  const client = await findOrCreateClient(prisma, {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    documentNumber: data.documentNumber,
  });

  const reservation = await prisma.reservation.create({
    data: {
      clientId: client.id,
      source: "web",
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      documentNumber: data.documentNumber,
      dateArrivee: new Date(data.dateArrivee),
      dateDepart: new Date(data.dateDepart),
      offer: data.offer,
      notes: data.notes ?? null,
      status: "en_attente",
    },
  });

  sendReservationReceived(data.email, data.firstName, data.lastName).catch((error) =>
    console.error("Email send failed:", error)
  );
  smsReservationReceived(data.phone, data.firstName).catch((error) =>
    console.error("SMS client failed:", error)
  );
  smsManagerNewReservation(data.firstName, data.lastName).catch((error) =>
    console.error("SMS manager failed:", error)
  );
  sendAdminNewReservation(data.firstName, data.lastName, data.email, data.phone).catch((error) =>
    console.error("Admin email failed:", error)
  );

  return NextResponse.json(
    { ok: true, id: reservation.id, reference: reservation.reference },
    { status: 201 }
  );
});
