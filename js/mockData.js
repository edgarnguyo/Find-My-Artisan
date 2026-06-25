// ============================================================
//  mockData.js  —  our fake "database" of artisans.
//  Every page reads from this same array so the whole site
//  stays consistent. Each worker is one object; the objects
//  live inside one array called WORKERS.
//
//  Keep these keys (the team agreed on them):
//    id, name, skill, verified, price, photo,
//    location, bio, rating, reviews[]
//  Each review is { author, rating, comment }.
// ============================================================

const WORKERS = [
  {
    id: 1,
    name: "Wanjiru Kamau",
    skill: "Electrician",
    verified: true,
    price: "KES 2,500 – 7,000 / job",
    photo: "https://randomuser.me/api/portraits/women/36.jpg",
    location: "Westlands, Nairobi",
    bio: "Certified electrician with 8 years of experience wiring homes and small offices. I handle installations, fault-finding, and safety inspections. No job too small.",
    rating: 4.8,
    reviews: [
      { author: "Kevin O.", rating: 5, comment: "Fixed my fuse box same day. Very professional." },
      { author: "Linda W.", rating: 5, comment: "Tidy work and explained everything clearly." },
      { author: "Brian K.", rating: 4, comment: "Good job, arrived a little late but worth it." }
    ]
  },
  {
    id: 2,
    name: "Otieno Odhiambo",
    skill: "Plumber",
    verified: true,
    price: "KES 2,000 – 6,500 / job",
    photo: "https://randomuser.me/api/portraits/men/80.jpg",
    location: "Kisumu, Nyanza",
    bio: "Reliable plumber specialising in leak repairs, water heater installs, and bathroom fittings. Available on short notice for emergencies.",
    rating: 4.6,
    reviews: [
      { author: "Mary A.", rating: 5, comment: "Stopped a leak that two others couldn't. Lifesaver." },
      { author: "Joseph M.", rating: 4, comment: "Fair price and clean work." }
    ]
  },
  {
    id: 3,
    name: "Naliaka Wafula",
    skill: "Carpenter",
    verified: false,
    price: "KES 4,000 – 12,000 / job",
    photo: "https://randomuser.me/api/portraits/women/30.jpg",
    location: "Eldoret, Uasin Gishu",
    bio: "Furniture maker and finish carpenter. I build custom shelves, wardrobes, and doors. I bring samples of past work to every first meeting.",
    rating: 4.3,
    reviews: [
      { author: "Nancy W.", rating: 4, comment: "Beautiful wardrobe, very happy with it." },
      { author: "Caroline A.", rating: 5, comment: "Patient and creative. Highly recommend." },
      { author: "Hassan S.", rating: 4, comment: "Solid build quality." }
    ]
  },
  {
    id: 4,
    name: "Mutua Kioko",
    skill: "Painter",
    verified: true,
    price: "KES 2,000 – 9,000 / job",
    photo: "https://randomuser.me/api/portraits/men/55.jpg",
    location: "Nyali, Mombasa",
    bio: "Interior and exterior painting with attention to clean edges and durable finishes. I help you choose colours that match your space.",
    rating: 4.7,
    reviews: [
      { author: "Susan M.", rating: 5, comment: "Transformed our living room. Spotless finish." },
      { author: "Peter N.", rating: 4, comment: "On time and neat." }
    ]
  }
];

// Make the data usable in two situations:
// 1) A plain <script> tag in the browser (Week 1) -> attach it to `window`
//    so js/profile.js can read `window.WORKERS`.
// 2) A React `import` (Week 2) -> export it as an ES module.
if (typeof window !== "undefined") {
  window.WORKERS = WORKERS;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { WORKERS };
}
