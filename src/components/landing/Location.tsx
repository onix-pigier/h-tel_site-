"use client"

import { motion } from "framer-motion";
import { MapPin, Phone, Mail, Navigation } from "lucide-react";

export const Location = () => {
  return (
    <section id="location" className="py-28">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-5">
              Localisation
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-primary mb-6">
              Idéalement <span className="gradient-text italic">situé</span>.
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Au cœur de la ville, à deux pas des transports, des commerces et des lieux culturels.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-card border border-border/60">
                <div className="w-10 h-10 rounded-xl gradient-teal flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-primary">Adresse</div>
                  <div className="text-sm text-muted-foreground">Abidjan côte d'ivoire</div>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-card border border-border/60">
                <div className="w-10 h-10 rounded-xl gradient-teal flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-primary">Téléphone</div>
                  <div className="text-sm text-muted-foreground">+225 0102030405</div>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-card border border-border/60">
                <div className="w-10 h-10 rounded-xl gradient-teal flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-primary">Email</div>
                  <div className="text-sm text-muted-foreground">contact@hotel.ci</div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden shadow-elegant h-[500px] bg-muted"
          >
            <iframe
              title="Localisation Hotelis"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-4.08%2C5.30%2C-3.95%2C5.38&layer=mapnik&marker=5.3364%2C-4.0267"
              className="w-full h-full border-0"
              loading="lazy"
            />
            <div className="absolute top-5 left-5 glass rounded-2xl px-4 py-3 shadow-soft flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-teal flex items-center justify-center animate-glow-pulse">
                <Navigation className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Hoteli.ci</div>
                <div className="font-semibold text-primary text-sm">Abidjan, Côte d’Ivoire</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
