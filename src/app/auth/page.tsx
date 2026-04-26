"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(6, "6 caractères minimum").max(100),
});

export default function AuthPage() {
  const router = useRouter();
  const { user, isStaff, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(isStaff ? "/admin" : "/");
    }
  }, [user, isStaff, authLoading, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Identifiants invalides");
      } else {
        toast.success("Connexion réussie");
        router.replace("/admin");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/10 relative overflow-hidden">
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-accent/20 blur-3xl rounded-full" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/20 blur-3xl rounded-full" />

      <Link href="/" className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm text-primary/70 hover:text-primary">
        <ArrowLeft className="w-4 h-4" /> Retour à l&apos;accueil
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md rounded-3xl glass shadow-elegant p-8"
      >
        <div className="text-center mb-7">
          <div className="w-14 h-14 mx-auto rounded-2xl gradient-teal flex items-center justify-center shadow-soft mb-4">
            <Lock className="w-6 h-6 text-accent-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-primary">Espace Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">Connectez-vous avec vos identifiants admin</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-primary text-sm font-medium mb-1.5 block">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@Hôtel.ci"
                className="pl-10 h-12 rounded-2xl bg-white/70"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="text-primary text-sm font-medium mb-1.5 block">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10 h-12 rounded-2xl bg-white/70"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl gradient-teal text-accent-foreground font-semibold shadow-elegant"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Se connecter"}
          </Button>

          <p className="text-xs text-center text-muted-foreground pt-2">
            Les comptes administrateurs sont créés par le système.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
