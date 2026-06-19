// A component is just a function that returns JSX (HTML-like syntax).
// It receives a single argument called "props" — an object containing
// whatever the parent passed in. We destructure it immediately so we
// can write `name` instead of `props.name` everywhere.

export default function ProfileHeader({ worker }) {
  return (
    <header className="profile-header">
      <img
        className="profile-photo"
        src={worker.photo}
        alt={`Photo of ${worker.name}`}
      />
      <div className="profile-info">
        <h1 className="profile-name">
          {worker.name}
          {/* Conditional rendering: if worker.verified is true, show the badge.
              The && operator short-circuits — if the left side is false,
              the right side (the JSX) is never rendered at all. */}
          {worker.verified && (
            <span className="badge">✓ Verified</span>
          )}
        </h1>
        <p className="profile-skill">{worker.skill}</p>
        <p className="profile-location">📍 {worker.location}</p>
        <p className="profile-price">{worker.price}</p>
      </div>
    </header>
  );
}
