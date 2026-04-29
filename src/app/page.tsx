"use client";

import dynamic from "next/dynamic";
import { HomePageClient as DirectHomePageClient } from "@/components/landing/HomePageClient";

const DevHomePageClient = dynamic(
  () =>
    import("@/components/landing/HomePageClient").then(
      (mod) => mod.HomePageClient
    ),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background" />,
  }
);

export default function HomePage() {
  if (process.env.NODE_ENV === "development") {
    return <DevHomePageClient />;
  }

  return <DirectHomePageClient />;
}
