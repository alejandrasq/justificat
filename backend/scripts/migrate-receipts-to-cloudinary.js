require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const SolicitudJustificante = require('../models/SolicitudJustificante');
const {
  encodeCloudinaryReceipt,
  isCloudinaryConfigured,
  uploadReceipt,
  deleteReceipt
} = require('../utils/cloudinary');

const applyChanges = process.argv.includes('--apply');
const uploadDir = path.join(__dirname, '../uploads');
const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf'
};

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('Configura MONGO_URI en backend/.env antes de migrar.');
  }
  if (!isCloudinaryConfigured) {
    throw new Error('Configura las tres variables CLOUDINARY_* en backend/.env antes de migrar.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  let migrated = 0;
  let missing = 0;
  let failed = 0;
  const requests = SolicitudJustificante.find({ receta: /^\/uploads\// })
    .select('_id receta')
    .cursor();

  try {
    for await (const request of requests) {
      const filename = path.basename(request.receta);
      const extension = path.extname(filename).toLowerCase();
      const filePath = path.join(uploadDir, filename);
      if (!/^\d+-[a-f0-9]+\.(?:jpe?g|png|pdf)$/i.test(filename) || !mimeTypes[extension] || !fs.existsSync(filePath)) {
        missing += 1;
        continue;
      }

      if (!applyChanges) {
        migrated += 1;
        continue;
      }

      let uploadedReceipt;
      try {
        uploadedReceipt = await uploadReceipt({
          buffer: fs.readFileSync(filePath),
          originalname: filename,
          mimetype: mimeTypes[extension]
        });
        const result = await SolicitudJustificante.updateOne(
          { _id: request._id, receta: request.receta },
          { $set: { receta: encodeCloudinaryReceipt(uploadedReceipt) } }
        );
        if (result.modifiedCount !== 1) {
          await deleteReceipt(uploadedReceipt);
          failed += 1;
          continue;
        }
        migrated += 1;
      } catch {
        if (uploadedReceipt) {
          try {
            await deleteReceipt(uploadedReceipt);
          } catch {
            console.error('No se pudo limpiar un archivo temporal de Cloudinary.');
          }
        }
        failed += 1;
      }
    }
  } finally {
    await requests.close();
    await mongoose.disconnect();
  }

  console.log(`${applyChanges ? 'Migrados' : 'Listos para migrar'}: ${migrated}; archivos locales faltantes o no compatibles: ${missing}; errores: ${failed}.`);
  if (!applyChanges) {
    console.log('Esta fue una simulación sin cambios. Ejecuta con --apply para migrar los comprobantes.');
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch(async () => {
  console.error('No se pudo completar la migración de comprobantes a Cloudinary.');
  await mongoose.disconnect();
  process.exitCode = 1;
});
