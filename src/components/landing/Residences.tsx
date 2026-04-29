"use client";

import { motion } from "framer-motion";
import { MapPin, Users } from "lucide-react";
import Image from "next/image";


const residences = [
  { img: "/assets/residence-1.png", name: "Résidence Océane", location: "Front de mer", capacity: "120 chambres", tag: "Signature" },
  { img: "/assets/residence-2.png", name: "Suite Lumière", location: "Centre-ville", capacity: "Vue panoramique", tag: "Premium" },
  { img: "/assets/residence-5.png", name: "Studio Américain", location: "Quartier campus", capacity: "Bureau intégré", tag: "Beau" },
  { img: "/assets/residence-3.png", name: "Lounge Privatif", location: "Aile sud", capacity: "Espace partagé", tag: "Lifestyle" },
  { img: "/assets/residence-4.png", name: "Villa Piscine", location: "Jardins privés", capacity: "Spa & détente", tag: "Premium" },
];

export const Residences = () => {
  return (
    <section id="residences" className="py-28 relative overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl"
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-5">
              Nos Résidences
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-primary">
              Des univers, une <span className="gradient-text italic">même exigence</span>.
            </h2>
          </motion.div>
          <p className="text-muted-foreground md:max-w-sm">
            Chaque résidence offre un caractère unique, mais toutes partagent le même niveau d'attention au détail.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {residences.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -8 }}
              className={`group relative rounded-3xl overflow-hidden shadow-soft hover:shadow-elegant transition-all duration-500 cursor-pointer ${
                i === 0 ? "md:col-span-2 lg:row-span-2" : ""
              }`}
            >
              <div className={`relative ${i === 0 ? "h-[400px] lg:h-[600px]" : "h-[300px]"}`}>
                <Image
                  src={r.img}
                  alt={r.name}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-1000"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/40 to-transparent opacity-90" />

              <div className="absolute top-5 right-5">
                <span className="px-3 py-1 rounded-full glass text-xs font-semibold text-primary">
                  {r.tag}
                </span>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-6 text-primary-foreground">
                <h3 className="font-display text-2xl font-bold mb-2">{r.name}</h3>
                <div className="flex items-center gap-4 text-sm opacity-90">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {r.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> {r.capacity}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
