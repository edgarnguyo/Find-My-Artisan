// Prices and budgets are free text typed by people: some write "KES 2,500 – 7,000
// / job", others just "5000". A bare number gets the currency and thousands
// separators ("KES 5,000"); anything else is shown as it was typed.
export function formatKes(value) {
  if (value == null || value === '') return value;
  const digits = String(value).replace(/^\s*(kes|ksh|kshs)\.?\s*|\s*(kes|ksh|kshs)\.?\s*$/gi, '');
  if (!/^\d[\d,]*$/.test(digits.trim())) return value;
  return `KES ${Number(digits.replace(/,/g, '')).toLocaleString('en-GB')}`;
}

// 'confirmed' -> 'Confirmed', for statuses shown as labels.
export function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
