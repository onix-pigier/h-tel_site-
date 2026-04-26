import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

const baseUrl = process.env.NEXTAUTH_URL || "https://Hôtel.ci";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Hôtel.ci — Institut Hôtelier d'Excellence | Résidences Premium",
    template: "%s | Hôtel.ci",
  },
  description:
    "Réservez votre résidence hôtelière premium chez Hôtel.ci. Cadre raffiné, services inclus, idéalement situé. Pour étudiants et professionnels en Côte d'Ivoire.",
  keywords: [
    "hôtel",
    "résidence",
    "réservation",
    "Hôtel.ci",
    "Côte d'Ivoire",
    "Abidjan",
    "hébergement",
    "institut hôtelier",
    "chambre",
    "logement étudiant",
  ],
  authors: [{ name: "Hôtel.ci" }],
  creator: "Hôtel.ci",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Hôtel.ci — Institut Hôtelier d'Excellence",
    description:
      "Vivez une expérience résidentielle d'exception. Résidences premium, services inclus, au cœur d'Abidjan.",
    type: "website",
    locale: "fr_CI",
    url: baseUrl,
    siteName: "Hôtel.ci",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hôtel.ci — Résidences Premium",
    description:
      "Réservez votre résidence hôtelière premium chez Hôtel.ci. Services inclus, cadre raffiné.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: "Hôtel.ci",
    description:
      "Institut Hôtelier d'Excellence — Résidences premium pour étudiants et professionnels en Côte d'Ivoire.",
    url: baseUrl,
    address: {
      "@type": "PostalAddress",
      addressCountry: "CI",
      addressLocality: "Abidjan",
    },
    priceRange: "25000 - 85000 FCFA",
    starRating: { "@type": "Rating", ratingValue: "4" },
  };

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0f1e33" />
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
