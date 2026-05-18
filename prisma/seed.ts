import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPrismaAdapter } from "../src/lib/prisma-adapter";
import bcrypt from "bcryptjs";
import { addDays, startOfDay, subDays } from "date-fns";
import { applyDiscount, calculateOfferAmount } from "../src/lib/pricing";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

function withTime(base: Date, hours: number, minutes = 0) {
  const date = new Date(base);
  date.setHours(hours, minutes, 0, 0);
  return date;
}


function getSeedNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function pick<T>(items: readonly T[], index: number) {
  return items[index % items.length];
}

function padNumber(value: number, size = 4) {
  return String(value).padStart(size, "0");
}

function makeLoadDate(base: Date, dayOffset: number, hours = 14, minutes = 0) {
  const date = addDays(base, dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

async function createLoadDataset(baseRooms: Array<{ id: string; numero: string; categorie: string; prix: unknown }>, today: Date) {
  const clientCount = getSeedNumber("SEED_LOAD_CLIENTS", 300);
  const reservationCount = getSeedNumber("SEED_LOAD_RESERVATIONS", 160);
  const stayCount = getSeedNumber("SEED_LOAD_STAYS", 320);
  const extraRoomCount = getSeedNumber("SEED_LOAD_ROOMS", 90);

  const firstNames = ["Adele", "Bakary", "Celine", "Diane", "Eric", "Fanta", "Ghislain", "Hawa", "Ismael", "Jules", "Kady", "Landry", "Mireille", "Nadia", "Oumar", "Prisca", "Raissa", "Souleymane", "Therese", "Yacouba"];
  const lastNames = ["Amani", "Bamba", "Coulibaly", "Diaby", "Ehouman", "Fofana", "Gnahore", "Kassi", "Koffi", "Kone", "Kouame", "Kouassi", "Nguessan", "Ouattara", "Sangare", "Soro", "Toure", "Traore", "Yao", "Zadi"];
  const nationalities = ["Côte d'Ivoire", "Burkina Faso", "Mali", "Sénégal", "Ghana", "Guinée", "Togo", "Bénin"];
  const genders = ["homme", "femme", "autre"] as const;
  const paymentMethods = ["especes", "mobile_money", "carte", "virement"] as const;

  const extraRooms = Array.from({ length: extraRoomCount }, (_, index) => {
    const number = index + 1;
    const isVilla = number % 12 === 0;
    const isPremium = number % 3 === 0;
    const categorie = isVilla ? (number % 24 === 0 ? "villa_2ch" : "villa_1ch") : "standard";
    const prix = categorie === "villa_2ch" ? 150000 : categorie === "villa_1ch" ? 100000 : isPremium ? 40000 : 25000;
    return {
      numero: `L${padNumber(number, 3)}`,
      type: categorie === "villa_2ch" ? "Villa test 2 chambres" : categorie === "villa_1ch" ? "Villa test 1 chambre" : isPremium ? "Confort test" : "Standard test",
      categorie,
      prix,
      capacite: categorie === "villa_2ch" ? 5 : categorie === "villa_1ch" ? 3 : 2,
      description: "Chambre générée pour tests de charge.",
      status: number % 20 === 0 ? "maintenance" : "disponible",
    };
  });

  await prisma.chambre.createMany({ data: extraRooms as never[] });
  const loadRooms = await prisma.chambre.findMany({ where: { numero: { startsWith: "L" } }, orderBy: { numero: "asc" } });
  const usableRooms = [...baseRooms, ...loadRooms].filter((room) => String(room.categorie) !== "maintenance");
  const standardRooms = usableRooms.filter((room) => room.categorie === "standard");
  const villaOneRooms = usableRooms.filter((room) => room.categorie === "villa_1ch");
  const villaTwoRooms = usableRooms.filter((room) => room.categorie === "villa_2ch");

  const clientsData = Array.from({ length: clientCount }, (_, index) => ({
    firstName: pick(firstNames, index),
    lastName: pick(lastNames, index * 3),
    email: `load.client.${padNumber(index + 1, 5)}@example.com`,
    phone: `+22509${padNumber(index + 1, 8)}`,
    nationality: pick(nationalities, index),
    gender: pick(genders, index),
    documentNumber: index % 5 === 0 ? null : `LD-CNI-${padNumber(index + 1, 6)}`,
    documentType: index % 7 === 0 ? "passport" : "cni",
    birthDate: new Date(1980 + (index % 24), index % 12, (index % 26) + 1),
  }));

  await prisma.client.createMany({ data: clientsData as never[] });
  const loadClients = await prisma.client.findMany({ where: { phone: { startsWith: "+22509" } }, orderBy: { phone: "asc" } });

  const reservationStatuses = ["en_attente", "confirmee", "reportee", "refusee", "annulee"] as const;
  const reservationOffers = ["nuitee", "longue_duree", "villa_1ch", "villa_2ch"] as const;
  const reservationsData = Array.from({ length: reservationCount }, (_, index) => {
    const client = pick(loadClients, index);
    const status = pick(reservationStatuses, index);
    const startAt = makeLoadDate(today, 2 + (index % 45), 14);
    const endAt = makeLoadDate(startAt, 1 + (index % 5), 12);
    const requestedAdvanceAmount = status === "confirmee" ? (index % 4 === 0 ? 0 : 25000 + (index % 3) * 10000) : null;
    return {
      reference: `WEB_LOAD_${padNumber(index + 1, 5)}`,
      clientId: client.id,
      source: "web",
      workflowKind: "web",
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email ?? `load.${index + 1}@example.com`,
      phone: client.phone,
      nationality: client.nationality,
      gender: client.gender,
      guestCount: 1 + (index % 4),
      dateArrivee: startAt,
      dateDepart: endAt,
      dateArriveeOriginal: index % 8 === 0 ? makeLoadDate(today, 1 + (index % 45), 14) : startAt,
      dateDepartOriginal: index % 8 === 0 ? makeLoadDate(today, 2 + (index % 45), 12) : endAt,
      offer: pick(reservationOffers, index),
      notes: "Réservation générée pour test de charge.",
      requestedAdvanceAmount,
      requestedAdvanceNote: requestedAdvanceAmount ? "Avance demandée pour test de charge." : null,
      status,
      reportedAt: status === "reportee" ? new Date() : null,
    };
  });

  await prisma.reservation.createMany({ data: reservationsData as never[] });

  let paymentCreates = 0;
  let depositCreates = 0;
  let noteCreates = 0;

  for (let index = 0; index < stayCount; index += 1) {
    const client = pick(loadClients, index * 2);
    const status = index % 10 < 5 ? "termine" : index % 10 < 8 ? "planifie" : "en_cours";
    const workflowKind = pick(["direct", "comptoir", "appel", "web"] as const, index);
    const isVillaTwo = index % 17 === 0;
    const isVillaOne = !isVillaTwo && index % 13 === 0;
    const offer = isVillaTwo ? "villa_2ch" : isVillaOne ? "villa_1ch" : index % 6 === 0 ? "longue_duree" : "nuitee";
    const room = offer === "villa_2ch" ? pick(villaTwoRooms, index) : offer === "villa_1ch" ? pick(villaOneRooms, index) : pick(standardRooms, index);
    if (!room) continue;

    const dayOffset = status === "termine" ? -90 + (index % 70) : status === "en_cours" ? -(index % 3) : 1 + (index % 60);
    const startAt = makeLoadDate(today, dayOffset, status === "en_cours" ? 10 + (index % 8) : 14 + (index % 5), 0);
    const dayCount = offer === "nuitee" ? 1 + (index % 3) : 2 + (index % 8);
    const pricing = calculateOfferAmount({
      offer,
      startAt,
      dayCount,
      roomDailyRate: Number(room.prix),
    });
    const discountType = index % 19 === 0 ? "percent" : index % 23 === 0 ? "fixed" : "none";
    const discountValue = discountType === "percent" ? 10 : discountType === "fixed" ? 5000 : 0;
    const discountAmount = applyDiscount(pricing.baseAmount, discountType, discountValue);
    const netAmount = Math.max(0, pricing.baseAmount - discountAmount);
    const amountPaid = status === "termine" ? netAmount : status === "en_cours" ? Math.floor(netAmount * (index % 3 === 0 ? 1 : 0.45)) : index % 4 === 0 ? 0 : Math.min(netAmount, 20000 + (index % 5) * 10000);
    const paymentStatus = amountPaid >= netAmount ? "solde" : amountPaid <= 0 ? "en_attente_paiement" : "avance_versee";
    const codePrefix = workflowKind === "web" ? "WEB" : workflowKind === "appel" ? "APL" : workflowKind === "comptoir" ? "CPT" : "DIR";

    const stay = await prisma.sejour.create({
      data: {
        code: `${codePrefix}_LOAD_${padNumber(index + 1, 5)}`,
        clientId: client.id,
        chambreId: room.id,
        source: workflowKind === "web" ? "web" : "presence",
        workflowKind,
        status,
        offer,
        guestCount: 1 + (index % 4),
        plannedStartAt: startAt,
        plannedEndAt: pricing.normalizedEndAt,
        plannedStartAtOriginal: startAt,
        plannedEndAtOriginal: pricing.normalizedEndAt,
        startedAt: startAt,
        endedAt: pricing.normalizedEndAt,
        currentEndAt: pricing.normalizedEndAt,
        baseAmount: pricing.baseAmount,
        discountType,
        discountValue,
        discountAmount,
        netAmount,
        amountPaid,
        balanceDue: Math.max(0, netAmount - amountPaid),
        paymentArrangement: amountPaid >= netAmount ? "immediat" : amountPaid > 0 ? "avance_partielle" : "fin_sejour",
        paymentStatus,
        notes: status === "planifie" && workflowKind === "direct" ? "Pré-enregistrement généré à terminer." : "Séjour généré pour test de charge.",
        checkedInAt: status === "planifie" ? null : startAt,
        checkedOutAt: status === "termine" ? pricing.normalizedEndAt : null,
      },
    });

    if (amountPaid > 0) {
      await prisma.payment.create({
        data: {
          stayId: stay.id,
          paidAt: status === "planifie" ? makeLoadDate(today, -1, 10) : startAt,
          amount: amountPaid,
          method: pick(paymentMethods, index),
          type: amountPaid >= netAmount ? "solde" : "acompte",
          notes: "Paiement généré pour test de charge.",
        },
      });
      paymentCreates += 1;
    }

    if (offer === "villa_1ch" || offer === "villa_2ch") {
      await prisma.stayDeposit.create({
        data: {
          stayId: stay.id,
          type: "caution_villa",
          status: amountPaid > 0 ? "encaissee" : "en_attente",
          expectedAmount: 100000,
          heldAmount: amountPaid > 0 ? 100000 : 0,
          returnedAmount: 0,
          method: amountPaid > 0 ? pick(paymentMethods, index + 2) : null,
          notes: "Caution générée pour test de charge.",
          heldAt: amountPaid > 0 ? startAt : null,
        },
      });
      depositCreates += 1;
    }

    if (index % 6 === 0) {
      await prisma.clientNote.create({
        data: {
          clientId: client.id,
          stayId: stay.id,
          moment: index % 2 === 0 ? "avant" : "apres",
          rating: 3 + (index % 3),
          comment: "Note générée pour tester l'historique client.",
        },
      });
      noteCreates += 1;
    }
  }

  console.log(`Seed charge ajouté: ${loadRooms.length} chambres, ${loadClients.length} clients, ${reservationCount} réservations, ${stayCount} séjours, ${paymentCreates} paiements, ${depositCreates} cautions, ${noteCreates} notes.`);
}

async function resetBusinessData() {
  await prisma.auditLog.deleteMany();
  await prisma.clientNote.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.discountRequest.deleteMany();
  await prisma.stayDeposit.deleteMany();
  await prisma.stayExtension.deleteMany();
  await prisma.sejour.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();
  await prisma.chambre.deleteMany();
}

async function createStaffUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "admin" | "gerant";
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      roles: {
        create: {
          role: input.role,
        },
      },
    },
  });
}

