import { Prisma } from "@/generated/prisma/client";

export type ClientFilterInput = {
  q?: string | null;
  month?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  type?: string | null;
  nationality?: string | null;
  status?: string | null;
};

function getMonthRange(month: string) {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) return null;

  const start = new Date(year, monthIndex - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex, 0, 23, 59, 59, 999);
  return { start, end };
}

export function buildClientWhere(filters: ClientFilterInput): Prisma.ClientWhereInput {
  const and: Prisma.ClientWhereInput[] = [];
  const query = (filters.q ?? "").trim();

  if (query.length >= 2) {
    and.push({
      OR: [
        { firstName: { contains: query } },
        { lastName: { contains: query } },
        { phone: { contains: query } },
        { email: { contains: query } },
        { nationality: { contains: query } },
        { documentNumber: { contains: query } },
      ],
    });
  }

  const nationality = (filters.nationality ?? "").trim();
  if (nationality && nationality !== "all") {
    and.push({ nationality: { contains: nationality } });
  }

  if (filters.month) {
    const range = getMonthRange(filters.month);
    if (range) and.push({ createdAt: { gte: range.start, lte: range.end } });
  }

  if (filters.dateFrom || filters.dateTo) {
    const createdAt: Prisma.DateTimeFilter<"Client"> = {};
    if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    and.push({ createdAt });
  }

  switch (filters.type) {
    case "avec_sejour":
      and.push({ sejours: { some: {} } });
      break;
    case "sans_sejour":
      and.push({ sejours: { none: {} } });
      break;
    case "avec_reservation":
      and.push({ reservations: { some: {} } });
      break;
  }

  switch (filters.status) {
    case "planifie":
    case "en_cours":
    case "termine":
    case "annule":
      and.push({ sejours: { some: { status: filters.status } } });
      break;
    case "impaye":
      and.push({ sejours: { some: { balanceDue: { gt: 0 } } } });
      break;
  }

  return and.length > 0 ? { AND: and } : {};
}
