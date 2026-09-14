-- Creates the Find My Artisan database.
-- Run from the server/ folder:  mysql -u root < schema.sql
-- Safe to re-run: tables are only created if missing, the stored procedures are
-- recreated, the 23 sample artisans are reset to their original values, and
-- accounts, clients, bookings and artisans who signed up on the site are kept.
--
-- Where data from the front end goes in:
--   sign-up  -> register_client / register_artisan procedures (below), called by
--               server/routes/auth.js
--   bookings -> INSERT INTO bookings in server/routes/bookings.js

-- The mysql CLI may send this file as latin1, which turns the – in prices into â€“.
-- This tells the server the bytes that follow are UTF-8.
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS find_my_artisan;
USE find_my_artisan;

-- Tables are created parents first: a FOREIGN KEY can only point at a table
-- that already exists.

-- One row per login. The profile details live in clients or artisans.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  -- A bcrypt hash made by Express. The password itself is never stored.
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('client', 'artisan') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- People who book artisans. UNIQUE user_id: one client profile per account.
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  location VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT clients_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS artisans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- NULL for the sample artisans; set for artisans who signed up on the site.
  -- UNIQUE: one artisan profile per account. CASCADE: deleting the user deletes it.
  user_id INT NULL UNIQUE,
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
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT artisans_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS languages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artisan_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  level VARCHAR(50) NOT NULL,
  CONSTRAINT languages_artisan_fk FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS work_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artisan_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  rating TINYINT CHECK (rating BETWEEN 1 AND 5),
  date_range VARCHAR(50),
  price VARCHAR(50),
  price_type VARCHAR(50),
  CONSTRAINT work_history_artisan_fk FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artisan_id INT NOT NULL,
  author VARCHAR(100) NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT reviews_artisan_fk FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE
);

-- user_id is NULL for a guest booking. SET NULL: deleting an account keeps its
-- bookings for the artisan, just no longer linked to anyone.
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artisan_id INT NOT NULL,
  user_id INT NULL,
  name VARCHAR(100) NOT NULL,
  contact VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  budget VARCHAR(100),
  job TEXT NOT NULL,
  status ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bookings_artisan_fk FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE,
  CONSTRAINT bookings_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------- sign-up
-- A stored procedure is a named block of SQL saved inside MySQL. These two hold
-- the INSERTs that save the sign-up form. This file only creates them; Express
-- runs them for every new account, for example:
--   CALL register_client('amina@example.com', '<bcrypt hash>', 'Amina', '0712345678', 'Kilimani, Nairobi');
-- Each one inserts the login (users) and the profile (clients or artisans) in a
-- single transaction, then returns the new ids.

DROP PROCEDURE IF EXISTS register_client;
DROP PROCEDURE IF EXISTS register_artisan;

-- A procedure body contains ; so the CLI's statement separator is switched to //
-- while the procedures are defined, then switched back.
DELIMITER //

CREATE PROCEDURE register_client(
  IN p_email         VARCHAR(255),
  IN p_password_hash VARCHAR(255),
  IN p_name          VARCHAR(100),
  IN p_phone         VARCHAR(30),
  IN p_location      VARCHAR(100)
)
BEGIN
  DECLARE new_user_id INT;

  -- If either INSERT fails (for example the email is already taken), undo
  -- both and pass the original error on to Express.
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  INSERT INTO users (email, password_hash, role)
    VALUES (p_email, p_password_hash, 'client');
  -- LAST_INSERT_ID() is the AUTO_INCREMENT id the INSERT above just created.
  SET new_user_id = LAST_INSERT_ID();
  INSERT INTO clients (user_id, name, phone, location)
    VALUES (new_user_id, p_name, p_phone, p_location);
  COMMIT;

  SELECT new_user_id AS user_id, LAST_INSERT_ID() AS client_id;
END //

CREATE PROCEDURE register_artisan(
  IN p_email         VARCHAR(255),
  IN p_password_hash VARCHAR(255),
  IN p_name          VARCHAR(100),
  IN p_skill         VARCHAR(50),
  IN p_location      VARCHAR(100),
  IN p_price         VARCHAR(50),
  IN p_bio           TEXT
)
BEGIN
  DECLARE new_user_id INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  INSERT INTO users (email, password_hash, role)
    VALUES (p_email, p_password_hash, 'artisan');
  SET new_user_id = LAST_INSERT_ID();
  INSERT INTO artisans (user_id, name, skill, location, price, bio)
    VALUES (new_user_id, p_name, p_skill, p_location, p_price, p_bio);
  COMMIT;

  SELECT new_user_id AS user_id, LAST_INSERT_ID() AS artisan_id;
END //

DELIMITER ;

-- ------------------------------------------------------------ sample data
-- Sample artisans. ON DUPLICATE KEY UPDATE changes an existing row in place.
-- (REPLACE would delete and re-insert it, and the CASCADE rules above would then
-- delete that artisan's bookings too.)
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
  (23, 'Samuel Kimutai', 'Painter', false, 'KES 2,000 – 7,500 / job', 'https://randomuser.me/api/portraits/men/91.jpg', 'London Estate, Nakuru', 'Painter offering interior and exterior work, with flexible scheduling for weekend jobs.', 4, 87, 'Less than 30 hrs/week', 'KES 120K+', 9, 260)
AS new ON DUPLICATE KEY UPDATE
  name = new.name, skill = new.skill, verified = new.verified, price = new.price,
  photo = new.photo, location = new.location, bio = new.bio, rating = new.rating,
  job_success = new.job_success, hours_per_week = new.hours_per_week,
  total_earnings = new.total_earnings, jobs_completed = new.jobs_completed,
  hours_worked = new.hours_worked;

-- The sample artisans' languages, work history and reviews have no fixed ids,
-- so clear them and insert them again to avoid duplicates on every re-run.
DELETE FROM languages    WHERE artisan_id BETWEEN 1 AND 23;
DELETE FROM work_history WHERE artisan_id BETWEEN 1 AND 23;
DELETE FROM reviews      WHERE artisan_id BETWEEN 1 AND 23;

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
