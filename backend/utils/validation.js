const INSTITUTIONAL_EMAIL_PATTERN = /^[^\s@]+@cbtis258\.edu\.mx$/i;
const GMAIL_PATTERN = /^[^\s@]+@gmail\.com$/i;

function isInstitutionalEmail(value) {
  return typeof value === 'string' && INSTITUTIONAL_EMAIL_PATTERN.test(value.trim());
}

function isAllowedStaffAccount(value) {
  return typeof value === 'string' && (
    GMAIL_PATTERN.test(value.trim())
    || value.trim().toLowerCase() === 'justificat'
  );
}

function normalizePersonName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-MX') : '';
}

function isValidPersonName(value) {
  return typeof value === 'string' && /^[\p{L}]+(?:\s+[\p{L}]+)*$/u.test(value.trim());
}

module.exports = {
  isAllowedStaffAccount,
  isInstitutionalEmail,
  isValidPersonName,
  normalizePersonName
};
