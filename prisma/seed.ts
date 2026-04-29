import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { applyDiscount, calculateOfferAmount } from "../src/lib/pricing";

const prisma = new PrismaClient();

async function upsertClient(input: {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  documentNumber?: string;
  documentType?: "cni" | "passport" | "titre_sejour" | "autre";
  birthDate?: string;
  age?: number;
}) {
  const existing = await prisma.client.findFirst({
    where: {
      OR: [
        input.documentNumber ? { documentNumber: input.documentNumber } : undefined,
        input.email ? { email: input.email } : undefined,
        { phone: input.phone },
      ].filter(Boolean) as any,
    },
  });

  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        documentNumber: input.documentNumber,
        documentType: input.documentType,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
        age: input.age ?? null,
      },
    });
  }

  return prisma.client.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      documentNumber: input.documentNumber,
      documentType: input.documentType,
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      age: input.age ?? null,
    },
  });
}

async function main() {
  const admins = [
    {
      email: process.env.SEED_ADMIN1_EMAIL || "onix@hotel.ci",
      password: process.env.SEED_ADMIN1_PASSWORD || "Admin123!",
      firstName: "Onix",
      lastName: "Dev",
      role: "admin" as const,
    },
    {
      email: process.env.SEED_ADMIN2_EMAIL || "admin@hotel.ci",
      password: process.env.SEED_ADMIN2_PASSWORD || "Admin123!",
      firstName: "Admin",
      lastName: "Manager",
      role: "manager" as const,
    },
  ];

  for (const admin of admins) {
    const passwordHash = await bcrypt.hash(admin.password, 12);
    const user = await prisma.user.upsert({
      where: { email: admin.email },
      update: { passwordHash, firstName: admin.firstName, lastName: admin.lastName },
      create: {
        email: admin.email,
        passwordHash,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role: admin.role } },
      update: {},
      create: { userId: user.id, role: admin.role },
    });
  }

  const chambres = [
    {
      numero: "101",
      type: "Standard",
      categorie: "standard" as const,
      prix: 25000,
      capacite: 1,
      description: "Chambre standard avec lit simple, climatisation et salle d'eau privée.",
      status: "disponible" as const,
    },
    {
      numero: "102",
      type: "Standard",
      categorie: "standard" as const,
      prix: 25000,
      capacite: 1,
      description: "Chambre standard confortable avec vue sur le jardin.",
      status: "disponible" as const,
    },
    {
      numero: "201",
      type: "Confort",
      categorie: "standard" as const,
      prix: 40000,
      capacite: 2,
      description: "Chambre double climatisée avec balcon et mini-réfrigérateur.",
      status: "disponible" as const,
    },
    {
      numero: "202",
      type: "Confort",
      categorie: "standard" as const,
      prix: 40000,
      capacite: 2,
      description: "Chambre double avec espace bureau et Wi-Fi haut débit.",
      status: "disponible" as const,
    },
    {
      numero: "301",
      type: "Villa 1 chambre",
      categorie: "villa_1ch" as const,
      prix: 100000,
      capacite: 3,
      description: "Villa autonome avec cuisine et salon.",
      status: "disponible" as const,
    },
    {
      numero: "302",
      type: "Villa 2 chambres",
      categorie: "villa_2ch" as const,
      prix: 150000,
      capacite: 4,
      description: "Villa de standing avec deux chambres, salon et cuisine.",
      status: "disponible" as const,
    },
  ];

  for (const chambre of chambres) {
    await prisma.chambre.upsert({
      where: { numero: chambre.numero },
      update: chambre,
      create: chambre,
    });
  }

  const aya = await upsertClient({
    firstName: "Aya",
    lastName: "Kouadio",
    email: "aya.kouadio@example.com",
    phone: "+2250701000001",
    documentNumber: "CI-20240001",
    documentType: "cni",
    birthDate: "1999-05-10",
    age: 26,
  });

  const ibrahim = await upsertClient({
    firstName: "Ibrahim",
    lastName: "Traore",
    email: "ibrahim.traore@example.com",
    phone: "+2250702000002",
    documentNumber: "CI-20240002",
    documentType: "cni",
    birthDate: "1997-08-18",
    age: 28,
  });

  const mariam = await upsertClient({
    firstName: "Mariam",
    lastName: "Kone",
    email: "mariam.kone@example.com",
    phone: "+2250703000003",
    documentNumber: "CI-20240003",
    documentType: "passport",
    birthDate: "1994-11-02",
    age: 31,
  });

  const webReservations = [
    {
      reference: "WEB-0001",
      clientId: aya.id,
      source: "web" as const,
      firstName: aya.firstName,
      lastName: aya.lastName,
      email: aya.email!,
      phone: aya.phone,
      documentNumber: aya.documentNumber,
      documentType: aya.documentType,
      birthDate: aya.birthDate,
      age: aya.age,
      dateArrivee: new Date("2026-05-05"),
      dateDepart: new Date("2026-05-08"),
      offer: "forfait" as const,
      notes: "Réservation site web en attente de validation.",
      status: "en_attente" as const,
    },
    {
      reference: "WEB-0002",
      clientId: ibrahim.id,
      source: "web" as const,
      firstName: ibrahim.firstName,
      lastName: ibrahim.lastName,
      email: ibrahim.email!,
      phone: ibrahim.phone,
      documentNumber: ibrahim.documentNumber,
      documentType: ibrahim.documentType,
      birthDate: ibrahim.birthDate,
      age: ibrahim.age,
      dateArrivee: new Date("2026-05-02"),
      dateDepart: new Date("2026-05-06"),
      offer: "nuitee" as const,
      notes: "Réservation web validée et convertie en séjour planifié.",
      status: "convertie" as const,
    },
    {
      reference: "WEB-0003",
      clientId: mariam.id,
      source: "web" as const,
      firstName: mariam.firstName,
      lastName: mariam.lastName,
      email: mariam.email!,
      phone: mariam.phone,
      documentNumber: mariam.documentNumber,
      documentType: mariam.documentType,
      birthDate: mariam.birthDate,
      age: mariam.age,
      dateArrivee: new Date("2026-05-10"),
      dateDepart: new Date("2026-05-11"),
      offer: "passage" as const,
      notes: "Réservation refusée pour démonstration.",
      status: "refusee" as const,
    },
  ];

  for (const reservation of webReservations) {
    await prisma.reservation.upsert({
      where: { reference: reservation.reference },
      update: reservation,
      create: reservation,
    });
  }

  const chambre201 = await prisma.chambre.findUniqueOrThrow({ where: { numero: "201" } });
  const chambre101 = await prisma.chambre.findUniqueOrThrow({ where: { numero: "101" } });
  const reservationWeb2 = await prisma.reservation.findUniqueOrThrow({ where: { reference: "WEB-0002" } });

  const webStayPricing = calculateOfferAmount({
    offer: "nuitee",
    startAt: new Date("2026-05-02T14:00:00.000Z"),
    endAt: new Date("2026-05-06T12:00:00.000Z"),
  });

  await prisma.sejour.upsert({
    where: { code: "SEJ-WEB-0002" },
    update: {
      clientId: ibrahim.id,
      chambreId: chambre201.id,
      reservationId: reservationWeb2.id,
      source: "web",
      status: "planifie",
      offer: "nuitee",
      startedAt: new Date("2026-05-02T14:00:00.000Z"),
      endedAt: new Date("2026-05-06T12:00:00.000Z"),
      currentEndAt: new Date("2026-05-06T12:00:00.000Z"),
      baseAmount: webStayPricing.baseAmount,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      netAmount: webStayPricing.baseAmount,
      amountPaid: 0,
      balanceDue: webStayPricing.baseAmount,
      paymentArrangement: "fin_sejour",
      paymentStatus: "en_attente_paiement",
      notes: "Séjour créé depuis une réservation web.",
    },
    create: {
      code: "SEJ-WEB-0002",
      clientId: ibrahim.id,
      chambreId: chambre201.id,
      reservationId: reservationWeb2.id,
      source: "web",
      status: "planifie",
      offer: "nuitee",
      startedAt: new Date("2026-05-02T14:00:00.000Z"),
      endedAt: new Date("2026-05-06T12:00:00.000Z"),
      currentEndAt: new Date("2026-05-06T12:00:00.000Z"),
      baseAmount: webStayPricing.baseAmount,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      netAmount: webStayPricing.baseAmount,
      amountPaid: 0,
      balanceDue: webStayPricing.baseAmount,
      paymentArrangement: "fin_sejour",
      paymentStatus: "en_attente_paiement",
      notes: "Séjour créé depuis une réservation web.",
    },
  });

  const directBase = calculateOfferAmount({
    offer: "villa_1ch",
    startAt: new Date("2026-04-26T14:00:00.000Z"),
    endAt: new Date("2026-04-28T12:00:00.000Z"),
  });
  const directDiscount = applyDiscount(directBase.baseAmount, "percent", 10);
  const directNet = directBase.baseAmount - directDiscount;

  const directStay = await prisma.sejour.upsert({
    where: { code: "SEJ-PRES-0001" },
    update: {
      clientId: mariam.id,
      chambreId: chambre101.id,
      source: "presence",
      status: "en_cours",
      offer: "longue_duree",
      startedAt: new Date("2026-04-26T14:00:00.000Z"),
      endedAt: new Date("2026-04-28T12:00:00.000Z"),
      currentEndAt: new Date("2026-04-30T12:00:00.000Z"),
      baseAmount: directBase.baseAmount,
      discountType: "percent",
      discountValue: 10,
      discountAmount: directDiscount,
      netAmount: directNet,
      amountPaid: 50000,
      balanceDue: directNet - 50000,
      paymentArrangement: "avance_partielle",
      paymentStatus: "avance_versee",
      notes: "Client arrivé en présence directe.",
      checkedInAt: new Date("2026-04-26T14:15:00.000Z"),
    },
    create: {
      code: "SEJ-PRES-0001",
      clientId: mariam.id,
      chambreId: chambre101.id,
      source: "presence",
      status: "en_cours",
      offer: "longue_duree",
      startedAt: new Date("2026-04-26T14:00:00.000Z"),
      endedAt: new Date("2026-04-28T12:00:00.000Z"),
      currentEndAt: new Date("2026-04-30T12:00:00.000Z"),
      baseAmount: directBase.baseAmount,
      discountType: "percent",
      discountValue: 10,
      discountAmount: directDiscount,
      netAmount: directNet,
      amountPaid: 50000,
      balanceDue: directNet - 50000,
      paymentArrangement: "avance_partielle",
      paymentStatus: "avance_versee",
      notes: "Client arrivé en présence directe.",
      checkedInAt: new Date("2026-04-26T14:15:00.000Z"),
    },
  });

  await prisma.payment.deleteMany({ where: { stayId: directStay.id } });
  await prisma.stayExtension.deleteMany({ where: { stayId: directStay.id } });
  await prisma.clientNote.deleteMany({ where: { stayId: directStay.id } });

  const extensionBase = calculateOfferAmount({
    offer: "villa_1ch",
    startAt: new Date("2026-04-28T12:00:00.000Z"),
    endAt: new Date("2026-04-30T12:00:00.000Z"),
  });

  const extension = await prisma.stayExtension.create({
    data: {
      stayId: directStay.id,
      startedAt: new Date("2026-04-28T12:00:00.000Z"),
      endedAt: new Date("2026-04-30T12:00:00.000Z"),
      offer: "villa_1ch",
      baseAmount: extensionBase.baseAmount,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      netAmount: extensionBase.baseAmount,
      amountPaid: 0,
      balanceDue: extensionBase.baseAmount,
      paymentStatus: "en_attente_paiement",
      notes: "Allongement de séjour enregistré séparément.",
    },
  });

  await prisma.payment.createMany({
    data: [
      {
        stayId: directStay.id,
        paidAt: new Date("2026-04-26T14:20:00.000Z"),
        amount: 50000,
        method: "mobile_money",
        type: "acompte",
        notes: "Acompte à l'arrivée.",
      },
      {
        stayId: directStay.id,
        extensionId: extension.id,
        paidAt: new Date("2026-04-28T11:30:00.000Z"),
        amount: 25000,
        method: "especes",
        type: "partiel",
        notes: "Paiement partiel de l'extension.",
      },
    ],
  });

  await prisma.clientNote.createMany({
    data: [
      {
        clientId: mariam.id,
        stayId: directStay.id,
        moment: "avant",
        rating: 4,
        comment: "Cliente connue, dossier complet.",
      },
      {
        clientId: mariam.id,
        stayId: directStay.id,
        moment: "apres",
        rating: 5,
        comment: "Séjour calme, bon comportement.",
      },
    ],
  });

  await prisma.chambre.updateMany({
    where: { numero: { in: ["101", "201"] } },
    data: { status: "occupee" },
  });

  await prisma.chambre.updateMany({
    where: { numero: { in: ["102", "202", "301", "302"] } },
    data: { status: "disponible" },
  });

  console.log("Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
