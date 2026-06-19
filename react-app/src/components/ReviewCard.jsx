// ReviewCard receives ONE review object as a prop and renders it.
// This is the clearest example of why components exist: instead of
// copy-pasting the card HTML 3 times, you write it once here and
// let ReviewsList call <ReviewCard /> once per review in the array.

export default function ReviewCard({ review }) {
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

  return (
    <div className="review-card">
      <div className="review-stars">{stars}</div>
      <div className="review-author">{review.author}</div>
      <p className="review-comment">{review.comment}</p>
    </div>
  );
}
