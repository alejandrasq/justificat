const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const {
  cloudinary,
  decodeCloudinaryReceipt,
  deleteReceipt,
  encodeCloudinaryReceipt,
  isCloudinaryConfigured,
  uploadReceipt
} = require('../utils/cloudinary');
const SolicitudJustificante = require('../models/SolicitudJustificante');
const JustificanteOficial = require('../models/JustificanteOficial');
const { requireAuth, requireRole, requireSameOrigin } = require('../middleware/auth');
const { publicRequest } = require('../utils/serializers');
const { folioFromSequence } = require('../utils/folio');

function officialRequestMatch(request) {
  return {
    id_alumno: request.id_alumno._id,
    motivo: request.motivo,
    fecha_inicio: request.fecha_inicio,
    fecha_fin: request.fecha_fin,
    descripcion: request.descripcion
  };
}

async function findOfficialForRequest(request) {
  const legacyFolio = `OF-${String(request._id).toUpperCase()}`;
  const linkedOfficial = await JustificanteOficial.findById(request._id);
  if (linkedOfficial) return linkedOfficial;

  const legacyOfficial = await JustificanteOficial.findOne({ folio: legacyFolio });
  if (legacyOfficial) return legacyOfficial;

  if (request.estatus === 'APROBADO') {
    return JustificanteOficial.findOne(officialRequestMatch(request))
      .sort({ fecha_emision: 1, _id: 1 });
  }

  return null;
}

async function nextJustificationFolio() {
  const issuedCount = await JustificanteOficial.countDocuments();
  return folioFromSequence(issuedCount + 1);
}

// Crear carpeta uploads si no existe
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de Multer
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: isCloudinaryConfigured ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (/^\.(?:jpe?g|png|pdf)$/.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos JPG, PNG y PDF'));
    }
  }
});

// Enviar solicitud de justificante
router.post('/', requireAuth, requireRole('student'), requireSameOrigin, upload.single('document'), async (req, res) => {
  let uploadedReceipt = null;
  try {
    const { startDate, endDate, reason, description } = req.body;
    const allowedReasons = ['Médico', 'Familiar', 'Personal', 'Legal', 'Otro'];
    const file = req.file;
    const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
      && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

    if (
      typeof startDate !== 'string' || typeof endDate !== 'string'
      || !validDate(startDate) || !validDate(endDate) || endDate < startDate
      || !allowedReasons.includes(reason)
      || typeof description !== 'string' || !description.trim()
      || !file
    ) {
      if (file?.path) fs.unlink(file.path, (error) => {
        if (error) console.error('No se pudo limpiar el comprobante temporal:', error);
      });
      return res.status(422).json({ error: 'Revisa las fechas, el motivo, la descripción y adjunta un comprobante.' });
    }

    let receiptPath;
    if (isCloudinaryConfigured) {
      uploadedReceipt = await uploadReceipt(file);
      receiptPath = encodeCloudinaryReceipt(uploadedReceipt);
    } else {
      receiptPath = `/uploads/${file.filename}`;
    }

    const newJustification = new SolicitudJustificante({
      id_alumno: req.user._id,
      fecha_inicio: new Date(`${startDate}T00:00:00.000Z`),
      fecha_fin: new Date(`${endDate}T23:59:59.999Z`),
      motivo: reason,
      descripcion: description.trim(),
      receta: receiptPath
    });

    await newJustification.save();
    uploadedReceipt = null;
    const populated = await newJustification.populate('id_alumno');
    res.status(201).json({ message: 'Solicitud enviada con éxito', justification: publicRequest(populated) });
  } catch (error) {
    if (req.file?.path) fs.unlink(req.file.path, (cleanupError) => {
      if (cleanupError) console.error('No se pudo limpiar el comprobante temporal:', cleanupError);
    });
    if (uploadedReceipt) {
      try {
        await deleteReceipt(uploadedReceipt);
      } catch (cleanupError) {
        console.error('No se pudo limpiar el comprobante de Cloudinary:', cleanupError);
      }
    }
    console.error('Error al guardar la solicitud:', error);
    res.status(500).json({ error: 'No se pudo guardar la solicitud y su comprobante.' });
  }
});

