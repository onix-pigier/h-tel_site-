"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarRange, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface RoomChoice {
  id: string;
  numero: string;
  type: string;
}

interface StayReportDialogProps {
  stay: {
    id: string;
    offer: string;
    startedAt: string;
    currentEndAt: string;
    chambre: {
      id: string;
      numero: string;
      type: string;
    };
    reservation: {
      reference: string;
      dateArriveeOriginal: string | null;
    } | null;
  };
  onCompleted?: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

function toDateInputValue(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function getDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatReportDate(value: string | null | undefined) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy HH:mm");
}

export function StayReportDialog({ stay, onCompleted, open: controlledOpen, onOpenChange, hideTrigger = false }: StayReportDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rooms, setRooms] = useState<RoomChoice[]>([]);
  const [form, setForm] = useState({
    startAt: toDateInputValue(stay.startedAt),
    endAt: toDateInputValue(stay.currentEndAt),
    chambreId: stay.chambre.id,
    notes: "",
  });
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (!open) return;
    setForm({
      startAt: toDateInputValue(stay.startedAt),
      endAt: toDateInputValue(stay.currentEndAt),
      chambreId: stay.chambre.id,
      notes: "",
    });
  }, [open, stay]);

  useEffect(() => {
    if (!open || !form.startAt || !form.endAt) return;

    let cancelled = false;
    const loadRooms = async () => {
      setLoadingRooms(true);
      const params = new URLSearchParams({
        offer: stay.offer,
        startAt: form.startAt,
        endAt: form.endAt,
        excludeStayId: stay.id,
      });

      const res = await fetch("/api/admin/attributions/available?" + params.toString(), { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (cancelled) return;

      if (!res.ok) {
        toast.error(payload.error || "Disponibilités introuvables");
        setRooms([]);
        setLoadingRooms(false);
        return;
      }

      const nextRooms = Array.isArray(payload.chambres) ? payload.chambres : [];
      setRooms(nextRooms);
      setForm((current) => ({
        ...current,
        chambreId: nextRooms.some((room: RoomChoice) => room.id === current.chambreId)
          ? current.chambreId
          : nextRooms[0]?.id ?? "",
      }));
      setLoadingRooms(false);
    };

    void loadRooms();

    return () => {
      cancelled = true;
    };
  }, [form.endAt, form.startAt, open, stay.id, stay.offer]);

  const nowInputValue = toDateInputValue(new Date());
  const reportStartsInPast = useMemo(() => {
    const startAt = getDateTime(form.startAt);
    return Boolean(startAt && startAt.getTime() < Date.now());
  }, [form.startAt]);

  const submit = async () => {
    const startAt = getDateTime(form.startAt);
    const endAt = getDateTime(form.endAt);
    const previousStartAt = getDateTime(stay.startedAt);
    const previousEndAt = getDateTime(stay.currentEndAt);

    if (!form.chambreId || !startAt || !endAt || endAt <= startAt) {
      toast.error("Les nouvelles dates sont invalides.");
      return;
    }

    if (previousStartAt && previousEndAt && startAt.getTime() === previousStartAt.getTime() && endAt.getTime() === previousEndAt.getTime()) {
      toast.info("Aucune modification de date détectée. Un report implique une nouvelle date de séjour.");
      return;
    }

    if (previousStartAt && startAt <= previousStartAt) {
      toast.error("Un report doit déplacer l'arrivée vers une date ultérieure.");
      return;
    }

    if (reportStartsInPast) {
      toast.error("Choisis une arrivée future.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/admin/stays/" + stay.id + "/report", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      toast.error(payload.error || "Report impossible");
      return;
    }

    toast.success("Séjour reporté");
    setOpen(false);
    await onCompleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <CalendarRange className="mr-1 h-4 w-4" /> Reporter
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reporter Séjour</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <div>Dates séjour: {formatReportDate(stay.startedAt)} au {formatReportDate(stay.currentEndAt)}</div>
            <div>Offre: {stay.offer}</div>
            <div>Chambre reservée: {stay.chambre.numero} ({stay.chambre.type})</div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Nouvelle arrivée</Label>
              <Input type="datetime-local" min={nowInputValue} value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} />
            </div>
            <div>
              <Label>Nouvelle fin</Label>
              <Input type="datetime-local" min={form.startAt || nowInputValue} value={form.endAt} onChange={(event) => setForm({ ...form, endAt: event.target.value })} />
            </div>
          </div>

          <div>
            <Label>Chambre</Label>
            <Select value={form.chambreId} onValueChange={(value) => setForm({ ...form, chambreId: value })}>
              <SelectTrigger><SelectValue placeholder="Choisir une chambre disponible" /></SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    N° {room.numero} - {room.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingRooms && <div className="mt-2 text-xs text-muted-foreground">Recherche des chambres disponibles...</div>}
          </div>

          <div>
            <Label>Informations supplémentaires</Label>
            <Textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Client a demandé un décalage, mariage reporté, arrivée tardive, etc."
            />
          </div>
          {reportStartsInPast && (
            <div></div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="button" className="gradient-teal text-accent-foreground" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Valider le report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
