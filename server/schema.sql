-- Creates the Find My Artisan database and fills it with the artisan catalogue.
-- Rows are copied from supabase/seed.sql so both databases hold the same artisans.
-- Run from the server/ folder:  mysql -u root < schema.sql
-- Safe to re-run: it drops and recreates the artisans table each time.

-- The mysql CLI may send this file as latin1, which turns the – in prices into â€“.
-- This tells the server the bytes that follow are UTF-8.
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS find_my_artisan;
USE find_my_artisan;

DROP TABLE IF EXISTS artisans;

CREATE TABLE artisans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  skill VARCHAR(50) NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  price VARCHAR(50),
  photo VARCHAR(255),
  location VARCHAR(100) NOT NULL,
  bio TEXT,
  rating DECIMAL(2,1),
  job_success INT,
  hours_per_week VARCHAR(50),
  total_earnings VARCHAR(50),
  jobs_completed INT DEFAULT 0,
  hours_worked INT DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO artisans (id, name, skill, verified, price, photo, location, bio, rating, job_success, hours_per_week, total_earnings, jobs_completed, hours_worked) values
  (1, 'Wanjiru Kamau', 'Electrician', true, 'KES 2,500 – 7,000 / job', 'https://randomuser.me/api/portraits/women/16.jpg', 'Westlands, Nairobi', 'Certified electrician with 8 years of experience wiring homes and small offices. I handle installations, fault-finding, and safety inspections. No job too small.', 4.8, 100, 'More than 30 hrs/week', 'KES 900K+', 36, 1492),
  (2, 'Kiptoo Ruto', 'Electrician', true, 'KES 2,200 – 6,800 / job', 'https://randomuser.me/api/portraits/men/16.jpg', 'Kasarani, Nairobi', 'Residential and commercial electrician focused on clean, code-compliant wiring and quick fault diagnosis.', 4.6, 96, 'More than 30 hrs/week', 'KES 500K+', 24, 980),
  (3, 'Achieng Nyambura', 'Plumber', true, 'KES 1,800 – 6,000 / job', 'https://randomuser.me/api/portraits/women/6.jpg', 'Embakasi, Nairobi', 'Plumber handling leak repairs, borehole connections, and bathroom installations across Nairobi''s eastlands.', 4.7, 98, 'More than 30 hrs/week', 'KES 650K+', 31, 1120),
  (4, 'Kevin Mwangi', 'Plumber', false, 'KES 2,000 – 6,500 / job', 'https://randomuser.me/api/portraits/men/25.jpg', 'Ngong Road, Nairobi', 'General plumbing repairs and installations, available for emergency call-outs on short notice.', 4.3, 90, 'Less than 30 hrs/week', 'KES 220K+', 14, 410),
  (5, 'Njeri Kariuki', 'Carpenter', true, 'KES 3,500 – 11,000 / job', 'https://randomuser.me/api/portraits/women/36.jpg', 'Kilimani, Nairobi', 'Furniture maker and fitted-wardrobe specialist. I design pieces around the space rather than forcing standard sizes.', 4.9, 100, 'More than 30 hrs/week', 'KES 1.1M+', 42, 1780),
  (6, 'Baraka Mwadime', 'Carpenter', true, 'KES 3,000 – 9,500 / job', 'https://randomuser.me/api/portraits/men/2.jpg', 'Lang''ata, Nairobi', 'General carpentry and door/window frame repairs, with a focus on quick turnarounds for rental units.', 4.4, 93, 'Less than 30 hrs/week', 'KES 300K+', 19, 640),
  (7, 'Faith Chebet', 'Painter', true, 'KES 2,200 – 8,500 / job', 'https://randomuser.me/api/portraits/women/62.jpg', 'Ruaka, Nairobi', 'Interior and exterior painter with an eye for clean lines and colour matching for resale-ready finishes.', 4.7, 97, 'More than 30 hrs/week', 'KES 480K+', 27, 890),
  (8, 'Dennis Omondi', 'Painter', false, 'KES 2,000 – 7,000 / job', 'https://randomuser.me/api/portraits/men/30.jpg', 'South B, Nairobi', 'Affordable, reliable painting for homes and small shops, with weekend availability.', 4.1, 88, 'Less than 30 hrs/week', 'KES 150K+', 11, 320),
  (9, 'Mutua Kioko', 'Painter', true, 'KES 2,000 – 9,000 / job', 'https://randomuser.me/api/portraits/men/53.jpg', 'Nyali, Mombasa', 'Interior and exterior painting with attention to clean edges and durable finishes. I help you choose colours that match your space.', 4.7, 99, 'More than 30 hrs/week', 'KES 700K+', 33, 1250),
  (10, 'Halima Juma', 'Electrician', true, 'KES 2,300 – 7,200 / job', 'https://randomuser.me/api/portraits/women/69.jpg', 'Bamburi, Mombasa', 'Electrician specialising in solar backup setups and standard household wiring for coastal homes.', 4.8, 100, 'More than 30 hrs/week', 'KES 600K+', 29, 1080),
  (11, 'Charo Mwakio', 'Electrician', false, 'KES 2,000 – 6,500 / job', 'https://randomuser.me/api/portraits/men/54.jpg', 'Likoni, Mombasa', 'General electrical repairs and new installations for homes and small businesses.', 4.2, 91, 'Less than 30 hrs/week', 'KES 180K+', 13, 360),
  (12, 'Zawadi Salim', 'Plumber', true, 'KES 1,900 – 6,200 / job', 'https://loremflickr.com/500/500/african,woman,headshot/all?lock=3', 'Tudor, Mombasa', 'Plumbing installations and repairs, with experience fitting water tanks and pressure pumps.', 4.6, 97, 'More than 30 hrs/week', 'KES 420K+', 22, 760),
  (13, 'Omar Bakari', 'Carpenter', true, 'KES 3,200 – 10,500 / job', 'https://randomuser.me/api/portraits/men/55.jpg', 'Kizingo, Mombasa', 'Custom furniture and coastal-style woodwork, including verandah seating and outdoor pieces.', 4.8, 98, 'More than 30 hrs/week', 'KES 550K+', 26, 940),
  (14, 'Rehema Athman', 'Carpenter', false, 'KES 3,000 – 9,000 / job', 'https://randomuser.me/api/portraits/women/92.jpg', 'Mtwapa, Mombasa', 'Furniture repair and small joinery jobs, working out of a home workshop in Mtwapa.', 4.3, 92, 'Less than 30 hrs/week', 'KES 190K+', 15, 480),
  (15, 'Otieno Odhiambo', 'Plumber', true, 'KES 2,000 – 6,500 / job', 'https://randomuser.me/api/portraits/men/59.jpg', 'Kisumu, Nyanza', 'Reliable plumber specialising in leak repairs, water heater installs, and bathroom fittings. Available on short notice for emergencies.', 4.6, 96, 'More than 30 hrs/week', 'KES 520K+', 25, 910),
  (16, 'Brenda Anyango', 'Plumber', true, 'KES 1,800 – 5,800 / job', 'https://loremflickr.com/500/500/african,woman,headshot/all?lock=1', 'Milimani, Kisumu', 'Plumbing repairs and new bathroom fittings, working mostly around Milimani and Nyalenda.', 4.5, 94, 'More than 30 hrs/week', 'KES 340K+', 20, 700),
  (17, 'Collins Owino', 'Electrician', true, 'KES 2,100 – 6,900 / job', 'https://randomuser.me/api/portraits/men/83.jpg', 'Nyalenda, Kisumu', 'Electrician handling home wiring, meter box upgrades, and appliance connections.', 4.5, 95, 'Less than 30 hrs/week', 'KES 260K+', 17, 560),
  (18, 'Mercy Adhiambo', 'Carpenter', false, 'KES 3,000 – 9,800 / job', 'https://loremflickr.com/500/500/nigerian,woman,portrait/all?lock=101', 'Kondele, Kisumu', 'Carpentry and furniture repair, with a focus on affordable custom shelving for small homes.', 4.2, 89, 'Less than 30 hrs/week', 'KES 140K+', 10, 300),
  (19, 'Tom Okoth', 'Painter', true, 'KES 2,100 – 8,000 / job', 'https://randomuser.me/api/portraits/men/70.jpg', 'Mamboleo, Kisumu', 'Interior and exterior painter, comfortable with both residential and small commercial jobs.', 4.6, 96, 'More than 30 hrs/week', 'KES 380K+', 21, 780),
  (20, 'Naliaka Wafula', 'Carpenter', false, 'KES 4,000 – 12,000 / job', 'https://randomuser.me/api/portraits/women/36.jpg', 'Section 58, Nakuru', 'Furniture maker and finish carpenter. I build custom shelves, wardrobes, and doors. I bring samples of past work to every first meeting.', 4.3, 90, 'More than 30 hrs/week', 'KES 310K+', 18, 650),
  (21, 'Peter Kiplagat', 'Electrician', true, 'KES 2,200 – 7,000 / job', 'https://randomuser.me/api/portraits/men/80.jpg', 'Milimani, Nakuru', 'Electrician covering home installations and farmhouse wiring across the Nakuru area.', 4.7, 97, 'More than 30 hrs/week', 'KES 470K+', 24, 860),
  (22, 'Grace Wambui', 'Plumber', true, 'KES 1,900 – 6,000 / job', 'https://loremflickr.com/500/500/nigerian,woman,portrait/all?lock=101', 'Free Area, Nakuru', 'Plumbing repairs, water tank installations, and drainage fixes for homes and small offices.', 4.4, 93, 'Less than 30 hrs/week', 'KES 210K+', 16, 520),
  (23, 'Samuel Kimutai', 'Painter', false, 'KES 2,000 – 7,500 / job', 'https://randomuser.me/api/portraits/men/91.jpg', 'London Estate, Nakuru', 'Painter offering interior and exterior work, with flexible scheduling for weekend jobs.', 4, 87, 'Less than 30 hrs/week', 'KES 120K+', 9, 260);

-- Accounts are created by Supabase Auth; React copies each new one here through
-- POST /api/users. There is no password column: Supabase keeps the password.
-- IF NOT EXISTS with no DROP, so re-running this file keeps the users already saved.
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
