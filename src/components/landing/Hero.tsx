import { motion } from "framer-motion";
import { Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";


interface HeroProps {
  onReserve: () => void;
}

export const Hero = ({ onReserve }: HeroProps) => {
  return (
    <section id="hero" className="relative min-h-screen pt-28 pb-20 overflow-hidden grain">
      {/* Ambient gradients */}
      <div className="absolute inset-0 gradient-ocean" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-glow blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-accent/20 blur-3xl pointer-events-none" />

      <div className="container relative mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="lg:col-span-5 space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass shadow-soft">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-primary">Institut Hôtelier d'Excellence</span>
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] text-primary">
              Vivez une <span className="gradient-text italic">expérience</span>{" "}
              résidentielle d'exception.
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
              Réservez votre résidence dans un cadre raffiné, pensé pour les étudiants et professionnels
              en quête d'élégance, de confort et de sérénité.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button
                onClick={onReserve}
                size="lg"
                className="gradient-teal text-accent-foreground hover:opacity-90 rounded-full px-8 h-14 text-base font-semibold shadow-elegant hover:scale-105 transition-all duration-300 group"
              >
                <Calendar className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                Réserver maintenant
              </Button>
              <Button
                onClick={() => document.getElementById("residences")?.scrollIntoView({ behavior: "smooth" })}
                variant="outline"
                size="lg"
                className="rounded-full px-8 h-14 text-base font-semibold border-primary/20 hover:bg-primary/5"
              >
                Découvrir les résidences
              </Button>
            </div>

            <div className="flex items-center gap-8 pt-6">
              <div>
                <div className="font-display text-3xl font-bold text-primary">10K+</div>
                <div className="text-sm text-muted-foreground">Résidents satisfaits</div>
              </div>
              <div className="w-px h-12 bg-border" />
              <div>
                <div className="font-display text-3xl font-bold text-primary">4.9★</div>
                <div className="text-sm text-muted-foreground">Note moyenne</div>
              </div>
            </div>
          </motion.div>

          {/* Bento grid */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="lg:col-span-7 grid grid-cols-6 grid-rows-6 gap-3 h-[560px] md:h-[640px]"
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
              className="col-span-4 row-span-4 rounded-3xl overflow-hidden shadow-elegant relative group"
            >
              <Image src="/assets/residence-1.jpg" alt="Résidence vue océan" fill className="object-cover group-hover:scale-110 transition-transform duration-700" sizes="(max-width: 768px) 100vw, 50vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
              <div className="absolute bottom-5 left-5 text-primary-foreground">
                <div className="text-xs uppercase tracking-widest opacity-80">Signature</div>
                <div className="font-display text-xl font-semibold">Résidence Océane</div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="col-span-2 row-span-3 rounded-3xl overflow-hidden shadow-elegant relative group animate-float"
            >
              <Image src="/assets/residence-3.jpg" alt="Lounge intérieur" fill className="object-cover group-hover:scale-110 transition-transform duration-700" sizes="(max-width: 768px) 100vw, 25vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent" />
              <div className="absolute bottom-3 left-3 text-primary-foreground text-sm font-medium">Lounge</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="col-span-2 row-span-3 rounded-3xl overflow-hidden shadow-elegant relative group"
            >
              <Image src="/assets/residence-2.jpg" alt="Chambre lumineuse" fill className="object-cover group-hover:scale-110 transition-transform duration-700" sizes="(max-width: 768px) 100vw, 25vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-accent/50 to-transparent" />
              <div className="absolute bottom-3 left-3 text-white text-sm font-medium">Suite Premium</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="col-span-4 row-span-2 rounded-3xl overflow-hidden shadow-elegant relative group"
            >
              <Image src="/assets/residence-4.jpg" alt="Piscine extérieure" fill className="object-cover group-hover:scale-110 transition-transform duration-700" sizes="(max-width: 768px) 100vw, 50vw" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/70 via-primary/20 to-transparent" />
              <div className="absolute top-1/2 -translate-y-1/2 left-5 text-primary-foreground">
                <div className="text-xs uppercase tracking-widest opacity-80">Détente</div>
                <div className="font-display text-lg font-semibold">Piscine & Spa</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