async function main() {
  await resetBusinessData();

  const today = startOfDay(new Date());
  const yesterday = subDays(today, 1);
  const twoDaysAgo = subDays(today, 2);
  const tomorrow = addDays(today, 1);
  const inThreeDays = addDays(today, 3);
  const inFiveDays = addDays(today, 5);
  const inEightDays = addDays(today, 8);

  const staffCredentials = {
    admin1: {
      email: process.env.SEED_ADMIN1_EMAIL || "onix@chanaude.ci",
      password: process.env.SEED_ADMIN1_PASSWORD || "Admin123!",
    },
    admin2: {
      email: process.env.SEED_ADMIN2_EMAIL || "admin@chanaude.ci",
      password: process.env.SEED_ADMIN2_PASSWORD || "Admin123!",
    },
    gerant: {
      email: process.env.SEED_GERANT_EMAIL || "gerant@chanaude.ci",
      password: process.env.SEED_GERANT_PASSWORD || "ChanaudeGerant!2026",
    },
  };

  console.log(`[Seed] Admin 1 → ${staffCredentials.admin1.email} / ${staffCredentials.admin1.password}`);
  console.log(`[Seed] Admin 2 → ${staffCredentials.admin2.email} / ${staffCredentials.admin2.password}`);

  await createStaffUser({
    email: staffCredentials.admin1.email,
    password: staffCredentials.admin1.password,
    firstName: "Onix",
    lastName: "Dev",
    role: "admin",
  });

  await createStaffUser({
    email: staffCredentials.admin2.email,
    password: staffCredentials.admin2.password,
    firstName: "Awa",
    lastName: "Konan",
    role: "admin",
  });

  await createStaffUser({
    email: staffCredentials.gerant.email,
    password: staffCredentials.gerant.password,
    firstName: "Koffi",
    lastName: "Niamke",
    role: "gerant",
  });

  for (const gerant of [
    { email: "gerant1@chanaude.ci", firstName: "Aminata", lastName: "Bamba" },
    { email: "gerant2@chanaude.ci", firstName: "Serge", lastName: "Yao" },
    { email: "gerant3@chanaude.ci", firstName: "Clarisse", lastName: "Guei" },
    { email: "gerant4@chanaude.ci", firstName: "Moussa", lastName: "Diakite" },
  ]) {
    await createStaffUser({
      email: gerant.email,
      password: process.env.SEED_GERANT_PASSWORD || "ChanaudeGerant!2026",
      firstName: gerant.firstName,
      lastName: gerant.lastName,
      role: "gerant",
    });
  }

  const rooms = await Promise.all([
    prisma.chambre.create({
      data: {
        numero: "101",
        type: "Standard Jardin",
        categorie: "standard",
        prix: 25000,
        capacite: 2,
        description: "Chambre standard calme, proche du jardin.",
        status: "disponible",
      },
    }),
    prisma.chambre.create({
      data: {
        numero: "102",
        type: "Standard Terrasse",
        categorie: "standard",
        prix: 25000,
        capacite: 2,
        description: "Chambre standard avec coin terrasse.",
        status: "occupee",
      },
    }),
    prisma.chambre.create({
      data: {
        numero: "201",
        type: "Confort Balcon",
        categorie: "standard",
        prix: 40000,
        capacite: 2,
        description: "Chambre confort avec balcon et bureau.",
        status: "disponible",
      },
    }),
    prisma.chambre.create({
      data: {
        numero: "202",
        type: "Confort Premium",
        categorie: "standard",
        prix: 40000,
        capacite: 2,
        description: "Chambre premium en attente de nettoyage.",
        status: "attente_nettoyage",
      },
    }),
    prisma.chambre.create({
      data: {
        numero: "301",
        type: "Villa 1 chambre",
        categorie: "villa_1ch",
        prix: 100000,
        capacite: 3,
        description: "Villa 1 chambre avec salon et cuisine.",
        status: "maintenance",
      },
    }),
    prisma.chambre.create({
      data: {
        numero: "302",
        type: "Villa 2 chambres",
        categorie: "villa_2ch",
        prix: 150000,
        capacite: 5,
        description: "Grande villa familiale avec deux chambres.",
        status: "disponible",
      },
    }),
    prisma.chambre.create({
      data: { numero: "103", type: "Standard Patio", categorie: "standard", prix: 25000, capacite: 2, description: "Chambre standard côté patio.", status: "disponible" },
    }),
    prisma.chambre.create({
      data: { numero: "104", type: "Standard Bureau", categorie: "standard", prix: 25000, capacite: 2, description: "Chambre standard avec espace bureau.", status: "disponible" },
    }),
    prisma.chambre.create({
      data: { numero: "203", type: "Confort Salon", categorie: "standard", prix: 40000, capacite: 2, description: "Chambre confort avec coin salon.", status: "disponible" },
    }),
    prisma.chambre.create({
      data: { numero: "204", type: "Confort Vue cour", categorie: "standard", prix: 40000, capacite: 2, description: "Chambre confort côté cour.", status: "disponible" },
    }),
    prisma.chambre.create({
      data: { numero: "303", type: "Villa 2 chambres terrasse", categorie: "villa_2ch", prix: 150000, capacite: 5, description: "Villa familiale avec terrasse.", status: "disponible" },
    }),
  ]);

  const roomByNumber = Object.fromEntries(rooms.map((room) => [room.numero, room]));

  const clients = await Promise.all([
    prisma.client.create({
      data: {
        firstName: "Aya",
        lastName: "Kouadio",
        email: "aya.kouadio@example.com",
        phone: "+2250701000001",
        nationality: "Côte d'Ivoire",
        gender: "femme",
        documentNumber: "CI-2026-0001",
        documentType: "cni",
        birthDate: new Date("1997-05-10"),
      },
    }),
    prisma.client.create({
      data: {
        firstName: "Ibrahim",
        lastName: "Traore",
        email: "ibrahim.traore@example.com",
        phone: "+2250702000002",
        nationality: "Burkina Faso",
        gender: "homme",
        documentNumber: "BF-2026-0042",
        documentType: "passport",
        birthDate: new Date("1994-08-18"),
      },
    }),
    prisma.client.create({
      data: {
        firstName: "Mariam",
        lastName: "Kone",
        email: "mariam.kone@example.com",
        phone: "+2250703000003",
        nationality: "Mali",
        gender: "femme",
        documentNumber: "ML-2026-1130",
        documentType: "cni",
        birthDate: new Date("1991-11-02"),
      },
    }),
    prisma.client.create({
      data: {
        firstName: "Jean",
        lastName: "Mensah",
        email: "jean.mensah@example.com",
        phone: "+2250704000004",
        nationality: "Ghana",
        gender: "homme",
        documentNumber: "GH-2026-9001",
        documentType: "passport",
        birthDate: new Date("1989-03-14"),
      },
    }),
    prisma.client.create({
      data: { firstName: "Koffi", lastName: "Kan", email: "koffi.kan@example.com", phone: "+2250705000005", nationality: "Côte d'Ivoire", gender: "homme", documentNumber: "CI-2026-0048", documentType: "cni", birthDate: new Date("1990-02-10") },
    }),
    prisma.client.create({
      data: { firstName: "Fatou", lastName: "Diallo", email: "fatou.diallo@example.com", phone: "+2250706000006", nationality: "Guinée", gender: "femme", documentNumber: "GN-2026-0881", documentType: "passport", birthDate: new Date("1993-06-21") },
    }),
    prisma.client.create({
      data: { firstName: "Serge", lastName: "Adou", email: "serge.adou@example.com", phone: "+2250707000007", nationality: "Côte d'Ivoire", gender: "homme", documentNumber: "CI-2026-1022", documentType: "cni", birthDate: new Date("1988-12-03") },
    }),
    prisma.client.create({
      data: { firstName: "Clarisse", lastName: "Tano", email: "clarisse.tano@example.com", phone: "+2250708000008", nationality: "Côte d'Ivoire", gender: "femme", documentNumber: "CI-2026-1414", documentType: "cni", birthDate: new Date("1996-09-09") },
    }),
  ]);

  const clientByEmail = Object.fromEntries(clients.map((client) => [client.email ?? client.id, client]));

  const pendingReservation = await prisma.reservation.create({
    data: {
      reference: "WEB_260503_EN01AT",
      clientId: clientByEmail["aya.kouadio@example.com"].id,
      source: "web",
      workflowKind: "web",
      firstName: "Aya",
      lastName: "Kouadio",
      email: "aya.kouadio@example.com",
      phone: "+2250701000001",
      nationality: "Côte d'Ivoire",
      gender: "femme",
      guestCount: 2,
      dateArrivee: tomorrow,
      dateDepart: inThreeDays,
      dateArriveeOriginal: tomorrow,
      dateDepartOriginal: inFiveDays,
      offer: "nuitee",
      notes: "Demande web en attente d'appel et de validation.",
      status: "en_attente",
    },
  });

  const confirmedReservation = await prisma.reservation.create({
    data: {
      reference: "WEB_260503_CF01AC",
      clientId: clientByEmail["jean.mensah@example.com"].id,
      source: "web",
      workflowKind: "web",
      firstName: "Jean",
      lastName: "Mensah",
      email: "jean.mensah@example.com",
      phone: "+2250704000004",
      nationality: "Ghana",
      gender: "homme",
      guestCount: 3,
      dateArrivee: inFiveDays,
      dateDepart: inEightDays,
      dateArriveeOriginal: inFiveDays,
      dateDepartOriginal: inEightDays,
      offer: "villa_2ch",
      notes: "Réservation confirmée, acompte attendu au registre.",
      status: "confirmee",
    },
  });

  const convertedReservation = await prisma.reservation.create({
    data: {
      reference: "WEB_260503_CV01SE",
      clientId: clientByEmail["ibrahim.traore@example.com"].id,
      source: "web",
      workflowKind: "web",
      firstName: "Ibrahim",
      lastName: "Traore",
      email: "ibrahim.traore@example.com",
      phone: "+2250702000002",
      nationality: "Burkina Faso",
      gender: "homme",
      guestCount: 1,
      dateArrivee: tomorrow,
      dateDepart: inFiveDays,
      dateArriveeOriginal: tomorrow,
      dateDepartOriginal: inFiveDays,
      offer: "forfait_semaine",
      notes: "Réservation confirmée puis attribuée. Prête pour le tunnel d'arrivée.",
      status: "convertie",
    },
  });

  await prisma.reservation.create({
    data: {
      reference: "WEB_260503_RP01MV",
      source: "web",
      workflowKind: "web",
      firstName: "Aminata",
      lastName: "Sow",
      email: "aminata.sow@example.com",
      phone: "+2250705000005",
      nationality: "Sénégal",
      gender: "femme",
      guestCount: 2,
      dateArrivee: inThreeDays,
      dateDepart: inFiveDays,
      dateArriveeOriginal: tomorrow,
      dateDepartOriginal: inThreeDays,
      reportedAt: new Date(),
      offer: "nuitee",
      notes: "Demande reportée par le client après appel.",
      status: "reportee",
    },
  });

  const plannedStayPricing = calculateOfferAmount({
    offer: "forfait_semaine",
    startAt: withTime(tomorrow, 14),
    endAt: withTime(inFiveDays, 12),
    roomDailyRate: Number(roomByNumber["201"].prix),
  });
  const plannedStayDiscount = applyDiscount(plannedStayPricing.baseAmount, "fixed", 10000);
  const plannedStayNet = plannedStayPricing.baseAmount - plannedStayDiscount;

  const plannedWebStay = await prisma.sejour.create({
    data: {
      code: "WEB_260503_PLAN1",
      clientId: clientByEmail["ibrahim.traore@example.com"].id,
      chambreId: roomByNumber["201"].id,
      reservationId: convertedReservation.id,
      source: "web",
      workflowKind: "web",
      status: "planifie",
      offer: "forfait_semaine",
      guestCount: 1,
      plannedStartAt: withTime(tomorrow, 14),
      plannedEndAt: withTime(inFiveDays, 12),
      plannedStartAtOriginal: convertedReservation.dateArriveeOriginal ?? convertedReservation.dateArrivee ?? withTime(tomorrow, 14),
      plannedEndAtOriginal: convertedReservation.dateDepartOriginal ?? convertedReservation.dateDepart ?? withTime(inFiveDays, 12),
      startedAt: withTime(tomorrow, 14),
      endedAt: withTime(inFiveDays, 12),
      currentEndAt: withTime(inFiveDays, 12),
      baseAmount: plannedStayPricing.baseAmount,
      discountType: "fixed",
      discountValue: 10000,
      discountAmount: plannedStayDiscount,
      netAmount: plannedStayNet,
      amountPaid: 30000,
      balanceDue: plannedStayNet - 30000,
      paymentArrangement: "avance_partielle",
      paymentStatus: "avance_versee",
      notes: "Séjour web planifié avec acompte déjà reçu.",
    },
  });

  await prisma.payment.create({
    data: {
      stayId: plannedWebStay.id,
      paidAt: withTime(today, 9, 30),
      amount: 30000,
      method: "mobile_money",
      type: "acompte",
      notes: "Acompte versé après validation téléphonique.",
    },
  });

  const activeStayBase = calculateOfferAmount({
    offer: "nuitee",
    startAt: withTime(yesterday, 14),
    endAt: withTime(tomorrow, 12),
    roomDailyRate: Number(roomByNumber["102"].prix),
  });
  const activeStayDiscount = applyDiscount(activeStayBase.baseAmount, "percent", 10);
  const activeStayNet = activeStayBase.baseAmount - activeStayDiscount;

  const activeStay = await prisma.sejour.create({
    data: {
      code: "DIR_260503_LIVE1",
      clientId: clientByEmail["mariam.kone@example.com"].id,
      chambreId: roomByNumber["102"].id,
      source: "presence",
      workflowKind: "direct",
      status: "en_cours",
      offer: "nuitee",
      guestCount: 2,
      plannedStartAt: withTime(yesterday, 14),
      plannedEndAt: withTime(tomorrow, 12),
      plannedStartAtOriginal: withTime(yesterday, 14),
      plannedEndAtOriginal: withTime(tomorrow, 12),
      startedAt: withTime(yesterday, 14),
      endedAt: withTime(tomorrow, 12),
      currentEndAt: withTime(addDays(tomorrow, 1), 12),
      baseAmount: activeStayBase.baseAmount,
      discountType: "percent",
      discountValue: 10,
      discountAmount: activeStayDiscount,
      netAmount: activeStayNet,
      amountPaid: 25000,
      balanceDue: activeStayNet - 25000,
      paymentArrangement: "avance_partielle",
      paymentStatus: "avance_versee",
      notes: "Séjour direct en cours, prolongé au registre.",
      checkedInAt: withTime(yesterday, 14, 20),
    },
  });

  await prisma.payment.create({
    data: {
      stayId: activeStay.id,
      paidAt: withTime(yesterday, 14, 25),
      amount: 25000,
      method: "especes",
      type: "acompte",
      notes: "Premier encaissement à l'arrivée.",
    },
  });

  const activeExtensionBase = calculateOfferAmount({
    offer: "nuitee",
    startAt: withTime(tomorrow, 12),
    endAt: withTime(addDays(tomorrow, 1), 12),
    roomDailyRate: Number(roomByNumber["102"].prix),
  });

  const activeExtension = await prisma.stayExtension.create({
    data: {
      stayId: activeStay.id,
      startedAt: withTime(tomorrow, 12),
      endedAt: withTime(addDays(tomorrow, 1), 12),
      offer: "nuitee",
      baseAmount: activeExtensionBase.baseAmount,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      netAmount: activeExtensionBase.baseAmount,
      amountPaid: 10000,
      balanceDue: activeExtensionBase.baseAmount - 10000,
      paymentStatus: "avance_versee",
      notes: "Prolongation d'une nuit déjà entamée.",
    },
  });

  await prisma.payment.create({
    data: {
      stayId: activeStay.id,
      extensionId: activeExtension.id,
      paidAt: withTime(today, 8, 15),
      amount: 10000,
      method: "mobile_money",
      type: "partiel",
      notes: "Avance sur la prolongation.",
    },
  });

  await prisma.clientNote.createMany({
    data: [
      {
        clientId: activeStay.clientId,
        stayId: activeStay.id,
        moment: "avant",
        rating: 4,
        comment: "Cliente connue, demande une chambre calme et proche du parking.",
      },
      {
        clientId: activeStay.clientId,
        stayId: activeStay.id,
        moment: "apres",
        rating: 5,
        comment: "Historique positif sur les séjours précédents.",
      },
    ],
  });

  const completedStayBase = calculateOfferAmount({
    offer: "villa_1ch",
    startAt: withTime(twoDaysAgo, 15),
    endAt: withTime(yesterday, 12),
    roomDailyRate: Number(roomByNumber["202"].prix),
  });

  const completedStay = await prisma.sejour.create({
    data: {
      code: "DIR_260420_ARCH1",
      clientId: clientByEmail["aya.kouadio@example.com"].id,
      chambreId: roomByNumber["202"].id,
      source: "presence",
      workflowKind: "direct",
      status: "termine",
      offer: "villa_1ch",
      guestCount: 2,
      plannedStartAt: withTime(twoDaysAgo, 15),
      plannedEndAt: withTime(yesterday, 12),
      plannedStartAtOriginal: withTime(twoDaysAgo, 15),
      plannedEndAtOriginal: withTime(yesterday, 12),
      startedAt: withTime(twoDaysAgo, 15),
      endedAt: withTime(yesterday, 12),
      currentEndAt: withTime(yesterday, 12),
      baseAmount: completedStayBase.baseAmount,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      netAmount: completedStayBase.baseAmount,
      amountPaid: completedStayBase.baseAmount,
      balanceDue: 0,
      paymentArrangement: "immediat",
      paymentStatus: "solde",
      notes: "Séjour terminé, chambre en attente de ménage.",
      checkedInAt: withTime(twoDaysAgo, 15, 5),
      checkedOutAt: withTime(yesterday, 11, 50),
    },
  });

  await prisma.payment.create({
    data: {
      stayId: completedStay.id,
      paidAt: withTime(twoDaysAgo, 15, 10),
      amount: completedStayBase.baseAmount,
      method: "carte",
      type: "solde",
      notes: "Règlement complet à l'arrivée.",
    },
  });

  await prisma.clientNote.create({
    data: {
      clientId: completedStay.clientId,
      stayId: completedStay.id,
      moment: "apres",
      rating: 5,
      comment: "Chambre laissée propre, cliente à rappeler en priorité.",
    },
  });


  const callStayPricing = calculateOfferAmount({
    offer: "forfait_weekend",
    startAt: withTime(inFiveDays, 18),
    endAt: withTime(inEightDays, 12),
    roomDailyRate: Number(roomByNumber["203"].prix),
  });

  const callStay = await prisma.sejour.create({
    data: {
      code: "APL_260510_PLAN1",
      clientId: clientByEmail["fatou.diallo@example.com"].id,
      chambreId: roomByNumber["203"].id,
      source: "presence",
      workflowKind: "appel",
      status: "planifie",
      offer: "forfait_weekend",
      guestCount: 2,
      plannedStartAt: withTime(inFiveDays, 18),
      plannedEndAt: withTime(inEightDays, 12),
      plannedStartAtOriginal: withTime(inFiveDays, 18),
      plannedEndAtOriginal: withTime(inEightDays, 12),
      startedAt: withTime(inFiveDays, 18),
      endedAt: withTime(inEightDays, 12),
      currentEndAt: withTime(inEightDays, 12),
      baseAmount: callStayPricing.baseAmount,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      netAmount: callStayPricing.baseAmount,
      amountPaid: 20000,
      balanceDue: callStayPricing.baseAmount - 20000,
      paymentArrangement: "avance_partielle",
      paymentStatus: "avance_versee",
      notes: "Réservation prise par appel avec acompte transmis.",
    },
  });

  await prisma.payment.create({
    data: {
      stayId: callStay.id,
      paidAt: withTime(today, 10, 10),
      amount: 20000,
      method: "mobile_money",
      type: "acompte",
      notes: "Acompte sur réservation par appel.",
    },
  });

  const comptoirStayPricing = calculateOfferAmount({
    offer: "longue_duree",
    startAt: withTime(inThreeDays, 14),
    dayCount: 5,
    roomDailyRate: Number(roomByNumber["104"].prix),
  });

  await prisma.sejour.create({
    data: {
      code: "CPT_260510_PLAN1",
      clientId: clientByEmail["serge.adou@example.com"].id,
      chambreId: roomByNumber["104"].id,
      source: "presence",
      workflowKind: "comptoir",
      status: "planifie",
      offer: "longue_duree",
      guestCount: 1,
      plannedStartAt: withTime(inThreeDays, 14),
      plannedEndAt: comptoirStayPricing.normalizedEndAt,
      plannedStartAtOriginal: withTime(inThreeDays, 14),
      plannedEndAtOriginal: comptoirStayPricing.normalizedEndAt,
      startedAt: withTime(inThreeDays, 14),
      endedAt: comptoirStayPricing.normalizedEndAt,
      currentEndAt: comptoirStayPricing.normalizedEndAt,
      baseAmount: comptoirStayPricing.baseAmount,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      netAmount: comptoirStayPricing.baseAmount,
      amountPaid: 0,
      balanceDue: comptoirStayPricing.baseAmount,
      paymentArrangement: "fin_sejour",
      paymentStatus: "en_attente_paiement",
      notes: "Réservation faite au comptoir sans acompte.",
    },
  });

  await prisma.sejour.create({
    data: {
      code: "DIR_260510_PRE1",
      clientId: clientByEmail["koffi.kan@example.com"].id,
      chambreId: roomByNumber["103"].id,
      source: "presence",
      workflowKind: "direct",
      status: "planifie",
      offer: "nuitee",
      guestCount: 1,
      plannedStartAt: withTime(today, 17),
      plannedEndAt: withTime(tomorrow, 12),
      plannedStartAtOriginal: withTime(today, 17),
      plannedEndAtOriginal: withTime(tomorrow, 12),
      startedAt: withTime(today, 17),
      endedAt: withTime(tomorrow, 12),
      currentEndAt: withTime(tomorrow, 12),
      baseAmount: 30000,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      netAmount: 30000,
      amountPaid: 0,
      balanceDue: 30000,
      paymentArrangement: "fin_sejour",
      paymentStatus: "en_attente_paiement",
      notes: "Pré-enregistrement direct en attente de pièce et de remise de clé.",
    },
  });

  const activeVillaBase = calculateOfferAmount({
    offer: "villa_2ch",
    startAt: withTime(today, 15),
    dayCount: 2,
    roomDailyRate: Number(roomByNumber["303"].prix),
  });

  const activeVillaStay = await prisma.sejour.create({
    data: {
      code: "DIR_260510_VIL1",
      clientId: clientByEmail["clarisse.tano@example.com"].id,
      chambreId: roomByNumber["303"].id,
      source: "presence",
      workflowKind: "direct",
      status: "en_cours",
      offer: "villa_2ch",
      guestCount: 4,
      plannedStartAt: withTime(today, 15),
      plannedEndAt: activeVillaBase.normalizedEndAt,
      plannedStartAtOriginal: withTime(today, 15),
      plannedEndAtOriginal: activeVillaBase.normalizedEndAt,
      startedAt: withTime(today, 15),
      endedAt: activeVillaBase.normalizedEndAt,
      currentEndAt: activeVillaBase.normalizedEndAt,
      baseAmount: activeVillaBase.baseAmount,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      netAmount: activeVillaBase.baseAmount,
      amountPaid: 150000,
      balanceDue: activeVillaBase.baseAmount - 150000,
      paymentArrangement: "avance_partielle",
      paymentStatus: "avance_versee",
      notes: "Villa en cours avec caution encaissée.",
      checkedInAt: withTime(today, 15, 15),
    },
  });

  await prisma.payment.create({
    data: {
      stayId: activeVillaStay.id,
      paidAt: withTime(today, 15, 20),
      amount: 150000,
      method: "virement",
      type: "acompte",
      notes: "Premier versement villa.",
    },
  });

  await prisma.stayDeposit.create({
    data: {
      stayId: activeVillaStay.id,
      type: "caution_villa",
      status: "encaissee",
      expectedAmount: 100000,
      heldAmount: 100000,
      returnedAmount: 0,
      method: "especes",
      notes: "Caution complète encaissée à l'arrivée.",
      heldAt: withTime(today, 15, 25),
    },
  });

  await prisma.chambre.update({ where: { id: roomByNumber["303"].id }, data: { status: "occupee" } });

  if (["1", "true", "yes"].includes(String(process.env.SEED_LOAD ?? "").toLowerCase())) {
    await createLoadDataset(rooms, today);
  }

  console.log("Seed terminé.");
  console.log("Comptes de connexion:");
  console.log(`- Admin 1 : ${staffCredentials.admin1.email} / ${staffCredentials.admin1.password}`);
  console.log(`- Admin 2 : ${staffCredentials.admin2.email} / ${staffCredentials.admin2.password}`);
  console.log(`- Gérant  : ${staffCredentials.gerant.email} / ${staffCredentials.gerant.password}`);
  console.log(`- Réservations web: ${pendingReservation.reference}, ${confirmedReservation.reference}, ${convertedReservation.reference}`);
}

main()
  .catch((error) => {
    console.error("Seed échoué:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
