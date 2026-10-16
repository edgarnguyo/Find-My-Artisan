import Hero from "../components/Hero";
import LocationsGrid from "../components/LocationsGrid";
import HowItWorks from "../components/HowItWorks";
import WorkerPreview from "../components/WorkerPreview";
import WorkGallery from "../components/WorkGallery";
import HiringTips from "../components/HiringTips";
import CtaBanner from "../components/CtaBanner";
import { fetchWorkers } from "../api/workers";
import { fetchStats } from "../api/stats";
import { useAsync } from "../hooks/useAsync";

export default function LandingPage() {
  // Loaded once here and handed to the sections that use them, so the page
  // asks the server for each only once.
  const { data: stats } = useAsync(fetchStats);
  const { data: workers } = useAsync(fetchWorkers);

  return (
    <main>
      <Hero stats={stats} />
      <LocationsGrid workers={workers} />
      <HowItWorks />
      <WorkerPreview workers={workers} />
      <WorkGallery items={stats?.recentWork} />
      <HiringTips />
      <CtaBanner />
    </main>
  );
}
