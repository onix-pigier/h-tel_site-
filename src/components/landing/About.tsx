import { motion } from "framer-motion";
import { Award, Heart, Shield, Sparkles } from "lucide-react";

const values = [
  { icon: Award, title: "Excellence", desc: "Un standard hôtelier reconnu, audité chaque année." },
  { icon: Heart, title: "Hospitalité", desc: "Chaque résident est accueilli comme un invité d'honneur." },
  { icon: Shield, title: "Sécurité", desc: "Surveillance 24/7 et accès sécurisé par badge." },
  { icon: Sparkles, title: "Innovation", desc: "Plateforme moderne pour gérer votre séjour en un clic." },
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
            Notre mission : <span className="gradient-text italic">redéfinir</span> la résidence hôtelière.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Depuis plus d&apos;une décennie, les Résidences Chanaude accueillent et hébergent les talents de demain.
            Nous combinons l&apos;élégance d&apos;un hôtel cinq étoiles avec la chaleur d&apos;un foyer pensé pour
            l&apos;apprentissage et le bien-être.
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
