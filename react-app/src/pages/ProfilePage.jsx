import { useParams } from 'react-router-dom';
import { WORKERS } from '../data/mockData';
import ProfileHeader from '../components/ProfileHeader';
import ReviewsList from '../components/ReviewsList';
import BookingForm from '../components/BookingForm';

// useParams() is a React Router hook. It reads the dynamic segments
// from the current URL. We defined the route as /profile/:id, so
// useParams() returns { id: "2" } when the URL is /profile/2.
// This replaces the manual URLSearchParams parsing from Week 1.

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

      <section className="bio">
        <h2>About</h2>
        <p>{worker.bio}</p>
      </section>

      <ReviewsList reviews={worker.reviews} />
      <BookingForm />
    </main>
  );
}
