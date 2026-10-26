async function renumberFolios(database) {
  const justificantes = database.collection('justificante');
  const indexes = await justificantes.indexes();

  for (const index of indexes) {
    if (
      index.key?.id_solicitud
      || (index.unique && index.key?.folio && Object.keys(index.key).length === 1)
    ) {
      await justificantes.dropIndex(index.name);
    }
  }
  await justificantes.createIndex({ folio: 1 });

  let sequence = 0;
  let updates = [];
  const batchSize = 500;
  const cursor = justificantes.find({}, { projection: { _id: 1, fecha_emision: 1 } })
    .sort({ fecha_emision: 1, _id: 1 });

  for await (const justification of cursor) {
    sequence += 1;
    updates.push({
      updateOne: {
        filter: { _id: justification._id },
        update: { $set: { folio: String(((sequence - 1) % 200) + 1) } }
      }
    });

    if (updates.length === batchSize) {
      await justificantes.bulkWrite(updates, { ordered: true });
      updates = [];
    }
  }

  if (updates.length > 0) {
    await justificantes.bulkWrite(updates, { ordered: true });
  }
  const sequenceCollections = await database.db.listCollections(
    { name: 'folio_sequences' },
    { nameOnly: true }
  ).toArray();
  if (sequenceCollections.length > 0) {
    await database.dropCollection('folio_sequences');
  }

  return sequence;
}

module.exports = { renumberFolios };
