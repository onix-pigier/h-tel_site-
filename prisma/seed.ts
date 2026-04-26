import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ─── 1. Admin Users ─────────────────────────────────────────
  const admins = [
    {
      email: process.env.SEED_ADMIN1_EMAIL || "onix@Hôtel.ci",
      password: process.env.SEED_ADMIN1_PASSWORD || "Admin123!",
      firstName: "Onix",
      lastName: "Dev",
      role: "admin" as const,
    },
    {
      email: process.env.SEED_ADMIN2_EMAIL || "admin@Hôtel.ci",
      password: process.env.SEED_ADMIN2_PASSWORD || "Admin123!",
      firstName: "Admin",
      lastName: "Test",
      role: "manager" as const,
    },
  ];

  for (const admin of admins) {
    const passwordHash = await bcrypt.hash(admin.password, 12);

    const user = await prisma.user.upsert({
      where: { email: admin.email },
      update: { passwordHash, firstName: admin.firstName, lastName: admin.lastName },
      create: { email: admin.email, passwordHash, firstName: admin.firstName, lastName: admin.lastName },
    });

    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role: admin.role } },
      update: {},
      create: { userId: user.id, role: admin.role },
    });

    console.log(`✅ Admin seeded: ${admin.email} (${admin.role})`);
  }

  // ─── 2. Chambres ────────────────────────────────────────────
  const chambres = [
    { numero: "101", type: "Standard", prix: 25000, capacite: 1, description: "Chambre standard avec lit simple, climatisation et salle d'eau privée.", status: "disponible" as const },
    { numero: "102", type: "Standard", prix: 25000, capacite: 1, description: "Chambre standard confortable avec vue sur le jardin.", status: "disponible" as const },
    { numero: "201", type: "Confort", prix: 40000, capacite: 2, description: "Chambre double climatisée avec balcon et mini-réfrigérateur.", status: "disponible" as const },
    { numero: "202", type: "Confort", prix: 40000, capacite: 2, description: "Chambre double avec espace bureau et Wi-Fi haut débit.", status: "disponible" as const },
    { numero: "301", type: "Suite", prix: 65000, capacite: 3, description: "Suite premium avec salon séparé, kitchenette et terrasse privée.", status: "disponible" as const },
    { numero: "302", type: "Duplex", prix: 85000, capacite: 4, description: "Duplex de standing avec deux chambres, salon et vue panoramique.", status: "maintenance" as const },
  ];

  for (const ch of chambres) {
    await prisma.chambre.upsert({
      where: { numero: ch.numero },
      update: { type: ch.type, prix: ch.prix, capacite: ch.capacite, description: ch.description, status: ch.status },
      create: ch,
    });
  }
  console.log(`✅ ${chambres.length} chambres seeded`);

  // ─── 3. Reservations ────────────────────────────────────────
  const reservations = [
    { firstName: "Kouadio", lastName: "Aya", email: "aya.kouadio@example.com", phone: "+2250701000001", notes: "Pièce: CI-20240001", status: "en_attente" as const },
    { firstName: "Traoré", lastName: "Ibrahim", email: "ibrahim.traore@example.com", phone: "+2250702000002", notes: "Pièce: CI-20240002", status: "en_attente" as const },
    { firstName: "Koné", lastName: "Mariam", email: "mariam.kone@example.com", phone: "+2250703000003", notes: "Pièce: CI-20240003", status: "acceptee" as const },
    { firstName: "N'Guessan", lastName: "Jean", email: "jean.nguessan@example.com", phone: "+2250704000004", notes: "Pièce: CI-20240004", status: "acceptee" as const },
    { firstName: "Bamba", lastName: "Fatoumata", email: "fatoumata.bamba@example.com", phone: "+2250705000005", notes: "Pièce: CI-20240005", status: "refusee" as const },
  ];

  const createdReservations = [];
  for (const r of reservations) {
    const reservation = await prisma.reservation.create({ data: r });
    createdReservations.push(reservation);
  }
  console.log(`✅ ${reservations.length} reservations seeded`);

  // ─── 4. Attributions (accepted reservations → rooms) ───────
  const acceptedReservations = createdReservations.filter((r) => r.status === "acceptee");
  const availableChambres = await prisma.chambre.findMany({
    where: { status: "disponible" },
    take: acceptedReservations.length,
  });

  for (let i = 0; i < Math.min(acceptedReservations.length, availableChambres.length); i++) {
    await prisma.attribution.create({
      data: {
        reservationId: acceptedReservations[i].id,
        chambreId: availableChambres[i].id,
        checkIn: new Date(),
      },
    });

    await prisma.chambre.update({
      where: { id: availableChambres[i].id },
      data: { status: "occupee" },
    });
  }
  console.log(`✅ ${Math.min(acceptedReservations.length, availableChambres.length)} attributions seeded`);

  console.log("\n🎉 Seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
