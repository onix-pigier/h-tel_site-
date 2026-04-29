import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

const baseUrl = process.env.NEXTAUTH_URL || "https://chanaude.ci";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Résidences Chanaude Mondoukou — Résidences Premium à Abidjan",
    template: "%s | Résidences Chanaude",
  },
  description:
    "Réservez votre résidence premium aux Résidences Chanaude Mondoukou. Cadre raffiné, services inclus, idéalement situé à Abidjan, Côte d'Ivoire.",
  keywords: [
    "résidences chanaude",
    "chanaude mondoukou",
    "résidence",
    "réservation",
    "Côte d'Ivoire",
    "Abidjan",
    "hébergement",
    "chambre",
    "logement",
    "hôtel",
  ],
  authors: [{ name: "Résidences Chanaude" }],
  creator: "Résidences Chanaude Mondoukou",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Résidences Chanaude Mondoukou — Résidences Premium",
    description:
      "Vivez une expérience résidentielle d'exception. Résidences premium, services inclus, au cœur d'Abidjan.",
    type: "website",
    locale: "fr_CI",
    url: baseUrl,
    siteName: "Résidences Chanaude",
  },
  twitter: {
    card: "summary_large_image",
    title: "Résidences Chanaude Mondoukou",
    description:
      "Réservez votre résidence premium aux Résidences Chanaude Mondoukou. Services inclus, cadre raffiné.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: "Les Résidences Chanaude Mondoukou",
    description:
      "Résidences premium pour étudiants et professionnels à Mondoukou, Abidjan, Côte d'Ivoire.",
    url: baseUrl,
    address: {
      "@type": "PostalAddress",
      addressCountry: "CI",
      addressLocality: "Abidjan",
      addressRegion: "Mondoukou",
    },
    priceRange: "25000 - 85000 FCFA",
    starRating: { "@type": "Rating", ratingValue: "4" },
  };

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#e86e24" />
        <link rel="canonical" href={baseUrl} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
