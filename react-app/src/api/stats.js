import { request } from './client';

/**
 * The landing page's real numbers and newest portfolio photos:
 * { verifiedArtisans, averageRating, reviewCount, jobsCompleted, recentWork }.
 */
export function fetchStats() {
  return request('/stats');
}
