
"use client";
import { Facebook, Instagram, X, MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface FooterProps {
  onReserve: () => void;
}

export const Footer = ({ onReserve }: FooterProps) => {
  return (
    <footer id="footer" className="relative bg-gradient-deep text-primary-foreground overflow-hidden grain">
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-accent/20 blur-3xl rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 lg:px-8 relative pt-20 pb-10">
        {/* CTA */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Prêt à rejoindre <span className="bg-gradient-to-r from-accent-glow to-white bg-clip-text text-transparent italic">Residences Les Chanaude</span> ?
          </h2>
          <p className="text-white/70 text-lg mb-8">Réservez votre résidence en quelques minutes.</p>
          <Button
            onClick={onReserve}
            size="lg"
            className="rounded-full gradient-sunset hover:opacity-90 px-10 h-14 text-base font-semibold shadow-glow animate-glow-pulse"
          >
            Réserver maintenant
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-10 pt-12 border-t border-white/10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">

              <div className="w-24 h-24 rounded-xl bg-white flex items-center justify-center shadow-lg">
                <Image src="/assets/logo1.png" alt="Résidences Les Chanaude" width={80} height={80} className="object-contain" />
              </div>
              <div>
                <span className="font-display font-bold text-xl block leading-tight">Résidences Les Chanaude</span>
                <span className="text-white/50 text-xs">Bassam</span>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Résidences Les Chanaude . Résidences de qualités pour tous.
            </p>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4">Navigation</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><a href="#hero" className="hover:text-accent-glow transition-colors">Accueil</a></li>
              <li><a href="#about" className="hover:text-accent-glow transition-colors">À Propos</a></li>
              <li><a href="#services" className="hover:text-accent-glow transition-colors">Services</a></li>
              <li><a href="#residences" className="hover:text-accent-glow transition-colors">Résidences</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4">Contact</h4>
            <ul className="space-y-3 text-sm text-white/60">
              <li className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" /> Mondoukou, Bassam Côte d&apos;Ivoire</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> +225 0500507777 </li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> +225 0701279960</li>
              <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> residenceleschanaude25@gmail.com</li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4">Scannez-nous</h4>
            <div className="w-32 h-32 rounded-2xl overflow-hidden bg-white p-2 mb-4">
              <Image src="/assets/qrcode.png" alt="QR Code Résidences Les Chanaude" width={112} height={112} className="object-contain" />
            </div>
            <h4 className="font-display font-semibold mb-3">Suivez-nous</h4>
            <div className="flex gap-3">
              {[
                { Icon: Instagram, href: "https://instagram.com", label: "Instagram" },
                { Icon: X, href: "https://twitter.com", label: "X (Twitter)" },
                { Icon: Facebook, href: "https://facebook.com", label: "Facebook" },
                { Icon: MessageCircle, href: "https://wa.me/2250701279960", label: "WhatsApp" },
              ].map(({ Icon, href, label }, i) => (
                <a
                  key={i}
                  href={href}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="w-10 h-10 rounded-xl glass-dark flex items-center justify-center hover:bg-accent/20 hover:scale-110 transition-all"
                  aria-label={label}
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-8 mt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/50">
          <div suppressHydrationWarning>© {new Date().getFullYear()} Kehogroupe. Tous droits réservés.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white">Mentions légales</a>
            <a href="#" className="hover:text-white">Confidentialité</a>
            <a href="#" className="hover:text-white">CGU</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
