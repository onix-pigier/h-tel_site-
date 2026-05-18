import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

const baseUrl = process.env.NEXTAUTH_URL || "https://chanaude.ci";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Résidences Les Chanaude  — Résidences à Bassam, Abidjan",
    template: "%s | Résidences Les Chanaude",
  },
  description:
    "Réservez votre résidence aux Résidences les Chanaude. Cadre raffiné, services inclus, idéalement situé à Abidjan, Côte d'Ivoire.",
  keywords: [
    "Lees Chanaude",
    "résidences les Chanaude",
    "résidences chanaude",
    "residence chanaude mondoukou",
    "Chanaude mondoukou",
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
  authors: [{ name: "Résidences Les Chanaude" }],
  creator: "Résidences Les Chanaude ",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Résidences Les Chanaude — Résidences Premium",
    description:
      "Vivez une expérience résidentielle d'exception. Résidences premium, services inclus, à Bassam.",
    type: "website",
    locale: "fr_CI",
    url: baseUrl,
    siteName: "Résidences Les Chanaude",
  },
  twitter: {
    card: "summary_large_image",
    title: "Résidences Les Chanaude",
    description:
      "Réservez votre résidence aux Résidences Les Chanaude. Services inclus, cadre raffiné.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: "Les Résidences Les Chanaude",
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
