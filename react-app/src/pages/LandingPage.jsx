// src/pages/LandingPage.jsx
// Person A owns this page.
//
// This is the shell that composes Person A's components.
// It does nothing itself — it just arranges the building blocks in order.
// This is the "app shell" the brief describes: the structure every
// other section sits inside.

import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import HowItWorks from "../components/HowItWorks";
import WorkerPreview from "../components/WorkerPreview";
import Footer from "../components/Footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <WorkerPreview />
      </main>
      <Footer />
    </>
  );
}
