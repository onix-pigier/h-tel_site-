"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { About } from "@/components/landing/About";
import { Services } from "@/components/landing/Services";
import { Residences } from "@/components/landing/Residences";
import { FAQ } from "@/components/landing/FAQ";
import { Location } from "@/components/landing/Location";
import { Footer } from "@/components/landing/Footer";

const ReservationModal = dynamic(
  () =>
    import("@/components/landing/ReservationModal").then(
      (mod) => mod.ReservationModal
    ),
  { ssr: false }
);

export default function HomePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const open = () => setModalOpen(true);

  return (
    <div className="min-h-screen bg-background">
      <Navbar onReserve={open} />
      <main>
        <Hero onReserve={open} />
        <About />
        <Services />
        <Residences />
        <FAQ />
        <Location />
      </main>
      <Footer onReserve={open} />
      <ReservationModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
