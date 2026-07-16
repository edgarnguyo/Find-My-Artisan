const steps = [
  {
    icon: "🔍",
    title: "Search & filter",
    description:
      "Browse artisans by skill, location, or name. Filter down to exactly who you need in seconds.",
  },
  {
    icon: "📋",
    title: "View profiles & reviews",
    description:
      "Check verified badges, read real customer reviews, and compare prices before you decide.",
  },
  {
    icon: "📞",
    title: "Book & get it done",
    description:
      "Send a booking request directly from the profile page. The artisan contacts you to confirm.",
  },
];

export default function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="section-header">
        <span className="section-eyebrow">Simple process</span>
        <h2 className="section-title">How it works</h2>
        <p className="section-sub">
          Three steps from search to sorted.
        </p>
      </div>

      <div className="steps-grid">
        {steps.map((step, index) => (
          <div key={index} className="step-card">
            <div className="step-icon">{step.icon}</div>
            <h3 className="step-title">{step.title}</h3>
            <p className="step-desc">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
