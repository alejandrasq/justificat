export function sanitizePersonName(value) {
  return value
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('es-MX');
}

export function formatLastNamesFirst(value) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 3) return value;

  const names = parts.slice(0, -2);
  const lastNames = parts.slice(-2);
  return [...lastNames, ...names].join(' ');
}
