export default function ProfileWorkHistory({ history }) {
  if (!history || history.length === 0) return null;

  return (
    <section className="profile-history">
      <h2>Work history</h2>
      <ul className="history-list">
        {history.map((job, index) => (
          <li key={index} className="history-item">
            <div className="history-top">
              <h3 className="history-title">{job.title}</h3>
              <span className="history-price">{job.price}</span>
            </div>
            <div className="history-meta">
              <span className="history-stars">
                {"★".repeat(job.rating)}
                {"☆".repeat(5 - job.rating)}
              </span>
              <span className="history-date">{job.dateRange}</span>
              <span className="history-type">{job.priceType}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
