function folioFromSequence(sequence) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new RangeError('La secuencia del folio debe ser un entero positivo.');
  }

  return String(((sequence - 1) % 200) + 1);
}

module.exports = { folioFromSequence };
