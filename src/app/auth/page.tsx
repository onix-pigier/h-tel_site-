"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import Image from "next/image";
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

function normalizeCallbackUrl(raw: string | null | undefined, fallback: string) {
  if (!raw) return fallback;

  try {
    const candidate = raw.startsWith("http") ? new URL(raw).pathname + new URL(raw).search : raw;
    const normalized = candidate.startsWith("/") ? candidate : "/" + candidate;

    if (normalized === "/" || normalized === "/admin") return fallback;
    if (normalized.startsWith("/auth")) return fallback;

    return normalized;
  } catch {
    return fallback;
  }
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isStaff, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearingSession, setClearingSession] = useState(false);
  const handledUnauthorizedSession = useRef(false);
  const requestedCallbackUrl = searchParams.get("callbackUrl");
  const staffTarget = useMemo(
    () => normalizeCallbackUrl(requestedCallbackUrl, "/admin/registre"),
    [requestedCallbackUrl]
  );

  useEffect(() => {
    if (authLoading || !user) {
      if (!user) handledUnauthorizedSession.current = false;
      return;
    }

    if (isStaff) {
      router.replace(staffTarget);
      return;
    }

    if (handledUnauthorizedSession.current) return;
    handledUnauthorizedSession.current = true;
    setClearingSession(true);

    void signOut({ redirect: false }).finally(() => {
      setClearingSession(false);
      router.replace("/auth");
      router.refresh();
    });
  }, [user, isStaff, authLoading, router, staffTarget]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const { email: normalizedEmail, password: normalizedPassword } = parsed.data;

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: normalizedEmail.toLowerCase(),
        password: normalizedPassword,
        redirect: false,
        callbackUrl: staffTarget,
      });
      if (result?.error) {
        toast.error("Identifiants invalides");
      } else {
        toast.success("Connexion réussie");
        router.replace(staffTarget);
        router.refresh();
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
          <div className="w-28 h-28 mx-auto rounded-2xl flex items-center justify-center ">
            <Image src="/assets/logo1.png" alt="Résidences Les Chanaude" width={120} height={120} className="object-contain" priority />
          </div>
          <h1 className="font-display text-2xl font-bold text-primary">Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">Connectez-vous</p>
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
                placeholder="votreemail@gmail.com"
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
                className="pl-10 h-12 rounded-2xl bg-white/70 text-lg placeholder:text-lg tracking-widest"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || clearingSession}
            className="w-full h-12 rounded-2xl gradient-sunset text-accent-foreground font-semibold shadow-elegant"
          >
            {loading || clearingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : "Se connecter"}
          </Button>

          <p className="text-xs text-center text-muted-foreground pt-2 opacity-80">
            © {new Date().getFullYear()} Kehogroupe. Tous droits réservés.
          </p>
        </form>
      </motion.div>
    </div>
  );
}

function AuthPageFallback() {
  return <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10" />;
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageContent />
    </Suspense>
  );
}
