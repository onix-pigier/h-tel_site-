import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-utils";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export async function findOrCreateClient(
  prisma: PrismaClientLike,
  input: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone: string;
    nationality?: string | null;
    gender?: "homme" | "femme" | "autre" | null;
    documentNumber?: string | null;
    documentType?: "cni" | "passport" | "titre_sejour" | "autre" | null;
    birthDate?: Date | null;
  }
) {
  const identifiers: Prisma.ClientWhereInput[] = [];
  if (input.documentNumber) identifiers.push({ documentNumber: input.documentNumber });
  if (input.email) identifiers.push({ email: input.email });
  if (input.phone) identifiers.push({ phone: input.phone });

  const matches =
    identifiers.length > 0
      ? await prisma.client.findMany({
          where: {
            OR: identifiers,
          },
        })
      : [];

  const documentMatch = input.documentNumber
    ? matches.find((client) => client.documentNumber === input.documentNumber) ?? null
    : null;
  const emailMatch = input.email
    ? matches.find((client) => client.email === input.email) ?? null
    : null;
  const phoneMatch = matches.find((client) => client.phone === input.phone) ?? null;

  const strongMatches = [documentMatch, emailMatch].filter(Boolean);
  const uniqueStrongMatchIds = [...new Set(strongMatches.map((client) => client!.id))];

  if (uniqueStrongMatchIds.length > 1) {
    throw new ApiError(
      409,
      "Conflit d'identité client: l'email et le numéro de pièce correspondent à des dossiers différents."
    );
  }

  const match =
    documentMatch ??
    emailMatch ??
    (!documentMatch && !emailMatch ? phoneMatch : null);

  if (match) {
    if (input.documentNumber && match.documentNumber && match.documentNumber !== input.documentNumber) {
      throw new ApiError(409, "Le numéro de pièce fourni ne correspond pas au dossier client trouvé.");
    }

    if (input.email && match.email && match.email !== input.email) {
      throw new ApiError(409, "L'email fourni ne correspond pas au dossier client trouvé.");
    }

    return prisma.client.update({
      where: { id: match.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? match.email ?? null,
        phone: input.phone,
        nationality: input.nationality ?? match.nationality ?? null,
        gender: input.gender ?? match.gender ?? null,
        documentNumber: input.documentNumber ?? match.documentNumber ?? null,
        documentType: input.documentType ?? match.documentType ?? null,
        birthDate: input.birthDate ?? match.birthDate ?? null,
      },
    });
  }

  return prisma.client.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      phone: input.phone,
      nationality: input.nationality ?? null,
      gender: input.gender ?? null,
      documentNumber: input.documentNumber ?? null,
      documentType: input.documentType ?? null,
      birthDate: input.birthDate ?? null,
    },
  });
}
