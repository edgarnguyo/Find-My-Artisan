export default function ProfileStats({ worker }) {
  return (
    <div className="profile-stats">
      <h2 className="profile-stats-title">Overview</h2>

      <div className="stats-row">
        <div className="stats-cell">
          <span className="stats-value">{worker.jobSuccess}%</span>
          <span className="stats-label">Job success</span>
        </div>
        <div className="stats-cell">
          <span className="stats-value">{worker.jobsCompleted}</span>
          <span className="stats-label">Jobs done</span>
        </div>
        <div className="stats-cell">
          <span className="stats-value">{worker.hoursWorked.toLocaleString()}</span>
          <span className="stats-label">Hours</span>
        </div>
      </div>

      <dl className="stats-list">
        <div className="stats-item">
          <dt>Total earnings</dt>
          <dd>{worker.totalEarnings}</dd>
        </div>
        <div className="stats-item">
          <dt>Availability</dt>
          <dd>{worker.hoursPerWeek}</dd>
        </div>
        <div className="stats-item">
          <dt>Languages</dt>
          <dd>
            {worker.languages.map((lang) => `${lang.name} (${lang.level})`).join(", ")}
          </dd>
        </div>
        <div className="stats-item">
          <dt>Verification</dt>
          <dd className={worker.verified ? "stats-verified" : ""}>
            {worker.verified ? "✓ ID verified" : "Not yet verified"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
