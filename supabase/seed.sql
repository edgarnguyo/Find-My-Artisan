-- Find My Artisan — seed data (generated from react-app/src/data/mockData.js)
-- Run after 0001_init.sql. Safe to re-run: it clears the catalogue tables first.

truncate table reviews, work_history, languages, bookings, workers restart identity cascade;

insert into workers (id, name, skill, verified, price, photo, location, bio, rating, job_success, hours_per_week, total_earnings, jobs_completed, hours_worked) values
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

insert into languages (worker_id, name, level) values
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

insert into work_history (worker_id, title, rating, date_range, price, price_type) values
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

insert into reviews (worker_id, author, rating, comment) values
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

select setval('workers_id_seq', (select max(id) from workers));

-- --------------------------------------------------- tables added in 0003
-- The truncate at the top cascades into worker_skills and worker_availability,
-- so if 0003 has already run, put the derived rows back. The guard makes this
-- file safe to run on a database that is still on 0002.
--
-- Note that the reviews inserted above now fire the rating trigger, so
-- workers.rating ends up as the average of the seeded reviews rather than the
-- literal value in the insert. That is the point of the trigger.

do $$
begin
    if to_regclass('public.worker_skills') is not null then
        insert into worker_skills (worker_id, skill)
        select id, skill from workers
        on conflict do nothing;
    end if;

    -- Full-timers Mon-Fri 08:00-17:00, part-timers three days 09:00-14:00.
    if to_regclass('public.worker_availability') is not null then
        insert into worker_availability (worker_id, weekday, start_time, end_time)
        select w.id,
               d.weekday,
               case when w.hours_per_week = 'More than 30 hrs/week' then time '08:00' else time '09:00' end,
               case when w.hours_per_week = 'More than 30 hrs/week' then time '17:00' else time '14:00' end
        from workers w
        cross join generate_series(0, 6) as d(weekday)
        where d.weekday < case when w.hours_per_week = 'More than 30 hrs/week' then 5 else 3 end
        on conflict (worker_id, weekday) do nothing;
    end if;
end $$;
