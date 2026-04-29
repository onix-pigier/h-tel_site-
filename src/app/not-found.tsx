"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <h1 className="font-display text-6xl font-bold gradient-text">404</h1>
        <p className="text-muted-foreground">La page que vous cherchez n&apos;existe pas.</p>
        <Button asChild className="rounded-full gradient-sunset text-accent-foreground">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    </div>
  );
}
