require('dotenv').config();

const mongoose = require('mongoose');
const { renumberFolios } = require('../utils/renumber-folios');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/justificat';
const EXTRA_FIELDS = ['createdAt', 'updatedAt', '__v'];

async function removeExtraMetadata(collection) {
  const unset = Object.fromEntries(EXTRA_FIELDS.map((field) => [field, '']));
  const result = await collection.updateMany({}, { $unset: unset });
  return result.modifiedCount;
}

async function migrate() {
  await mongoose.connect(MONGO_URI);
  const database = mongoose.connection;
  try {
    if (database.name !== 'justificat') {
      throw new Error(`La migración esperaba la base "justificat", pero la conexión apunta a "${database.name}".`);
    }

    const alumnos = database.collection('alumnos');
    const personal = database.collection('personal');
    const solicitudes = database.collection('solicitud_justificante');
    const justificantes = database.collection('justificante');
    const renumberedCount = await renumberFolios(database);

    await alumnos.updateMany(
      { $or: [{ turno: { $exists: false } }, { turno: null }, { turno: '' }] },
      { $set: { turno: 'Matutino' } }
    );
    await solicitudes.updateMany(
      { prueba: { $exists: true }, receta: { $exists: false } },
      { $rename: { prueba: 'receta' } }
    );
    await solicitudes.updateMany(
      { prueba: { $exists: true } },
      { $unset: { prueba: '' } }
    );
    await justificantes.updateMany(
      { id_solicitud: { $exists: true } },
      { $unset: { id_solicitud: '' } }
    );

    const metadataRemoved = {
      alumnos: await removeExtraMetadata(alumnos),
      personal: await removeExtraMetadata(personal),
      solicitud_justificante: await removeExtraMetadata(solicitudes),
      justificante: await removeExtraMetadata(justificantes)
    };

    const legacyFieldCounts = {
      studentsWithoutShift: await alumnos.countDocuments({ turno: { $exists: false } }),
      requestsWithOldReceiptField: await solicitudes.countDocuments({ prueba: { $exists: true } }),
      justificationsWithRequestReference: await justificantes.countDocuments({ id_solicitud: { $exists: true } }),
      documentsWithMetadata: await Promise.all([
        alumnos.countDocuments({ $or: EXTRA_FIELDS.map((field) => ({ [field]: { $exists: true } })) }),
        personal.countDocuments({ $or: EXTRA_FIELDS.map((field) => ({ [field]: { $exists: true } })) }),
        solicitudes.countDocuments({ $or: EXTRA_FIELDS.map((field) => ({ [field]: { $exists: true } })) }),
        justificantes.countDocuments({ $or: EXTRA_FIELDS.map((field) => ({ [field]: { $exists: true } })) })
      ])
    };

    if (
      legacyFieldCounts.studentsWithoutShift > 0
      || legacyFieldCounts.requestsWithOldReceiptField > 0
      || legacyFieldCounts.justificationsWithRequestReference > 0
      || legacyFieldCounts.documentsWithMetadata.some((count) => count > 0)
    ) {
      throw new Error(`La verificación posterior a la migración encontró campos antiguos: ${JSON.stringify(legacyFieldCounts)}`);
    }

    console.log(JSON.stringify({
      database: database.name,
      collections: {
        alumnos: await alumnos.countDocuments(),
        personal: await personal.countDocuments(),
        solicitud_justificante: await solicitudes.countDocuments(),
        justificante: await justificantes.countDocuments()
      },
      justificationsRenumbered: renumberedCount,
      metadataDocumentsUpdated: metadataRemoved,
      verified: true
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

migrate().catch((error) => {
  console.error(`No se pudo alinear la base con el diagrama: ${error.message}`);
  process.exitCode = 1;
});
