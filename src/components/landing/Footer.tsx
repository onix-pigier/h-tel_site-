import { Instagram, Twitter, Facebook, Linkedin, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

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
            Prêt à rejoindre <span className="bg-gradient-to-r from-accent-glow to-white bg-clip-text text-transparent italic">Hôtel.ci</span> ?
          </h2>
          <p className="text-white/70 text-lg mb-8">Réservez votre résidence en quelques minutes.</p>
          <Button
            onClick={onReserve}
            size="lg"
            className="rounded-full gradient-teal hover:opacity-90 px-10 h-14 text-base font-semibold shadow-glow animate-glow-pulse"
          >
            Réserver maintenant
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-10 pt-12 border-t border-white/10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl gradient-teal flex items-center justify-center">
                <span className="font-display font-bold text-white">H</span>
              </div>
              <span className="font-display font-bold text-xl">Hôtel.ci</span>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Institut Hôtelier d'Excellence. Résidences premium pour étudiants et professionnels.
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
              <li className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" /> Abidjan, Côte d’Ivoire</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> +225 0102030405</li>
              <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> contact@Hôtel.ci</li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4">Suivez-nous</h4>
            <div className="flex gap-3">
              {[Instagram, Twitter, Facebook, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 rounded-xl glass-dark flex items-center justify-center hover:bg-accent/20 hover:scale-110 transition-all"
                  aria-label="Réseau social"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-8 mt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/50">
          <div>© {new Date().getFullYear()} Hôtel.ci Institut. Tous droits réservés.</div>
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
