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
