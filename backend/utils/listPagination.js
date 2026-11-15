const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE_OFFSET = 500000;

const ACCENT_GROUPS = Object.fromEntries(
  ['aàáâãäå', 'cç', 'eèéêë', 'iìíîï', 'nñ', 'oòóôõö', 'uùúûü', 'yýÿ']
    .flatMap((characters) => [...characters].map((character) => [character, characters]))
);

function parseListPagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? DEFAULT_PAGE_SIZE : Number(query.pageSize);
  if (
    !Number.isSafeInteger(page) || page < 1
    || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE
    || (page - 1) * pageSize > MAX_PAGE_OFFSET
  ) {
    return null;
  }
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function createSearchRegex(value) {
  const pattern = [...value.trim().slice(0, 100).toLocaleLowerCase('es-MX')]
    .map((character) => {
      const accentGroup = ACCENT_GROUPS[character];
      if (accentGroup) return `[${accentGroup}]`;
      return character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(pattern, 'i');
}

function academicGroupPattern(semester, group) {
  if (semester && group) return `^${semester}\\s*[-/ ]?\\s*${group}$`;
  if (semester) return `^${semester}\\s*[-/ ]?\\s*[A-Z]$`;
  return `^\\d+\\s*[-/ ]?\\s*${group}$`;
}

function surnameSortExpression(nameField) {
  const nameParts = { $split: [{ $trim: { input: { $ifNull: [nameField, ''] } } }, ' '] };
  const nameLength = { $size: nameParts };
  const givenNames = {
    $reduce: {
      input: { $slice: [nameParts, 0, { $subtract: [nameLength, 2] }] },
      initialValue: '',
      in: {
        $concat: [
          '$$value',
          { $cond: [{ $eq: ['$$value', ''] }, '', ' '] },
          '$$this'
        ]
      }
    }
  };
  return {
    $cond: [
      { $gte: [nameLength, 3] },
      {
        $concat: [
          { $arrayElemAt: [nameParts, -2] },
          ' ',
          { $arrayElemAt: [nameParts, -1] },
          ' ',
          givenNames
        ]
      },
      { $ifNull: [nameField, ''] }
    ]
  };
}

module.exports = {
  academicGroupPattern,
  createSearchRegex,
  parseListPagination,
  surnameSortExpression
};
