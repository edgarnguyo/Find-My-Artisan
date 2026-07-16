const PHOTOS = [
  { caption: "Interior painting", keyword: "paintcans", lock: 406 },
  { caption: "Custom carpentry", keyword: "woodshop", lock: 306 },
  { caption: "Home wiring", keyword: "electrical,panel", lock: 101 },
];

export default function WorkGallery() {
  return (
    <section className="gallery-section" id="gallery">
      <div className="section-header">
        <span className="section-eyebrow">Recent work</span>
        <h2 className="section-title">A look at finished jobs</h2>
        <p className="section-sub">Real work, done by artisans on the platform.</p>
      </div>

      <div className="gallery-grid">
        {PHOTOS.map((photo) => (
          <div key={photo.lock} className="gallery-tile">
            <img
              src={`https://loremflickr.com/700/700/${photo.keyword}/all?lock=${photo.lock}`}
              alt={photo.caption}
            />
            <span className="gallery-caption">{photo.caption}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
