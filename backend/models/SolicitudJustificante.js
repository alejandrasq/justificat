const mongoose = require('mongoose');

const solicitudSchema = new mongoose.Schema({
  fecha_solicitud: { type: Date, default: Date.now },
  estatus: { type: String, enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO'], default: 'PENDIENTE' },
  receta: { type: String, required: true },
  motivo: { type: String, required: true },
  descripcion: { type: String, required: true },
  fecha_inicio: { type: Date, required: true },
  fecha_fin: { type: Date, required: true },
  id_alumno: { type: mongoose.Schema.Types.ObjectId, ref: 'Alumno', required: true },
  id_personal: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalOrientacion', default: null }
}, { collection: 'solicitud_justificante', versionKey: false });

module.exports = mongoose.model('SolicitudJustificante', solicitudSchema);
