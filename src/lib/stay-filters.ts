import { Prisma } from "@prisma/client";

type StayFilterInput = {
  status?: string | null;
  source?: string | null;
  paymentStatus?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export function buildStayWhere(filters: StayFilterInput): Prisma.SejourWhereInput {
  const where: Prisma.SejourWhereInput = {};

  if (filters.status && filters.status !== "all") {
    where.status = filters.status as never;
  }

  if (filters.source && filters.source !== "all") {
    where.source = filters.source as never;
  }

  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    where.paymentStatus = filters.paymentStatus as never;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.startedAt = {};

    if (filters.dateFrom) {
      where.startedAt.gte = new Date(filters.dateFrom);
    }

    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      where.startedAt.lte = end;
    }
  }

  return where;
}
