-- Find My Artisan database (lab Step 3).
-- Run it from the server/ folder:  mysql -u root < schema.sql
-- It creates the tables and adds the 23 sample artisans. Running it again is
-- safe: existing tables and rows, including people who signed up, are kept.
--
-- Rows typed into the website are added by the POST routes, not by this file:
--   sign up as a client   -> INSERT INTO clients   in server/routes/clients.js
--   sign up as an artisan -> INSERT INTO artisans  in server/routes/artisans.js
--   booking request       -> INSERT INTO bookings  in server/routes/bookings.js

-- The mysql CLI may send this file as latin1, which turns the – in prices into â€“.
-- This tells the server the bytes that follow are UTF-8.
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS find_my_artisan;
USE find_my_artisan;

-- People who book artisans.
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  -- Saved exactly as typed, to keep the lab simple. A real site would store a
  -- hash of the password instead.
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  location VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artisans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  -- email and password are NULL for the sample artisans, which have no login.
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  skill VARCHAR(50) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The next three tables belong to an artisan: artisan_id must match an artisans.id.
CREATE TABLE IF NOT EXISTS languages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artisan_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  level VARCHAR(50) NOT NULL,
  FOREIGN KEY (artisan_id) REFERENCES artisans(id)
);

CREATE TABLE IF NOT EXISTS work_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artisan_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  rating INT,
  date_range VARCHAR(50),
  price VARCHAR(50),
  price_type VARCHAR(50),
  FOREIGN KEY (artisan_id) REFERENCES artisans(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artisan_id INT NOT NULL,
  author VARCHAR(100) NOT NULL,
  rating INT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artisan_id) REFERENCES artisans(id)
);

