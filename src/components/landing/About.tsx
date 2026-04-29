"use client";

"use client";

import { motion } from "framer-motion";
import { Award, Heart, Shield, Sparkles } from "lucide-react";

const values = [
  { icon: Award, title: "Excellence & Standard", desc: "Un engagement permanent pour votre confort et une expérience de séjour irréprochable" },
  { icon: Heart, title: "Hospitalité", desc: "Chaque résident est accueilli comme un invité d'honneur." },
  { icon: Shield, title: "Sécurité & Sérénité ", desc: "Profitez d'un séjour 24/24 pour un séjour de confiance." },
  { icon: Sparkles, title: "Innovation & Digital", desc: "Simplifiez votre quotidien grâce à notre plateforme en ligne Réservez votre Séjour et vos demandes en un clic" },
];

export const About = () => {
  return (
    <section id="about" className="relative py-28 overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 blur-3xl rounded-full" />

      <div className="container mx-auto px-4 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl mx-auto text-center mb-20"
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-5">
            À Propos
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-primary mb-6">
            Notre vision : <span className="gradient-text italic">réinventer</span> l'art de vivre en résidence.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
             Vivez l&apos;ambition de demain : le confort d&apos;un chez-soi avec l&apos;élégance et  les services d&apos;un grand hôtel
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {values.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group p-7 rounded-3xl bg-card border border-border/60 hover:border-accent/40 hover:shadow-elegant transition-all duration-500 hover:-translate-y-2"
            >
              <div className="w-12 h-12 rounded-2xl gradient-sunset flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-soft">
                <v.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display text-xl font-semibold text-primary mb-2">{v.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
