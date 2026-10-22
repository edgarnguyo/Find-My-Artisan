// Which of Kanairo-Klean's material types each trade buys. Plumbers use plastic
// and metal pipe; electricians use metal (copper wire) and salvaged e-waste parts.
// Kanairo sells no wood or paint, so carpenters and painters have nothing here
// and the booking form leaves the materials section out for them.
const TRADE_MATERIALS = {
  Plumber: ['plastic', 'metal'],
  Electrician: ['metal', 'e-waste'],
};

/** The Kanairo material types for a skill, or [] when Kanairo sells none of them. */
export function materialTypesFor(skill) {
  return TRADE_MATERIALS[skill] ?? [];
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
