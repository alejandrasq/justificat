export function getInitials(name, fallback = '') {
  const normalizedName = String(name || '').trim().split('@')[0];
  const words = normalizedName.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return fallback;

  if (words.length === 1) {
    return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
  }

  return words.slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase();
}
