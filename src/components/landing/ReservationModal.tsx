"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Mail, Phone, Calendar, Check, CreditCard, FileText } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clientGenderLabels, offerLabels } from "@/lib/hotel-display";
import { getDefaultEndAt, getOfferWindowWarning, offerNeedsDayCount, OfferCode, PUBLIC_OFFER_CODES } from "@/lib/pricing";
import { toast } from "sonner";

const schema = z
  .object({
    firstName: z.string().trim().min(2, "Prénom requis").max(50),
    lastName: z.string().trim().min(2, "Nom requis").max(50),
    email: z.string().trim().email("Email invalide").max(255),
    phone: z.string().trim().min(8, "Téléphone invalide").max(20),
    nationality: z.string().trim().min(2, "Nationalité requise").max(100),
    gender: z.enum(["homme", "femme", "autre"]),
    guestCount: z.coerce.number().int().min(1, "Nombre de personnes requis").max(20),
    dateArrivee: z.string().min(1, "Date d'arrivée requise"),
    dateDepart: z.string().min(1, "Date de départ requise"),
    dayCount: z.coerce.number().int().min(1, "Nombre de jours requis").max(365),
    offer: z.enum(PUBLIC_OFFER_CODES),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((data) => new Date(data.dateDepart) > new Date(data.dateArrivee), {
    message: "La date de départ doit être postérieure à la date d'arrivée",
    path: ["dateDepart"],
  });

interface ReservationModalProps {
  open: boolean;
  onClose: () => void;
}

const AUTO_DATE_OFFERS: OfferCode[] = ["nuitee", "forfait_semaine", "forfait_weekend", "villa_1ch", "villa_2ch", "longue_duree", "personnalise"];

export const ReservationModal = ({ open, onClose }: ReservationModalProps) => {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nationality: "",
    gender: "homme" as const,
    guestCount: 1,
    dateArrivee: "",
    dateDepart: "",
    dayCount: 1,
    offer: "nuitee" as OfferCode,
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [offerWarning, setOfferWarning] = useState<string | null>(null);
  const lastWarningRef = useRef<string | null>(null);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [key]: event.target.value });
    if (errors[key]) setErrors({ ...errors, [key]: "" });
  };

  useEffect(() => {
    if (!form.dateArrivee) {
      setOfferWarning(null);
      lastWarningRef.current = null;
      return;
    }

    const startAt = new Date(`${form.dateArrivee}T14:00:00`);
    if (Number.isNaN(startAt.getTime())) return;

    const warning = getOfferWindowWarning(form.offer, startAt);
    setOfferWarning(warning);

    if (warning) {
      if (lastWarningRef.current !== warning) {
        toast.warning("Choix d'offre à confirmer", {
          description: warning,
        });
        lastWarningRef.current = warning;
      }
      return;
    }

    lastWarningRef.current = null;

    if (!AUTO_DATE_OFFERS.includes(form.offer)) return;

    const endAt = getDefaultEndAt(form.offer, startAt, form.dayCount);
    const nextDate = endAt.toISOString().slice(0, 10);
    setForm((current) => (current.dateDepart === nextDate ? current : { ...current, dateDepart: nextDate }));
  }, [form.dateArrivee, form.dayCount, form.offer]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        nextErrors[String(issue.path[0])] = issue.message;
      });
      setErrors(nextErrors);
      return;
    }

    if (offerWarning) {
      toast.warning("Choix enregistré à la demande du client", {
        description: offerWarning,
      });
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error("Erreur lors de l'envoi", {
          description: payload.error || "Erreur inconnue",
        });
        return;
      }

      toast.success("Demande reçue", {
        description: "Référence " + payload.reference + " enregistrée.",
      });
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        nationality: "",
        gender: "homme",
        guestCount: 1,
        dateArrivee: "",
        dateDepart: "",
        dayCount: 1,
        offer: "nuitee",
        notes: "",
      });
      setErrors({});
      setOfferWarning(null);
      onClose();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  const managesDateAutomatically = AUTO_DATE_OFFERS.includes(form.offer) && !offerWarning;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-md" />

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-8 w-full max-w-3xl overflow-hidden rounded-3xl glass shadow-elegant"
          >
            <div className="relative p-8 md:p-10">
              <button
                onClick={onClose}
                className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full glass transition-colors hover:bg-white/80"
                aria-label="Fermer"
              >
                <X className="h-4 w-4 text-primary" />
              </button>

              <div className="mb-7">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                  <Calendar className="h-3 w-3" /> Réservation en ligne
                </div>
                <h3 className="mb-2 font-display text-3xl font-bold text-primary">Réservez votre séjour</h3>
                <p className="text-sm text-muted-foreground">
                  Notre équipe reprend ensuite votre demande pour préparer sereinement votre arrivée.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field icon={User} label="Prénom" name="firstName" value={form.firstName} onChange={update("firstName")} error={errors.firstName} />
                  <Field icon={User} label="Nom" name="lastName" value={form.lastName} onChange={update("lastName")} error={errors.lastName} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field icon={Mail} label="Email" name="email" type="email" value={form.email} onChange={update("email")} error={errors.email} />
                  <Field icon={Phone} label="Téléphone" name="phone" type="tel" value={form.phone} onChange={update("phone")} error={errors.phone} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field icon={CreditCard} label="Nationalité" name="nationality" value={form.nationality} onChange={update("nationality")} error={errors.nationality} placeholder="Ex: Côte d'Ivoire" />
                  <div>
                    <Label className="mb-1.5 block text-sm font-medium text-primary">Offre souhaitée</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {PUBLIC_OFFER_CODES.map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant={form.offer === value ? "default" : "outline"}
                          className="h-12 justify-center rounded-2xl"
                          onClick={() => setForm({ ...form, offer: value })}
                        >
                          {offerLabels[value]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block text-sm font-medium text-primary">Sexe</Label>
                    <Select value={form.gender} onValueChange={(value) => setForm({ ...form, gender: value as typeof form.gender })}>
                      <SelectTrigger className="h-12 rounded-2xl border-border bg-white/70 focus:ring-accent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {Object.entries(clientGenderLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="guestCount" className="mb-1.5 block text-sm font-medium text-primary">Nombre de personnes</Label>
                    <Input
                      id="guestCount"
                      type="number"
                      min="1"
                      max="20"
                      value={form.guestCount}
                      onChange={(event) => setForm({ ...form, guestCount: Number(event.target.value) || 1 })}
                      className="h-12 rounded-2xl border-border bg-white/70 focus-visible:ring-accent"
                    />
                    {errors.guestCount ? <p className="mt-1 text-xs text-red-500">{errors.guestCount}</p> : null}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field icon={Calendar} label="Date d'arrivée" name="dateArrivee" type="date" value={form.dateArrivee} onChange={update("dateArrivee")} error={errors.dateArrivee} />
                  <Field icon={Calendar} label="Date de sortie" name="dateDepart" type="date" value={form.dateDepart} onChange={update("dateDepart")} error={errors.dateDepart} readOnly={managesDateAutomatically} />
                </div>
                {offerNeedsDayCount(form.offer) && (
                  <div>
                    <Label htmlFor="dayCount" className="mb-1.5 block text-sm font-medium text-primary">Nombre de jours</Label>
                    <Input
                      id="dayCount"
                      type="number"
                      min="1"
                      max="365"
                      value={form.dayCount}
                      onChange={(event) => setForm({ ...form, dayCount: Math.max(1, Number(event.target.value) || 1) })}
                      className="h-12 rounded-2xl border-border bg-white/70 focus-visible:ring-accent"
                    />
                    {errors.dayCount ? <p className="mt-1 text-xs text-red-500">{errors.dayCount}</p> : null}
                  </div>
                )}
                {managesDateAutomatically && form.dateArrivee && (
                  <div className="rounded-2xl border border-border/70 bg-white/50 p-3 text-sm text-muted-foreground">
                    La date de départ se calcule automatiquement selon l&apos;offre choisie.
                  </div>
                )}
                {offerWarning && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
                    {offerWarning}
                  </div>
                )}
                <div>
                  <Label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-primary">Précisions</Label>
                  <div className="relative">
                    <FileText className="pointer-events-none absolute left-3.5 top-4 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="notes"
                      value={form.notes}
                      onChange={update("notes")}
                      placeholder="Demande particulière, heure d'arrivée estimée, nombre de jours souhaité, précision utile..."
                      className="min-h-28 rounded-2xl border-border bg-white/70 pl-10 focus-visible:ring-accent"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 h-12 w-full rounded-2xl gradient-sunset font-semibold text-accent-foreground shadow-elegant hover:opacity-90"
                >
                  {submitting ? "Envoi en cours..." : <><Check className="mr-2 h-4 w-4" /> Envoyer la demande</>}
                </Button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Field = ({
  icon: Icon,
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  readOnly = false,
}: {
  icon: React.ElementType;
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) => (
  <div>
    <Label htmlFor={name} className="mb-1.5 block text-sm font-medium text-primary">{label}</Label>
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        className="h-12 rounded-2xl border-border bg-white/70 pl-10 focus-visible:ring-accent"
      />
    </div>
    {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
  </div>
);