// Obtener las solicitudes del estudiante
router.get('/user/:account', requireAuth, requireRole('student'), async (req, res) => {
  if (req.params.account.toLowerCase() !== req.user.account) {
    return res.status(403).json({ error: 'Solo puedes consultar tus propias solicitudes.' });
  }

  try {
    const requests = await SolicitudJustificante.find({ id_alumno: req.user._id })
      .populate('id_alumno')
      .sort({ fecha_solicitud: -1 });
    res.json(requests.map(publicRequest));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener TODAS las solicitudes (para el encargado)
router.get('/', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const requests = await SolicitudJustificante.find().populate('id_alumno').sort({ fecha_solicitud: -1 });
    res.json(requests.map(publicRequest));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/attachments/:filename', requireAuth, requireRole('staff'), async (req, res) => {
  const { filename } = req.params;
  if (filename.startsWith('cloudinary-')) {
    const receipt = decodeCloudinaryReceipt(filename);
    if (!receipt || !isCloudinaryConfigured) {
      return res.status(404).json({ error: 'Archivo no encontrado.' });
    }

    try {
      const storedReceipt = `cloudinary:${filename.slice('cloudinary-'.length)}`;
      const isReferenced = await SolicitudJustificante.exists({ receta: storedReceipt });
      if (!isReferenced) return res.status(404).json({ error: 'Archivo no encontrado.' });

      const deliveryOptions = {
        resource_type: receipt.resourceType,
        type: 'authenticated',
        version: receipt.version,
        sign_url: true,
        secure: true
      };
      if (receipt.resourceType !== 'raw') deliveryOptions.format = receipt.format;
      const signedUrl = cloudinary.url(receipt.publicId, deliveryOptions);
      const response = await fetch(signedUrl);
      if (!response.ok) {
        console.error(`Cloudinary respondió ${response.status} al recuperar un comprobante.`);
        return res.status(502).json({ error: 'No se pudo recuperar el comprobante.' });
      }

      res.set('Content-Type', receipt.mimetype);
      res.set('Content-Disposition', `inline; filename="${path.basename(receipt.originalName).replace(/["\\\r\n]/g, '_')}"`);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'private, no-store');
      return res.send(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('Error al recuperar comprobante de Cloudinary:', error);
      return res.status(502).json({ error: 'No se pudo recuperar el comprobante.' });
    }
  }

  if (!/^\d+-\d+\.(?:jpe?g|png|pdf)$/i.test(filename)) {
    return res.status(404).json({ error: 'Archivo no encontrado.' });
  }

  const filePath = path.join(uploadDir, filename);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(filePath, (error) => {
    if (error && !res.headersSent) {
      res.status(error.statusCode === 404 ? 404 : 500).json({
        error: error.statusCode === 404 ? 'Archivo no encontrado.' : 'No se pudo abrir el archivo.'
      });
    }
  });
});

// Obtener una solicitud por ID (para generar el documento imprimible)
router.get('/:id', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const request = await SolicitudJustificante.findById(req.params.id).populate('id_alumno');
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const official = await findOfficialForRequest(request);
    res.json(publicRequest(request, { folio: official?.folio || '' }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Los estados internos del panel se traducen a los valores del esquema MongoDB.
router.put('/:id/status', requireAuth, requireRole('staff'), requireSameOrigin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'review', 'issued', 'rejected'].includes(status)) {
      return res.status(422).json({ error: 'El estado indicado no es válido.' });
    }
    const estatus = status === 'issued' ? 'APROBADO' : status === 'rejected' ? 'RECHAZADO' : 'PENDIENTE';
    const updated = await SolicitudJustificante.findByIdAndUpdate(
      req.params.id,
      {
        estatus,
        id_personal: status === 'pending' ? null : req.user._id
      },
      { new: true, runValidators: true }
    ).populate('id_alumno');
    if (!updated) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    let official = await findOfficialForRequest(updated);
    if (status === 'issued') {
      const legacyFolio = `OF-${String(updated._id).toUpperCase()}`;
      if (official?.folio === legacyFolio) {
        official.folio = await nextJustificationFolio();
        await official.save();
      } else if (!official) {
        const folio = await nextJustificationFolio();
        try {
          official = await JustificanteOficial.findOneAndUpdate(
            { _id: updated._id },
            { $setOnInsert: {
                folio,
                fecha_emision: new Date(),
                motivo: updated.motivo,
                fecha_inicio: updated.fecha_inicio,
                fecha_fin: updated.fecha_fin,
                descripcion: updated.descripcion,
                id_alumno: updated.id_alumno._id,
                id_personal: req.user._id
              } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        } catch (error) {
          if (error.code !== 11000) throw error;
          official = await findOfficialForRequest(updated);
          if (!official) throw error;
        }
      }
    }
    if (status === 'issued' && !official?.folio) {
      throw new Error('El justificante se emitió, pero no se pudo recuperar su folio.');
    }
    res.json(publicRequest(updated, { folio: official?.folio || '' }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;