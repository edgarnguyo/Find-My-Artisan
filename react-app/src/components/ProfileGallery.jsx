// Fallback images, used only until an artisan has uploaded their own work.
// Anything shown from `worker.portfolio` is genuinely theirs.
const SKILL_PHOTOS = {
  Electrician: [
    { keyword: "electrical,panel", lock: 101 },
    { keyword: "circuitbreaker", lock: 103 },
  ],
  Plumber: [
    { keyword: "plumber,tools", lock: 205 },
    { keyword: "pipewrench", lock: 206 },
  ],
  Carpenter: [
    { keyword: "carpentrytools", lock: 305 },
    { keyword: "woodshop", lock: 306 },
  ],
  Painter: [
    { keyword: "paintcans", lock: 406 },
    { keyword: "paintdrip", lock: 413 },
  ],
};

export default function ProfileGallery({ worker }) {
  const portfolio = worker.portfolio ?? [];

  if (portfolio.length > 0) {
    return (
      <section className="profile-gallery-card">
        <h2>Recent work</h2>
        <div className="profile-gallery-grid">
          {portfolio.map((item) => (
            <figure key={item.id} className="profile-gallery-tile">
              <img
                src={item.imageUrl}
                alt={item.caption ?? `Work by ${worker.name}`}
                loading="lazy"
              />
              {item.caption && <figcaption>{item.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </section>
    );
  }

  const photos = SKILL_PHOTOS[worker.skill] || SKILL_PHOTOS.Electrician;

  return (
    <section className="profile-gallery-card">
      <h2>Recent work</h2>
      <p className="gallery-placeholder-note">
        {worker.name} has not uploaded photos yet — these show the kind of work
        a {worker.skill.toLowerCase()} takes on.
      </p>
      <div className="profile-gallery-grid">
        {photos.map((photo) => (
          <figure key={photo.lock} className="profile-gallery-tile">
            <img
              src={`https://loremflickr.com/700/700/${photo.keyword}/all?lock=${photo.lock}`}
              alt={`${worker.skill} work`}
              loading="lazy"
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
