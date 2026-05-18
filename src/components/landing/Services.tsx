"use client";

import { motion } from "framer-motion";
import { Car, HandshakeIcon, UtensilsCrossed, WavesIcon, Wifi } from "lucide-react";

const services = [
  { icon: UtensilsCrossed, title: "Restauration", desc: "Savourez vos repas face à l'horizon avec une vue imprenable sur l'eau.." },
  { icon: WavesIcon, title: "Plage à 100m", desc: "Accès direct à une plage privée pour des moments de détente inoubliables." },
  { icon: Wifi, title: "Internet Fibre", desc: "Une connexion ultra-rapide pour travailler ou vous divertir en toute fluidité." },
  { icon: Car, title: "Parking sécurisé", desc: "Stationnez votre véhicule en toute tranquillité." },
  { icon: HandshakeIcon, title: "Espace commun", desc: "Un lieu de vie convivial, idéal pour se détendre et se retrouver entre residents." },
];

export const Services = () => {
  return (
    <section id="services" className="relative py-28 gradient-ocean overflow-hidden">
      <div className="absolute inset-0 grain pointer-events-none" />
      <div className="container mx-auto px-4 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl mb-16"
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-5">
              Nos Atouts
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-primary mb-5">
            Un emplacement privilégié,  <span className="gradient-text italic">au cœur de l'essentiel.</span>
          </h2>
          <p className="text-lg text-muted-foreground">
              Profitez d’un environnement où tout est à proximité : plage, restaurants et commodités, pour un quotidien agréable et sans compromis.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              whileHover={{ y: -6 }}
              className="group relative p-6 rounded-3xl glass shadow-soft hover:shadow-elegant transition-all duration-500 cursor-pointer overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-primary/5 group-hover:gradient-sunset flex items-center justify-center mb-4 transition-all duration-500">
                  <s.icon className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-display font-semibold text-primary mb-1.5">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
