import { Prisma } from "@/generated/prisma/client";

type StayFilterInput = {
  status?: string | null;
  source?: string | null;
  paymentStatus?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  query?: string | null;
};

export function buildStayWhere(filters: StayFilterInput): Prisma.SejourWhereInput {
  const where: Prisma.SejourWhereInput = {};

  if (filters.status && filters.status !== "all") {
    where.status = filters.status as never;
  }

  if (filters.source && filters.source !== "all") {
    where.workflowKind = filters.source as never;
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

  if (filters.query && filters.query.trim().length >= 2) {
    const query = filters.query.trim();
    where.OR = [
      { code: { contains: query } },
      { notes: { contains: query } },
      { client: { is: { firstName: { contains: query } } } },
      { client: { is: { lastName: { contains: query } } } },
      { client: { is: { phone: { contains: query } } } },
      { client: { is: { email: { contains: query } } } },
      { client: { is: { documentNumber: { contains: query } } } },
      { chambre: { is: { numero: { contains: query } } } },
      { reservation: { is: { reference: { contains: query } } } },
    ];
  }

  return where;
}
