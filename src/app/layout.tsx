import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

const baseUrl = process.env.NEXTAUTH_URL || "https://chanaude.ci";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Résidences Les Chanaudes Mondoukou — Résidences Premium Bassam",
    template: "%s | Résidences Les Chanaudes",
  },
  description:
    "Réservez votre résidence premium aux Résidences les Chanaudes. Cadre raffiné, services inclus, idéalement situé à Abidjan, Côte d'Ivoire.",
  keywords: [
    "Lees chanaudes",
    "résidences les chanaudes",
    "résidences chanaude",
    "residence chanaude mondoukou",
    "chanaudes mondoukou",
    "résidence",
    "réservation",
    "Côte d'Ivoire",
    "Abidjan",
    "Bassam",
    "hébergement",
    "chambre",
    "logement",
    "hôtel",
  ],
  authors: [{ name: "Résidences Les Chanaudes" }],
  creator: "Résidences Les Chanaudes ",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Résidences Les Chanaudes — Résidences Premium",
    description:
      "Vivez une expérience résidentielle d'exception. Résidences premium, services inclus, à Bassam.",
    type: "website",
    locale: "fr_CI",
    url: baseUrl,
    siteName: "Résidences Les Chanaudes",
  },
  twitter: {
    card: "summary_large_image",
    title: "Résidences Les Chanaudes",
    description:
      "Réservez votre résidence aux Résidences Les Chanaudes. Services inclus, cadre raffiné.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: "Les Résidences Les Chanaudes",
    description:
      "Résidences ideals pour vous détendre en famille ou entre amis.",
    url: baseUrl,
    address: {
      "@type": "PostalAddress",
      addressCountry: "CI",
      addressLocality: "Bassam",
      addressRegion: "Bassam",
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
