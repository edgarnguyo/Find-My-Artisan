import ReviewCard from './ReviewCard';

// ReviewsList receives the full reviews array and maps over it.
// Array.map() in JSX works exactly like in plain JS — it transforms
// each element into something new. Here each review object becomes
// a <ReviewCard /> component. React renders the resulting array of
// elements in order, one after the other.
//
// The `key` prop is required when rendering lists. React uses it
// internally to track which item is which when the list changes.
// It must be unique within the list — here we use the array index
// because our reviews have no unique id of their own.

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
