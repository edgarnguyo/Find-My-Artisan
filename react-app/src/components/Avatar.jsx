/**
 * Initials avatar. Replaces stock photos of people with the artisan's initials
 * on a colour derived from their name, so the same person always gets the same
 * colour without storing anything extra.
 *
 * `className` takes the existing circle classes (worker-image, profile-photo,
 * preview-photo) so sizing and borders stay exactly as they were.
 */
function getInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.slice(0, 2).map(part => part[0]);
  return letters.join('').toUpperCase();
}

function getHue(name) {
  let hash = 0;
  for (const char of String(name)) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  return hash;
}

export default function Avatar({ name, className = '' }) {
  return (
    <span
      className={`avatar ${className}`.trim()}
      style={{ '--avatar-hue': getHue(name) }}
      role="img"
      aria-label={name}
    >
      {getInitials(name)}
    </span>
  );
}