-- ---------------------------------------------------------------------------
-- Reviews Meditrac posts through the API are marked from_api = TRUE. The API
-- only lets reviews with this mark be edited or deleted, so the sample reviews
-- that come with the site can't be changed or removed through it.
-- ---------------------------------------------------------------------------
SET @add = IF((SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'reviews' AND column_name = 'from_api') = 0,
              'ALTER TABLE reviews ADD COLUMN from_api BOOLEAN NOT NULL DEFAULT FALSE', 'DO 0');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artisan_id INT NOT NULL,
  -- NULL when someone books without signing in.
  client_id INT,
  name VARCHAR(100) NOT NULL,
  contact VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  budget VARCHAR(100),
  job TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artisan_id) REFERENCES artisans(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Sample artisans (ids 1-23). INSERT IGNORE skips a row whose id already
-- exists, so running this file again doesn't add them twice.
INSERT IGNORE INTO artisans (id, name, skill, verified, price, photo, location, bio, rating, job_success, hours_per_week, total_earnings, jobs_completed, hours_worked) values
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

-- Their languages, work history and reviews have no fixed ids, so the old copies
-- are removed first; otherwise every re-run would add them again.
DELETE FROM languages    WHERE artisan_id BETWEEN 1 AND 23;
DELETE FROM work_history WHERE artisan_id BETWEEN 1 AND 23;
DELETE FROM reviews      WHERE artisan_id BETWEEN 1 AND 23 AND from_api = FALSE;

INSERT INTO languages (artisan_id, name, level) values
  (1, 'English', 'Fluent'),
  (1, 'Swahili', 'Native'),
  (2, 'English', 'Fluent'),
  (2, 'Swahili', 'Native'),
  (3, 'English', 'Conversational'),
  (3, 'Swahili', 'Native'),
  (4, 'English', 'Fluent'),
  (4, 'Swahili', 'Native'),
  (5, 'English', 'Fluent'),
  (5, 'Swahili', 'Native'),
  (6, 'English', 'Conversational'),
  (6, 'Swahili', 'Native'),
  (7, 'English', 'Fluent'),
  (7, 'Swahili', 'Native'),
  (8, 'English', 'Conversational'),
  (8, 'Swahili', 'Native'),
  (9, 'English', 'Fluent'),
  (9, 'Swahili', 'Native'),
  (10, 'English', 'Fluent'),
  (10, 'Swahili', 'Native'),
  (11, 'English', 'Conversational'),
  (11, 'Swahili', 'Native'),
  (12, 'English', 'Fluent'),
  (12, 'Swahili', 'Native'),
  (13, 'English', 'Fluent'),
  (13, 'Swahili', 'Native'),
  (14, 'English', 'Conversational'),
  (14, 'Swahili', 'Native'),
  (15, 'English', 'Fluent'),
  (15, 'Swahili', 'Native'),
  (16, 'English', 'Fluent'),
  (16, 'Swahili', 'Native'),
  (17, 'English', 'Fluent'),
  (17, 'Swahili', 'Native'),
  (17, 'Luo', 'Native'),
  (18, 'English', 'Conversational'),
  (18, 'Swahili', 'Native'),
  (19, 'English', 'Fluent'),
  (19, 'Swahili', 'Native'),
  (20, 'English', 'Fluent'),
  (20, 'Swahili', 'Native'),
  (21, 'English', 'Fluent'),
  (21, 'Swahili', 'Native'),
  (21, 'Kalenjin', 'Native'),
  (22, 'English', 'Fluent'),
  (22, 'Swahili', 'Native'),
  (23, 'English', 'Conversational'),
  (23, 'Swahili', 'Native');

INSERT INTO work_history (artisan_id, title, rating, date_range, price, price_type) values
  (1, 'Full rewire of 3-bedroom bungalow', 5, 'Jan 2025 - Feb 2025', 'KES 18,000', 'Fixed price'),
  (1, 'Fuse box replacement and safety inspection', 5, 'Nov 2024 - Nov 2024', 'KES 6,500', 'Fixed price'),
  (2, 'Office lighting upgrade', 5, 'Mar 2025 - Mar 2025', 'KES 9,200', 'Fixed price'),
  (2, 'Generator changeover switch install', 4, 'Dec 2024 - Dec 2024', 'KES 7,000', 'Fixed price'),
  (3, 'Bathroom re-piping', 5, 'Feb 2025 - Feb 2025', 'KES 15,000', 'Fixed price'),
  (3, 'Kitchen sink and tap installation', 4, 'Oct 2024 - Oct 2024', 'KES 4,500', 'Fixed price'),
  (4, 'Emergency leak repair', 4, 'Apr 2025 - Apr 2025', 'KES 3,200', 'Fixed price'),
  (4, 'Water heater installation', 4, 'Jan 2025 - Jan 2025', 'KES 6,000', 'Fixed price'),
  (5, 'Built-in wardrobe for master bedroom', 5, 'Feb 2025 - Mar 2025', 'KES 32,000', 'Fixed price'),
  (5, 'Custom TV unit and shelving', 5, 'Dec 2024 - Dec 2024', 'KES 21,000', 'Fixed price'),
  (6, 'Door and frame replacement, 4 units', 4, 'Mar 2025 - Mar 2025', 'KES 14,000', 'Fixed price'),
  (7, 'Full interior repaint, 3-bed apartment', 5, 'Jan 2025 - Jan 2025', 'KES 22,000', 'Fixed price'),
  (7, 'Exterior perimeter wall painting', 4, 'Nov 2024 - Nov 2024', 'KES 16,000', 'Fixed price'),
  (8, 'Shopfront repaint', 4, 'Feb 2025 - Feb 2025', 'KES 8,000', 'Fixed price'),
  (9, 'Beachfront villa exterior repaint', 5, 'Feb 2025 - Mar 2025', 'KES 45,000', 'Fixed price'),
  (9, 'Living room and hallway repaint', 4, 'Dec 2024 - Dec 2024', 'KES 12,000', 'Fixed price'),
  (10, 'Solar backup and inverter wiring', 5, 'Mar 2025 - Mar 2025', 'KES 28,000', 'Fixed price'),
  (10, 'Whole-house rewire', 5, 'Sep 2024 - Oct 2024', 'KES 24,000', 'Fixed price'),
  (11, 'Shop rewiring and socket install', 4, 'Jan 2025 - Jan 2025', 'KES 9,500', 'Fixed price'),
  (12, 'Rooftop tank and pressure pump install', 5, 'Feb 2025 - Feb 2025', 'KES 19,000', 'Fixed price'),
  (12, 'Bathroom leak repair', 4, 'Nov 2024 - Nov 2024', 'KES 3,800', 'Fixed price'),
  (13, 'Verandah seating set', 5, 'Mar 2025 - Mar 2025', 'KES 27,000', 'Fixed price'),
  (13, 'Kitchen cabinet refit', 4, 'Dec 2024 - Jan 2025', 'KES 19,500', 'Fixed price'),
  (14, 'Dining table repair and refinish', 4, 'Feb 2025 - Feb 2025', 'KES 6,500', 'Fixed price'),
  (15, 'Water heater install and pipe insulation', 5, 'Feb 2025 - Feb 2025', 'KES 11,000', 'Fixed price'),
  (15, 'Emergency leak repair, apartment block', 4, 'Dec 2024 - Dec 2024', 'KES 4,200', 'Fixed price'),
  (16, 'Bathroom fittings replacement', 5, 'Jan 2025 - Jan 2025', 'KES 9,000', 'Fixed price'),
  (17, 'Meter box upgrade and safety check', 5, 'Mar 2025 - Mar 2025', 'KES 8,500', 'Fixed price'),
  (18, 'Custom shelving unit', 4, 'Feb 2025 - Feb 2025', 'KES 7,200', 'Fixed price'),
  (19, 'Apartment block common areas repaint', 5, 'Jan 2025 - Feb 2025', 'KES 26,000', 'Fixed price'),
  (20, 'Custom wardrobe build', 4, 'Mar 2025 - Mar 2025', 'KES 24,000', 'Fixed price'),
  (20, 'Panelled door replacement, 3 rooms', 5, 'Dec 2024 - Dec 2024', 'KES 15,000', 'Fixed price'),
  (21, 'Farmhouse wiring and borehole pump connection', 5, 'Feb 2025 - Mar 2025', 'KES 21,000', 'Fixed price'),
  (22, 'Drainage fix and water tank install', 4, 'Jan 2025 - Jan 2025', 'KES 10,500', 'Fixed price'),
  (23, 'Two-bedroom house repaint', 4, 'Mar 2025 - Mar 2025', 'KES 13,000', 'Fixed price');

INSERT INTO reviews (artisan_id, author, rating, comment) values
  (1, 'Kevin O.', 5, 'Fixed my fuse box same day. Very professional.'),
  (1, 'Linda W.', 5, 'Tidy work and explained everything clearly.'),
  (1, 'Brian K.', 4, 'Good job, arrived a little late but worth it.'),
  (2, 'Alice N.', 5, 'Sorted our office wiring fast, no comebacks.'),
  (3, 'Grace M.', 5, 'Found and fixed a hidden leak others missed.'),
  (4, 'Peter N.', 4, 'Came out same evening, sorted the leak.'),
  (5, 'Sarah K.', 5, 'Exceptional finish, exactly what we sketched out.'),
  (6, 'Moses T.', 4, 'Solid work, kept to the timeline.'),
  (7, 'Janet A.', 5, 'Neat edges, no drips, finished on schedule.'),
  (8, 'Wesley O.', 4, 'Fair price, decent finish.'),
  (9, 'Susan M.', 5, 'Transformed our living room. Spotless finish.'),
  (9, 'Peter N.', 4, 'On time and neat.'),
  (10, 'Fatuma R.', 5, 'Explained the solar setup clearly, very patient.'),
  (11, 'Ali H.', 4, 'Got the job done, a bit of back and forth on timing.'),
  (12, 'Neema K.', 5, 'Water pressure finally sorted after months of issues.'),
  (13, 'Hassan M.', 5, 'Beautiful coastal-style finish, exactly what we wanted.'),
  (14, 'Amina S.', 4, 'Table looks brand new again.'),
  (15, 'Mary A.', 5, 'Stopped a leak that two others couldn''t. Lifesaver.'),
  (15, 'Joseph M.', 4, 'Fair price and clean work.'),
  (16, 'Caren O.', 4, 'Good communication, arrived when promised.'),
  (17, 'Dorcas A.', 4, 'Quick and tidy, would call again.'),
  (18, 'Vincent O.', 4, 'Good value, simple honest work.'),
  (19, 'Beatrice N.', 5, 'Managed a big job well, good crew.'),
  (20, 'Nancy W.', 4, 'Beautiful wardrobe, very happy with it.'),
  (20, 'Caroline A.', 5, 'Patient and creative. Highly recommend.'),
  (20, 'Hassan S.', 4, 'Solid build quality.'),
  (21, 'Esther C.', 5, 'Handled a complicated farm setup with no issues.'),
  (22, 'Daniel K.', 4, 'Reasonable price and got it right first time.'),
  (23, 'Ruth M.', 4, 'Did a fair job, took a bit longer than quoted.');

-- ---------------------------------------------------------------------------
-- Week 5: data the API contract (openapi.yaml) promises that the tables above
-- didn't have: county, phone, hourly rate and certificate details.
-- ---------------------------------------------------------------------------

-- MySQL has no "ADD COLUMN IF NOT EXISTS", so each column is added only when
-- information_schema says it's missing. That keeps this file safe to re-run.
SET @add = IF((SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'artisans' AND column_name = 'county') = 0,
              'ALTER TABLE artisans ADD COLUMN county VARCHAR(50)', 'DO 0');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add = IF((SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'artisans' AND column_name = 'phone') = 0,
              'ALTER TABLE artisans ADD COLUMN phone VARCHAR(20)', 'DO 0');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add = IF((SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'artisans' AND column_name = 'hourly_rate_kes') = 0,
              'ALTER TABLE artisans ADD COLUMN hourly_rate_kes INT', 'DO 0');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- County is the part of location after the comma ("Westlands, Nairobi" -> Nairobi).
-- Artisan 15's location ends in "Nyanza", an old province, so it's set by hand.
UPDATE artisans SET county = TRIM(SUBSTRING_INDEX(location, ',', -1)) WHERE county IS NULL;
UPDATE artisans SET county = 'Kisumu' WHERE id = 15;

-- location now holds only the area ("Embakasi"); the county has its own column.
-- Runs after county is filled in above, so nothing is lost. Rows without a comma
-- are already in the new format and are left alone.
UPDATE artisans SET location = TRIM(SUBSTRING_INDEX(location, ',', 1)) WHERE location LIKE '%,%';

-- Sample phone numbers and hourly rates for the 23 sample artisans.
UPDATE artisans SET phone = CONCAT('+2547120000', LPAD(id, 2, '0')) WHERE id BETWEEN 1 AND 23 AND phone IS NULL;
UPDATE artisans SET hourly_rate_kes = CASE skill
    WHEN 'Plumber' THEN 800 WHEN 'Electrician' THEN 900
    WHEN 'Carpenter' THEN 1000 WHEN 'Painter' THEN 700 END
  WHERE id BETWEEN 1 AND 23 AND hourly_rate_kes IS NULL;

-- One certificate per verified artisan. artisan_id is the primary key, so an
-- artisan can't have two, and INSERT IGNORE skips rows that already exist.
CREATE TABLE IF NOT EXISTS verifications (
  artisan_id INT PRIMARY KEY,
  issuing_body VARCHAR(100) NOT NULL,
  certificate_id VARCHAR(50) NOT NULL,
  expires_on DATE NOT NULL,
  FOREIGN KEY (artisan_id) REFERENCES artisans(id)
);

INSERT IGNORE INTO verifications (artisan_id, issuing_body, certificate_id, expires_on)
  SELECT id, 'National Industrial Training Authority',
         CONCAT('NITA-', UPPER(LEFT(skill, 2)), '-2024-', LPAD(id, 5, '0')), '2027-03-01'
  FROM artisans WHERE id BETWEEN 1 AND 23 AND verified = TRUE;

-- ---------------------------------------------------------------------------
-- Week 6: times an artisan is busy with a job agreed by phone. availableToday
-- in the API is worked out from this table: false while a block covers now.
-- Times are stored in UTC.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS availability_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artisan_id INT NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (artisan_id) REFERENCES artisans(id)
);

