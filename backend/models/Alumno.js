const mongoose = require('mongoose');

const alumnoSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  matricula: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^[0-9]{1,14}$/, 'El número de control debe contener únicamente números y tener máximo 14 dígitos.']
  },
  semestre_grupo: { type: String, required: true, trim: true },
  especialidad: { type: String, required: true, trim: true },
  turno: { type: String, enum: ['Matutino', 'Vespertino'], default: 'Matutino', required: true },
  correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
  'contraseña': { type: String, required: true }
}, { collection: 'alumnos', versionKey: false });

module.exports = mongoose.model('Alumno', alumnoSchema);
