const mongoose = require('mongoose');

const personalOrientacionSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
  'contraseña': { type: String, required: true }
}, { collection: 'personal', versionKey: false });

module.exports = mongoose.model('PersonalOrientacion', personalOrientacionSchema);
