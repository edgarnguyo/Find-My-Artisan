// Artisans who just signed up have no job success, availability or
// languages yet, so those show a dash instead of an empty value.
const EMPTY = "—";

export default function ProfileStats({ worker }) {
  return (
    <div className="profile-stats">
      <h2 className="profile-stats-title">Overview</h2>

      <div className="stats-row">
        <div className="stats-cell">
          <span className="stats-value">
            {worker.jobSuccess != null ? `${worker.jobSuccess}%` : EMPTY}
          </span>
          <span className="stats-label">Job Success</span>
        </div>
        <div className="stats-cell">
          <span className="stats-value">{worker.jobsCompleted}</span>
          <span className="stats-label">Jobs Done</span>
        </div>
        <div className="stats-cell">
          <span className="stats-value">{worker.hoursWorked.toLocaleString()}</span>
          <span className="stats-label">Hours</span>
        </div>
      </div>

      <dl className="stats-list">
        <div className="stats-item">
          <dt>Availability</dt>
          <dd>{worker.hoursPerWeek ?? EMPTY}</dd>
        </div>
        <div className="stats-item">
          <dt>Languages</dt>
          <dd>
            {worker.languages.length > 0
              ? worker.languages.map((lang) => `${lang.name} (${lang.level})`).join(", ")
              : EMPTY}
          </dd>
        </div>
        <div className="stats-item">
          <dt>Verification</dt>
          <dd className={worker.verified ? "stats-verified" : ""}>
            {worker.verified ? "✓ Certificate verified" : "Not yet verified"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
