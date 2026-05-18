import { getServerSession } from "next-auth";
import { AlertTriangle, BedDouble, CalendarClock, CheckCircle2, DoorOpen, ShieldAlert, Sparkles, Users, Wallet } from "lucide-react";
import { DashboardCharts } from "@/components/admin/DashboardCharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authOptions } from "@/lib/auth";
import { formatCurrency } from "@/lib/hotel-display";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/stay-utils";

type PageProps = {
  searchParams: Promise<{
    period?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeekMonday(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatPeriodLabel(startAt: Date, endAt: Date) {
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${formatter.format(startAt)} au ${formatter.format(endAt)}`;
}

function parseInputDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return fallback;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function resolvePeriod(params: Awaited<PageProps["searchParams"]>, now: Date) {
  const period = params.period === "week" || params.period === "custom" || params.period === "today" ? params.period : "month";

  if (period === "today") {
    const startAt = startOfDay(now);
    const endAt = endOfDay(now);
    return { period, startAt, endAt, label: "Aujourd'hui", dateFrom: toInputDate(startAt), dateTo: toInputDate(endAt) };
  }

  if (period === "week") {
    const startAt = startOfWeekMonday(now);
    const endAt = endOfDay(addDays(startAt, 6));
    return { period, startAt, endAt, label: `Semaine du ${formatPeriodLabel(startAt, endAt)}`, dateFrom: toInputDate(startAt), dateTo: toInputDate(endAt) };
  }

  if (period === "custom") {
    const fallbackStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startAt = startOfDay(parseInputDate(params.dateFrom, fallbackStart));
    const endAt = endOfDay(parseInputDate(params.dateTo, now));
    const orderedStart = startAt <= endAt ? startAt : endAt;
    const orderedEnd = startAt <= endAt ? endAt : startAt;
    return { period, startAt: orderedStart, endAt: orderedEnd, label: formatPeriodLabel(orderedStart, orderedEnd), dateFrom: toInputDate(orderedStart), dateTo: toInputDate(orderedEnd) };
  }

  const startAt = new Date(now.getFullYear(), now.getMonth(), 1);
  const endAt = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return { period: "month", startAt, endAt, label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(now), dateFrom: toInputDate(startAt), dateTo: toInputDate(endAt) };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date);
}

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const isAdmin = Boolean(session?.user?.isAdmin);
  const params = await searchParams;
  const now = new Date();
  const period = resolvePeriod(params, now);
  const alertLimit = addDays(now, 2);
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    totalClients,
    activeStays,
    finishedStays,
    activeReservations,
    genderCounts,
    recentStays,
    overdueCheckout,
    unpaidOverdueStays,
    arrivalsSoon,
    pendingReservationsSoon,
    cleaningRooms,
    occupiedRooms,
    paymentAggregate,
    stayBalanceAggregate,
    extensionBalanceAggregate,
    stayDiscountAggregate,
    extensionDiscountAggregate,
    depositAggregate,
    arrivalsToday,
    confirmedArrivalsToday,
    departuresToday,
    availableRooms,
    availableVillas,
    pendingPreRegistrations,
  ] = await Promise.all([
    prisma.client.count({ where: { createdAt: { gte: period.startAt, lte: period.endAt } } }),
    prisma.sejour.count({ where: { status: "en_cours", startedAt: { lte: period.endAt }, currentEndAt: { gte: period.startAt } } }),
    prisma.sejour.count({ where: { status: "termine", checkedOutAt: { gte: period.startAt, lte: period.endAt } } }),
    prisma.reservation.count({ where: { status: { in: ["en_attente", "confirmee", "reportee"] }, dateArrivee: { gte: period.startAt, lte: period.endAt } } }),
    prisma.client.groupBy({ by: ["gender"], where: { createdAt: { gte: period.startAt, lte: period.endAt } }, _count: { _all: true } }),
    prisma.sejour.findMany({ where: { startedAt: { gte: firstMonth, lte: period.endAt } }, select: { startedAt: true } }),
    prisma.sejour.count({ where: { status: "en_cours", currentEndAt: { lt: now } } }),
    prisma.sejour.count({ where: { status: "en_cours", currentEndAt: { lt: now }, balanceDue: { gt: 0 } } }),
    prisma.sejour.count({ where: { status: "planifie", startedAt: { gte: now, lte: alertLimit } } }),
    prisma.reservation.count({ where: { status: "en_attente", dateArrivee: { lte: alertLimit } } }),
    prisma.chambre.count({ where: { status: "attente_nettoyage" } }),
    prisma.chambre.findMany({
      where: { status: "occupee" },
      select: { id: true, sejours: { where: { status: "en_cours" }, select: { id: true }, take: 1 } },
    }),
    prisma.payment.aggregate({ where: { paidAt: { gte: period.startAt, lte: period.endAt } }, _sum: { amount: true } }),
    prisma.sejour.aggregate({ where: { startedAt: { lte: period.endAt }, currentEndAt: { gte: period.startAt } }, _sum: { balanceDue: true } }),
    prisma.stayExtension.aggregate({ where: { createdAt: { gte: period.startAt, lte: period.endAt } }, _sum: { balanceDue: true } }),
    prisma.sejour.aggregate({ where: { startedAt: { lte: period.endAt }, currentEndAt: { gte: period.startAt } }, _sum: { discountAmount: true } }),
    prisma.stayExtension.aggregate({ where: { createdAt: { gte: period.startAt, lte: period.endAt } }, _sum: { discountAmount: true } }),
    prisma.stayDeposit.aggregate({ where: { status: "encaissee", heldAt: { gte: period.startAt, lte: period.endAt } }, _sum: { heldAmount: true } }),
    prisma.sejour.count({ where: { status: "planifie", startedAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.reservation.count({ where: { status: "confirmee", dateArrivee: { gte: todayStart, lte: todayEnd } } }),
    prisma.sejour.count({ where: { status: "en_cours", currentEndAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.chambre.count({ where: { status: "disponible" } }),
    prisma.chambre.count({ where: { status: "disponible", categorie: { in: ["villa_1ch", "villa_2ch"] } } }),
    prisma.sejour.count({ where: { status: "planifie", workflowKind: "direct" } }),
  ]);

  const genderTotal = genderCounts.reduce((sum, item) => sum + item._count._all, 0);
  const genderData = [
    { key: "homme", label: "Hommes", color: "#0f766e" },
    { key: "femme", label: "Femmes", color: "#f97316" },
  ].map((item) => {
    const count = genderCounts.find((entry) => entry.gender === item.key)?._count._all ?? 0;
    return { label: item.label, count, percent: percent(count, genderTotal), color: item.color };
  });

  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
  const affluenceData = months.map((month) => ({
    label: monthLabel(month),
    count: recentStays.filter((stay) => monthKey(stay.startedAt) === monthKey(month)).length,
  }));

  const totalCollected = toNumber(paymentAggregate._sum.amount);
  const totalOutstanding = toNumber(stayBalanceAggregate._sum.balanceDue) + toNumber(extensionBalanceAggregate._sum.balanceDue);
  const totalDiscounts = toNumber(stayDiscountAggregate._sum.discountAmount) + toNumber(extensionDiscountAggregate._sum.discountAmount);
  const totalDeposits = toNumber(depositAggregate._sum.heldAmount);
  const inconsistentOccupiedRooms = occupiedRooms.filter((room) => room.sejours.length === 0).length;

  const snapshotCards = [
    { label: "Arrivées prévues", value: arrivalsToday, detail: `${confirmedArrivalsToday} confirmée(s)`, tone: "text-emerald-700" },
    { label: "Départs du jour", value: departuresToday, detail: "à libérer", tone: "text-blue-700" },
    { label: "Chambres occupées", value: activeStays, detail: "sur la période", tone: "text-zinc-900" },
    { label: "Disponibles", value: availableRooms, detail: `dont ${availableVillas} villa`, tone: "text-lime-700" },
    { label: "Pré-enregistrements", value: pendingPreRegistrations, detail: "clé non remise", tone: "text-amber-700" },
  ];

  const kpis = [
    { label: "Clients", value: totalClients, icon: Users, detail: "Créés sur la période" },
    { label: "Séjours en cours", value: activeStays, icon: BedDouble, detail: "Actifs sur la période" },
    { label: "Séjours terminés", value: finishedStays, icon: CheckCircle2, detail: "Clôturés sur la période" },
    { label: "Réservations actives", value: activeReservations, icon: CalendarClock, detail: "Arrivée dans la période" },
  ];

  const adminKpis = [
    { label: "Encaissements", value: formatCurrency(totalCollected), icon: Wallet },
    { label: "Reste à recouvrer", value: formatCurrency(totalOutstanding), icon: ShieldAlert },
    { label: "Remises accordées", value: formatCurrency(totalDiscounts), icon: Sparkles },
    { label: "Cautions détenues", value: formatCurrency(totalDeposits), icon: BedDouble },
  ];

  const nearbyArrivals = arrivalsSoon + pendingReservationsSoon;
  const alerts = [
    { label: "Chambres à libérer", value: overdueCheckout, severity: overdueCheckout > 0 ? "danger" : "ok" },
    { label: "Soldes en retard", value: unpaidOverdueStays, severity: unpaidOverdueStays > 0 ? "danger" : "ok" },
    { label: "Arrivées proches", value: nearbyArrivals, severity: nearbyArrivals > 0 ? "warn" : "ok" },
    { label: "Ménage en attente", value: cleaningRooms, severity: cleaningRooms > 0 ? "warn" : "ok" },
    { label: "Incohérences chambres", value: inconsistentOccupiedRooms, severity: inconsistentOccupiedRooms > 0 ? "danger" : "ok" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Période: {period.label}</p>
        </div>
        <div className="w-full lg:w-auto">
          <form action="/admin/dashboard" className="grid gap-2 sm:grid-cols-3 lg:flex lg:items-center">
            <Button type="submit" name="period" value="today" size="sm" variant={period.period === "today" ? "default" : "outline"}>Jour</Button>
            <Button type="submit" name="period" value="week" size="sm" variant={period.period === "week" ? "default" : "outline"}>Semaine</Button>
            <Button type="submit" name="period" value="month" size="sm" variant={period.period === "month" ? "default" : "outline"}>Mois</Button>
            <Input className="h-9 min-w-[145px]" type="date" name="dateFrom" defaultValue={period.dateFrom} />
            <Input className="h-9 min-w-[145px]" type="date" name="dateTo" defaultValue={period.dateTo} />
            <Button type="submit" name="period" value="custom" size="sm" variant={period.period === "custom" ? "default" : "outline"}>Filtrer</Button>
          </form>
        </div>
      </div>

      <Card className="overflow-hidden border-primary/10 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DoorOpen className="h-4 w-4 text-primary" /> Vue opérationnelle
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {snapshotCards.map((item) => (
            <div key={item.label} className="rounded-2xl border bg-muted/35 p-4">
              <div className={`text-2xl font-bold ${item.tone}`}>{item.value}</div>
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.detail}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
                <Icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{item.value}</div>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isAdmin && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {adminKpis.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
                  <Icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{item.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DashboardCharts genderData={genderData} affluenceData={affluenceData} />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600" /> Alertes opérationnelles
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {alerts.map((alert) => (
            <div key={alert.label} className="flex items-center justify-between rounded-xl border p-3">
              <span className="text-sm text-muted-foreground">{alert.label}</span>
              <Badge variant={alert.severity === "danger" ? "destructive" : "outline"}>{alert.value}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
