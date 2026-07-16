import ReviewCard from './ReviewCard';

export default function ReviewsList({ reviews }) {
  return (
    <section className="reviews">
      <h2>Reviews</h2>
      {reviews.map((review, index) => (
        <ReviewCard key={index} review={review} />
      ))}
    </section>
  );
}
