"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Mail, Phone, Calendar, Check, CreditCard, FileText } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const schema = z
  .object({
    firstName: z.string().trim().min(2, "Prénom requis").max(50),
    lastName: z.string().trim().min(2, "Nom requis").max(50),
    email: z.string().trim().email("Email invalide").max(255),
    phone: z.string().trim().min(8, "Téléphone invalide").max(20),
    documentNumber: z.string().trim().min(4, "Pièce d'identité requise").max(30),
    dateArrivee: z.string().min(1, "Date d'arrivée requise"),
    dateDepart: z.string().min(1, "Date de départ requise"),
    offer: z.enum(["nuitee", "forfait", "passage", "villa_1ch", "villa_2ch", "longue_duree", "personnalise"]),
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

const offerLabels: Record<string, string> = {
  nuitee: "Nuitée",
  forfait: "Forfait",
  passage: "Passage 2h",
  villa_1ch: "Villa 1 chambre",
  villa_2ch: "Villa 2 chambres",
  longue_duree: "Longue durée",
  personnalise: "Personnalisé",
};

export const ReservationModal = ({ open, onClose }: ReservationModalProps) => {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    documentNumber: "",
    dateArrivee: "",
    dateDepart: "",
    offer: "nuitee",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [key]: event.target.value });
    if (errors[key]) setErrors({ ...errors, [key]: "" });
  };

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
        documentNumber: "",
        dateArrivee: "",
        dateDepart: "",
        offer: "nuitee",
        notes: "",
      });
      setErrors({});
      onClose();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-md" />

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl my-8 rounded-3xl glass shadow-elegant overflow-hidden"
          >
            <div className="relative p-8 md:p-10">
              <button
                onClick={onClose}
                className="absolute top-5 right-5 w-9 h-9 rounded-full glass flex items-center justify-center hover:bg-white/80 transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4 text-primary" />
              </button>

              <div className="mb-7">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 text-accent text-xs font-semibold mb-3">
                  <Calendar className="w-3 h-3" /> Réservation en ligne
                </div>
                <h3 className="font-display text-3xl font-bold text-primary mb-2">Réservez votre séjour</h3>
                <p className="text-sm text-muted-foreground">
                  Les demandes web entrent en validation avant attribution de chambre.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field icon={User} label="Prénom" name="firstName" value={form.firstName} onChange={update("firstName")} error={errors.firstName} />
                  <Field icon={User} label="Nom" name="lastName" value={form.lastName} onChange={update("lastName")} error={errors.lastName} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field icon={Mail} label="Email" name="email" type="email" value={form.email} onChange={update("email")} error={errors.email} />
                  <Field icon={Phone} label="Téléphone" name="phone" type="tel" value={form.phone} onChange={update("phone")} error={errors.phone} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field icon={CreditCard} label="Numéro de pièce" name="documentNumber" value={form.documentNumber} onChange={update("documentNumber")} error={errors.documentNumber} placeholder="CNI / passeport" />
                  <div>
                    <Label className="text-primary text-sm font-medium mb-1.5 block">Offre souhaitée</Label>
                    <Select value={form.offer} onValueChange={(value) => setForm({ ...form, offer: value as typeof form.offer })}>
                      <SelectTrigger className="h-12 rounded-2xl bg-white/70 border-border focus:ring-accent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {Object.entries(offerLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field icon={Calendar} label="Date d'arrivée" name="dateArrivee" type="date" value={form.dateArrivee} onChange={update("dateArrivee")} error={errors.dateArrivee} />
                  <Field icon={Calendar} label="Date de départ" name="dateDepart" type="date" value={form.dateDepart} onChange={update("dateDepart")} error={errors.dateDepart} />
                </div>
                <div>
                  <Label htmlFor="notes" className="text-primary text-sm font-medium mb-1.5 block">Précisions</Label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-4 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Textarea
                      id="notes"
                      value={form.notes}
                      onChange={update("notes")}
                      placeholder="Demande particulière, heure d'arrivée estimée, durée souhaitée..."
                      className="pl-10 min-h-28 rounded-2xl bg-white/70 border-border focus-visible:ring-accent"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-2xl gradient-sunset hover:opacity-90 text-accent-foreground font-semibold shadow-elegant mt-2"
                >
                  {submitting ? "Envoi en cours..." : <><Check className="w-4 h-4 mr-2" /> Confirmer la demande</>}
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
}: {
  icon: React.ElementType;
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  type?: string;
  placeholder?: string;
}) => (
  <div>
    <Label htmlFor={name} className="text-primary text-sm font-medium mb-1.5 block">{label}</Label>
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
        placeholder={placeholder}
        className="pl-10 h-12 rounded-2xl bg-white/70 border-border focus-visible:ring-accent"
        aria-invalid={!!error}
      />
    </div>
    {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
  </div>
);
