import { useParams } from 'react-router-dom';
import { WORKERS } from '../data/mockData';
import ProfileHeader from '../components/ProfileHeader';
import ProfileStats from '../components/ProfileStats';
import ProfileGallery from '../components/ProfileGallery';
import ProfileWorkHistory from '../components/ProfileWorkHistory';
import ReviewsList from '../components/ReviewsList';
import BookingForm from '../components/BookingForm';
import AvailabilityCalendar from '../components/AvailabilityCalendar';

export default function ProfilePage() {
  const { id } = useParams();
  const worker = WORKERS.find(w => w.id === parseInt(id, 10));

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
