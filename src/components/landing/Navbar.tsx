"use client"
import { useEffect, useState } from "react";
import { Lock, Menu, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { label: "Accueil", id: "hero" },
  { label: "À Propos", id: "about" },
  { label: "Services", id: "services" },
  { label: "Nos Résidences", id: "residences" },
  { label: "Contact", id: "footer" },
];

interface NavbarProps {
  onReserve: () => void;
}

export const Navbar = ({ onReserve }: NavbarProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setOpen(false);
  };

  return (
    <header className="fixed top-4 left-0 right-0 z-50 px-4">
      <nav
        className={cn(
          "container mx-auto rounded-full transition-all duration-500 px-4 md:px-6",
          scrolled ? "glass shadow-elegant py-2" : "bg-white/40 backdrop-blur-md py-3"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <button onClick={() => scrollTo("hero")} className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl gradient-teal flex items-center justify-center shadow-soft group-hover:scale-110 transition-transform">
              <span className="font-display font-bold text-white text-lg">H</span>
            </div>
            <span className="font-display font-bold text-primary hidden sm:block">Hôtel.ci</span>
          </button>

          <div className="hidden lg:flex items-center gap-1">
            {links.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="px-4 py-2 text-sm font-medium text-primary/80 hover:text-primary rounded-full hover:bg-primary/5 transition-colors"
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-full hidden md:inline-flex gap-2 text-primary"
            >
              <Link href="/auth">
                <Lock className="w-4 h-4" />
                Compte
              </Link>
            </Button>
            <Button
              onClick={onReserve}
              size="sm"
              className="rounded-full gradient-teal text-accent-foreground hover:opacity-90 px-5 shadow-soft"
            >
              Réserver
            </Button>
            <button
              onClick={() => setOpen(!open)}
              className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center hover:bg-primary/5"
              aria-label="Menu"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden mt-4 pb-3 flex flex-col gap-1 animate-fade-up">
            {links.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="px-4 py-2.5 text-left text-sm font-medium text-primary/80 hover:bg-primary/5 rounded-xl"
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
};
