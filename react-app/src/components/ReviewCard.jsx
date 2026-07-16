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
