const INSTITUTIONAL_EMAIL_PATTERN = /^[^\s@]+@cbtis258\.edu\.mx$/i;
const STUDENT_REGISTRATION_EMAIL_PATTERN = /^[a-z]+\.[a-z]+\.([a-z]+)@cbtis258\.edu\.mx$/i;
const STUDENT_EMAIL_SUFFIX_BY_CAREER = Object.freeze({
  'Programación': 'alp',
  'Mecánica Industrial': 'alm',
  'Servicios de Hospedaje': 'alh',
  'Prep. Alimentos y Bebidas': 'ala',
  Ciberseguridad: 'acb',
  'Inteligencia Artificial': 'aia',
  Logística: 'al',
  Contabilidad: 'alc'
});
const GMAIL_PATTERN = /^[^\s@]+@gmail\.com$/i;

function isInstitutionalEmail(value) {
  return typeof value === 'string' && INSTITUTIONAL_EMAIL_PATTERN.test(value.trim());
}

function isValidStudentRegistrationEmail(value, career) {
  if (typeof value !== 'string' || typeof career !== 'string') return false;
  const emailParts = value.trim().match(STUDENT_REGISTRATION_EMAIL_PATTERN);
  const expectedSuffix = STUDENT_EMAIL_SUFFIX_BY_CAREER[career.trim()];
  return Boolean(emailParts && expectedSuffix && emailParts[1].toLowerCase() === expectedSuffix);
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
  isValidStudentRegistrationEmail,
  isValidPersonName,
  normalizePersonName
};
