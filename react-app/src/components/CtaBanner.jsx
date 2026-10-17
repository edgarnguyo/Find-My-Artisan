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
        <h2>Got a Job That Needs Doing?</h2>
        <p>Find a verified artisan near you and send a request in a couple of minutes.</p>
        <Link to="/listings" className="btn-primary">
          Browse Artisans
        </Link>
      </div>
    </section>
  );
}
