import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import LocationsGrid from "../components/LocationsGrid";
import HowItWorks from "../components/HowItWorks";
import WorkerPreview from "../components/WorkerPreview";
import WorkGallery from "../components/WorkGallery";
import HiringTips from "../components/HiringTips";
import CtaBanner from "../components/CtaBanner";
import Footer from "../components/Footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <LocationsGrid />
        <HowItWorks />
        <WorkerPreview />
        <WorkGallery />
        <HiringTips />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
