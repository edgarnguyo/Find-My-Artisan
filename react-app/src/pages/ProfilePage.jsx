import { useParams } from 'react-router-dom';
import { fetchWorkerById } from '../api/workers';
import { useAsync } from '../hooks/useAsync';
import ProfileHeader from '../components/ProfileHeader';
import ProfileStats from '../components/ProfileStats';
import ProfileGallery from '../components/ProfileGallery';
import ProfileWorkHistory from '../components/ProfileWorkHistory';
import ReviewsList from '../components/ReviewsList';
import BookingForm from '../components/BookingForm';
import AvailabilityCalendar from '../components/AvailabilityCalendar';

export default function ProfilePage() {
  const { id } = useParams();
  const { data: worker, error, loading } = useAsync(
    () => fetchWorkerById(id),
    [id]
  );

  if (loading) {
    return (
      <main className="profile">
        <p>Loading artisan…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="profile">
        <h1>Something went wrong</h1>
        <p>Could not load this artisan: {error.message}</p>
      </main>
    );
  }

  if (!worker) {
    return (
      <main className="profile">
        <h1>Worker not found</h1>
        <p>No artisan with id {id} exists.</p>
      </main>
    );
  }

  return (
    <main className="profile">
      <ProfileHeader worker={worker} />

      <div className="profile-layout">
        <aside className="profile-sidebar" id="booking">
          <BookingForm worker={worker} />
          <ProfileStats worker={worker} />
        </aside>

        <div className="profile-main">
          <section className="bio">
            <h2>About</h2>
            <p>{worker.bio}</p>

            {worker.skills.length > 0 && (
              <ul className="skill-tags">
                {worker.skills.map(skill => (
                  <li key={skill} className="skill-tag">{skill}</li>
                ))}
              </ul>
            )}
          </section>

          <AvailabilityCalendar worker={worker} />

          <ProfileGallery worker={worker} />
          <ProfileWorkHistory history={worker.workHistory} />
          <ReviewsList reviews={worker.reviews} />
        </div>
      </div>
    </main>
  );
}
