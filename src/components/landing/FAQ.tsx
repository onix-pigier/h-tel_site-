import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "Comment réserver une résidence ?", a: "Cliquez sur 'Réserver', remplissez le formulaire en ligne. Vous recevrez une confirmation par email sous 24h." },
  { q: "Quels documents fournir ?", a: "Une pièce d'identité, un justificatif d'inscription (étudiants) ou de revenus, et une caution." },
  { q: "Puis-je modifier ma réservation ?", a: "Oui, jusqu'à 7 jours avant l'arrivée depuis votre espace personnel ou par email." },
  { q: "Les services sont-ils tous inclus ?", a: "Internet, ménage hebdomadaire et accès aux espaces communs sont inclus. La restauration est en option." },
  { q: "Quelles sont les modalités de paiement ?", a: "Paiement mensuel par carte ou virement. Une caution équivalente à un mois est demandée." },
  { q: "Puis-je visiter avant de réserver ?", a: "Bien sûr. Contactez-nous pour planifier une visite virtuelle ou sur place." },
];

export const FAQ = () => {
  return (
    <section id="faq" className="py-28 gradient-ocean relative overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center mb-14"
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-5">
            FAQ
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-primary mb-4">
            Vos questions, <span className="gradient-text italic">nos réponses.</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="glass rounded-2xl border-0 px-6 shadow-soft data-[state=open]:shadow-elegant transition-shadow"
              >
                <AccordionTrigger className="font-display font-semibold text-primary hover:no-underline py-5 text-left">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};
