import Avatar from "./Avatar";

export default function ProfileHeader({ worker }) {
  return (
    <header className="profile-header">
      <Avatar name={worker.name} className="profile-photo" />
      <div className="profile-info">
        <h1 className="profile-name">
          {worker.name}
          {worker.verified && (
            <span className="badge">✓ Verified</span>
          )}
        </h1>
        <p className="profile-skill">{worker.skill}</p>
        <p className="profile-location">📍 {worker.location}</p>

        <div className="profile-header-meta">
          <span className="profile-rating">⭐ {worker.rating} rating</span>
          <span className="profile-success">{worker.jobSuccess}% job success</span>
          <span className="profile-price">{worker.price}</span>
        </div>
      </div>

      <a href="#booking" className="btn-primary profile-header-cta">
        Request this artisan
      </a>
    </header>
  );
}
