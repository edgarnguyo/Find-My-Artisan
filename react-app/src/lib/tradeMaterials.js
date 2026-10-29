// Which of Kanairo-Klean's material types each trade usually buys. Plumbers use
// plastic and metal pipe; electricians use metal (copper wire) and salvaged
// e-waste parts. Kanairo sells no wood or paint, so carpenters and painters
// have none. The quote form lists these first and every other Kanairo material
// after them, so a type Kanairo adds later still shows up.
const TRADE_MATERIALS = {
  Plumber: ['plastic', 'metal'],
  Electrician: ['metal', 'e-waste'],
};

/**
 * Kanairo's materials split in two: the ones this trade usually uses, and the rest.
 * Returns { forTrade, other }.
 */
export function splitByTrade(materials, skill) {
  const types = TRADE_MATERIALS[skill] ?? [];
  return {
    forTrade: materials.filter(m => types.includes(m.type)),
    other: materials.filter(m => !types.includes(m.type)),
  };
}

const kes = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 });

/** 1425.5 -> 'KES 1,425.5'. */
export function formatKesAmount(amount) {
  return `KES ${kes.format(amount)}`;
}

/** The total of a list of { quantityKg, pricePerKgKes }, to the cent. */
export function materialsTotal(materials) {
  const cents = materials.reduce((sum, m) => sum + Math.round(m.quantityKg * m.pricePerKgKes * 100), 0);
  return cents / 100;
}

/** A quote's total: labour plus its materials. */
export function quoteTotal(quote) {
  return Math.round((quote.labourKes + materialsTotal(quote.materials)) * 100) / 100;
}
