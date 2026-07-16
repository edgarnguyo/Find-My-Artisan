import { Link } from "react-router-dom";

export default function CtaBanner() {
  return (
    <section className="cta-banner">
      <img
        src="https://picsum.photos/seed/artisan-cta/1600/700"
        alt=""
        className="cta-banner-bg"
      />
      <div className="cta-banner-overlay"></div>
      <div className="cta-banner-content">
        <h2>Got a job that needs doing?</h2>
        <p>Post what you need and hear back from verified artisans near you.</p>
        <Link to="/listings" className="btn-primary">
          Browse artisans
        </Link>
      </div>
    </section>
  );
}
