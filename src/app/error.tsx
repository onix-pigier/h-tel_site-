"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl gradient-sunset flex items-center justify-center shadow-soft">
          <span className="font-display text-2xl font-bold text-accent-foreground">!</span>
        </div>
        <h2 className="text-2xl font-display font-bold text-primary">
          Une erreur est survenue
        </h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "Quelque chose s'est mal passé. Veuillez réessayer."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center px-6 py-3 rounded-2xl gradient-sunset text-accent-foreground font-semibold shadow-elegant hover:opacity-90 transition-opacity"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
