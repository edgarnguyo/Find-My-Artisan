import ReviewCard from './ReviewCard';

export default function ReviewsList({ reviews }) {
  return (
    <section className="reviews">
      <h2>Reviews</h2>
      {reviews.length === 0 && <p>No reviews yet.</p>}
      {reviews.map((review, index) => (
        <ReviewCard key={index} review={review} />
      ))}
    </section>
  );
}
