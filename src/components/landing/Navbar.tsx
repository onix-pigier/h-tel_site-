"use client"
import { useEffect, useState } from "react";
import { Lock, Menu, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { label: "Accueil", id: "hero" },
  { label: "À Propos", id: "about" },
  { label: "Nos Atouts", id: "services" },
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

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setOpen(false);
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const scrollTo = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;

    const offset = 116;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    setOpen(false);
  };

  return (
    <header className="fixed top-3 left-0 right-0 z-50 px-3 sm:top-4 sm:px-4">
      {open && (
        <button
          type="button"
          aria-label="Fermer le menu mobile"
          className="fixed inset-0 bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <nav
        className={cn(
          "container relative mx-auto rounded-[28px] transition-all duration-500 px-4 md:px-6",
          scrolled ? "glass shadow-elegant py-2" : "bg-white/40 backdrop-blur-md py-3"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <button onClick={() => scrollTo("hero")} className="flex items-center gap-2 group">
            <div className="w-14 h-14 rounded-xl overflow-hidden shadow-soft group-hover:scale-110 transition-transform bg-white/80 flex items-center justify-center">
              <Image src="/assets/logo1.png" alt="Résidences Les Chanaude" width={56} height={56} className="object-contain" priority />
            </div>
            <span className="font-display font-bold text-primary hidden sm:block">Résidences Les Chanaude</span>
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
              className="hidden sm:inline-flex rounded-full gradient-sunset text-accent-foreground hover:opacity-90 px-5 shadow-soft"
            >
              Réserver
            </Button>
            <button
              onClick={() => setOpen(!open)}
              className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center bg-white/70 hover:bg-primary/5"
              aria-label="Menu"
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div
          id="mobile-nav"
          className={cn(
            "overflow-hidden transition-all duration-300 lg:hidden",
            open ? "mt-4 max-h-[420px] border-t border-primary/10 pt-4 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
          )}
        >
          <div className="flex flex-col gap-2 rounded-3xl bg-white/85 p-2 shadow-soft backdrop-blur-md animate-fade-up">
            {links.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="px-4 py-3 text-left text-sm font-medium text-primary/80 hover:bg-primary/5 rounded-2xl"
              >
                {l.label}
              </button>
            ))}
            <Button asChild variant="ghost" className="justify-start rounded-2xl text-primary md:hidden">
              <Link href="/auth" onClick={() => setOpen(false)}>
                <Lock className="mr-2 h-4 w-4" />
                Compte
              </Link>
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                onReserve();
              }}
              className="rounded-2xl gradient-sunset text-accent-foreground shadow-soft"
            >
              Réserver
            </Button>
          </div>
        </div>
      </nav>
    </header>
  );
};
