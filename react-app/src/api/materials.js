import { request } from './client';

/**
 * Scrap materials in stock at Kanairo-Klean, our upstream partner, with prices:
 * [{ id, name, type, quantityKg, pricePerKgKes }]. Our server makes the call to
 * Kanairo with the token, so no token is ever in the browser.
 * `type` is one of metal, plastic, paper, glass, e-waste, or empty for all.
 */
export function fetchMaterials(type) {
  return request(type ? `/partner/materials?type=${encodeURIComponent(type)}` : '/partner/materials');
}

/** Kanairo-Klean's yards that take scrap drop-offs: [{ id, name, area, county }]. */
export function fetchCollectionLocations() {
  return request('/partner/collection-locations');
}

/**
 * Report scrap left over from a completed job, at one of Kanairo-Klean's yards.
 * details: { artisanId, bookingId, locationId, materialType, quantityKg, notes? }.
 * Returns their record: { id, locationId, materialType, quantityKg, status, createdAt }.
 */
export function reportDropOff(details) {
  return request('/partner/drop-offs', { method: 'POST', body: details });
}
