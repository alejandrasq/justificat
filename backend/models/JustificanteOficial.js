const mongoose = require('mongoose');

const justificanteOficialSchema = new mongoose.Schema({
  folio: { type: String, required: true },
  motivo: { type: String, required: true },
  fecha_inicio: { type: Date, required: true },
  fecha_fin: { type: Date, required: true },
  descripcion: { type: String, required: true },
  fecha_emision: { type: Date, default: Date.now },
  id_alumno: { type: mongoose.Schema.Types.ObjectId, ref: 'Alumno', required: true },
  id_personal: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalOrientacion', required: true },
}, { collection: 'justificante', versionKey: false });

module.exports = mongoose.model('JustificanteOficial', justificanteOficialSchema);
