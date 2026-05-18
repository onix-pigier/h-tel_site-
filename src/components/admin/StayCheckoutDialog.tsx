"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { depositStatusLabels, formatCurrency } from "@/lib/hotel-display";
import { toast } from "sonner";

interface StayCheckoutDialogProps {
  stay: {
    id: string;
    client: { firstName: string; lastName: string };
    chambre: { numero: string; type: string };
    deposits?: Array<{
      id: string;
      type: string;
      status: string;
      expectedAmount: number;
      heldAmount: number;
      returnedAmount: number;
      notes?: string | null;
    }>;
    notes?: string | null;
  };
  totalBalance: number;
  onCompleted?: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function StayCheckoutDialog({ stay, totalBalance, onCompleted, open: controlledOpen, onOpenChange, hideTrigger = false }: StayCheckoutDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState(stay.notes ?? "");
  const [behaviorAfter, setBehaviorAfter] = useState("");
  const [depositDecision, setDepositDecision] = useState<"restituee" | "conservee" | "">("");
  const [depositReturnedAmount, setDepositReturnedAmount] = useState(0);
  const [depositNotes, setDepositNotes] = useState("");
  const activeVillaDeposit = (stay.deposits ?? []).find((deposit) => deposit.type === "caution_villa") ?? null;
  const heldDepositAmount = Number(activeVillaDeposit?.heldAmount ?? 0);
  const requiresDepositResolution = activeVillaDeposit?.status === "encaissee" && heldDepositAmount > 0;
  const depositResolutionInvalid = depositDecision === "restituee" && depositReturnedAmount > heldDepositAmount;
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (!open) return;
    setNotes(stay.notes ?? "");
    setBehaviorAfter("");
    setDepositDecision(requiresDepositResolution ? "restituee" : "");
    setDepositReturnedAmount(heldDepositAmount);
    setDepositNotes(activeVillaDeposit?.notes ?? "");
  }, [activeVillaDeposit?.notes, heldDepositAmount, open, requiresDepositResolution, stay.notes]);

  const submit = async () => {
    setSubmitting(true);
    const res = await fetch("/api/admin/stays/" + stay.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "termine",
        notes,
        behaviorAfter,
        depositDecision: requiresDepositResolution ? depositDecision : undefined,
        depositReturnedAmount: requiresDepositResolution && depositDecision === "restituee" ? depositReturnedAmount : undefined,
        depositNotes: requiresDepositResolution ? depositNotes : undefined,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      toast.error(payload.error || "Clôture impossible");
      return;
    }

    toast.success("Séjour clôturé. La chambre passe en attente de nettoyage.");
    setOpen(false);
    await onCompleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <CheckCircle2 className="mr-1 h-4 w-4" /> Clôturer
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clôture manuelle du séjour</DialogTitle>
          <DialogDescription>Fin de séjour et passage ménage.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="font-medium">{stay.client.firstName} {stay.client.lastName}</div>
            <div className="text-muted-foreground">Chambre {stay.chambre.numero} ({stay.chambre.type})</div>
            <div className="mt-2">
              Solde restant:{" "}
              <span className={totalBalance > 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>
                {formatCurrency(totalBalance)}
              </span>
            </div>
          </div>

          {totalBalance > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Clôture bloquée
              </div>
              <div className="mt-1 text-xs">
                Encaisse le solde avant clôture.
              </div>
            </div>
          )}

          {activeVillaDeposit && (
            <div className="rounded-xl border p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-primary">Caution villa</div>
                <div>{formatCurrency(activeVillaDeposit.expectedAmount)}</div>
              </div>
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>Encaissée</span>
                <span>{formatCurrency(activeVillaDeposit.heldAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>Statut</span>
                <span>{depositStatusLabels[activeVillaDeposit.status] ?? activeVillaDeposit.status}</span>
              </div>
              {requiresDepositResolution && (
                <div className="space-y-3">
                  <div>
                    <Label>Décision caution</Label>
                    <Select value={depositDecision} onValueChange={(value) => setDepositDecision(value as "restituee" | "conservee")}>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="restituee">Restituer</SelectItem>
                        <SelectItem value="conservee">Conserver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {depositDecision === "restituee" && (
                    <div>
                      <Label>Montant restitué</Label>
                      <Input type="number" min="0" max={heldDepositAmount} value={depositReturnedAmount} onChange={(event) => setDepositReturnedAmount(Number(event.target.value) || 0)} />
                    </div>
                  )}
                  <div>
                    <Label>Note caution</Label>
                    <Textarea value={depositNotes} onChange={(event) => setDepositNotes(event.target.value)} placeholder="Restituée au client, retenue pour dégradation, remarque utile..." />
                  </div>
                  {depositResolutionInvalid && <div className="text-xs text-red-600">Le montant restitué ne peut pas dépasser la caution encaissée.</div>}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Observation de sortie</Label>
            <Textarea
              value={behaviorAfter}
              onChange={(event) => setBehaviorAfter(event.target.value)}
              placeholder="Client calme, chambre propre, remarque à conserver au séjour..."
            />
          </div>

          <div>
            <Label>Note interne du séjour</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Synthèse interne, objet oublié, consigne ménage, etc."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="button" className="gradient-teal text-accent-foreground" onClick={submit} disabled={submitting || totalBalance > 0 || (requiresDepositResolution && (!depositDecision || depositResolutionInvalid))}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Confirmer la clôture
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
