import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">Find My Artisan</span>
          <p className="footer-tagline">
            Connecting skilled hands with people who need them.
          </p>
        </div>

        <nav className="footer-nav" aria-label="Footer navigation">
          <Link to="/" className="footer-link">Home</Link>
          <Link to="/listings" className="footer-link">Find Artisans</Link>
          <a href="#how-it-works" className="footer-link">How it works</a>
        </nav>
      </div>

      <div className="footer-bottom">
        <p>© {year} Find My Artisan. Built for the web.</p>
      </div>
    </footer>
  );
}
