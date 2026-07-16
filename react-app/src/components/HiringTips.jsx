const TIPS = [
  {
    icon: "🛡️",
    title: "Check verification",
    description:
      "Prefer artisans with the verified badge — it means their identity has been confirmed.",
  },
  {
    icon: "💬",
    title: "Compare quotes",
    description:
      "Message two or three artisans before committing, so you know a fair price.",
  },
  {
    icon: "⭐",
    title: "Read recent reviews",
    description:
      "Reviews from the last few months tell you more than an overall rating alone.",
  },
  {
    icon: "📝",
    title: "Agree the scope",
    description:
      "Write down what's included before work starts, so expectations match on both sides.",
  },
];

export default function HiringTips() {
  return (
    <section className="tips-section" id="tips">
      <div className="section-header">
        <span className="section-eyebrow">Before you book</span>
        <h2 className="section-title">Hire smart</h2>
        <p className="section-sub">
          A few things worth checking before you confirm a job.
        </p>
      </div>

      <div className="tips-grid">
        {TIPS.map((tip) => (
          <div key={tip.title} className="tip-card">
            <div className="tip-icon">{tip.icon}</div>
            <h3 className="tip-title">{tip.title}</h3>
            <p className="tip-desc">{tip.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
