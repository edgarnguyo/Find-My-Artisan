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
  const photos = SKILL_PHOTOS[worker.skill] || SKILL_PHOTOS.Electrician;

  return (
    <section className="profile-gallery-card">
      <h2>Recent work</h2>
      <div className="profile-gallery-grid">
        {photos.map((photo) => (
          <div key={photo.lock} className="profile-gallery-tile">
            <img
              src={`https://loremflickr.com/500/500/${photo.keyword}/all?lock=${photo.lock}`}
              alt={`${worker.skill} work sample`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
