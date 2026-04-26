"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Mail, Phone, CreditCard, Calendar, Check } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({
  firstName: z.string().trim().min(2, "Prénom requis").max(50),
  lastName: z.string().trim().min(2, "Nom requis").max(50),
  email: z.string().trim().email("Email invalide").max(255),
  phone: z.string().trim().min(8, "Téléphone invalide").max(20),
  card: z.string().trim().min(12, "Numéro de carte invalide").max(19),
  idNumber: z.string().trim().min(4, "Pièce d'identité requise").max(30),
});

interface ReservationModalProps {
  open: boolean;
  onClose: () => void;
}

export const ReservationModal = ({ open, onClose }: ReservationModalProps) => {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    card: "",
    idNumber: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: "" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setSubmitting(true);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          idNumber: form.idNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Erreur lors de l'envoi", { description: data.error || "Erreur inconnue" });
        setSubmitting(false);
        return;
      }

      toast.success("Demande reçue ! Nous vous contactons sous 24h.", {
        description: `Confirmation envoyée à ${form.email}`,
      });
      setForm({ firstName: "", lastName: "", email: "", phone: "", card: "", idNumber: "" });
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
            className="relative w-full max-w-2xl my-8 rounded-3xl glass shadow-elegant overflow-hidden"
          >
            <div className="absolute -top-32 -right-32 w-80 h-80 bg-accent/30 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-primary/20 blur-3xl rounded-full pointer-events-none" />

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
                  <Calendar className="w-3 h-3" /> Réservation
                </div>
                <h3 className="font-display text-3xl font-bold text-primary mb-2">
                  Réservez votre résidence
                </h3>
                <p className="text-sm text-muted-foreground">
                  Remplissez ce formulaire. Nous vous répondons sous 24h.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field icon={User} label="Prénom" name="firstName" value={form.firstName} onChange={update("firstName")} error={errors.firstName} />
                  <Field icon={User} label="Nom" name="lastName" value={form.lastName} onChange={update("lastName")} error={errors.lastName} />
                </div>
                <Field icon={Mail} label="Email" name="email" type="email" value={form.email} onChange={update("email")} error={errors.email} />
                <Field icon={Phone} label="Téléphone" name="phone" type="tel" value={form.phone} onChange={update("phone")} error={errors.phone} />
                <Field icon={CreditCard} label="Numéro de carte (placeholder)" name="card" value={form.card} onChange={update("card")} error={errors.card} placeholder="0000 0000 0000 0000" />
                <Field icon={User} label="Pièce d'identité" name="idNumber" value={form.idNumber} onChange={update("idNumber")} error={errors.idNumber} placeholder="N° passeport ou CNI" />

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-2xl gradient-teal hover:opacity-90 text-accent-foreground font-semibold shadow-elegant mt-2"
                >
                  {submitting ? (
                    "Envoi en cours…"
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" /> Confirmer la demande
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground pt-1">
                  Vos données sont sécurisées. Aucun débit avant validation.
                </p>
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
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
        onChange={onChange}
        placeholder={placeholder}
        className="pl-10 h-12 rounded-2xl bg-white/70 border-border focus-visible:ring-accent"
        aria-invalid={!!error}
      />
    </div>
    {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
  </div>
);
