const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { FRONTEND_ORIGIN } = require('./middleware/auth');

const app = express();

if (process.env.SESSION_SECRET && Buffer.byteLength(process.env.SESSION_SECRET) < 32) {
  throw new Error('SESSION_SECRET debe tener al menos 32 bytes aleatorios.');
}

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('Configura SESSION_SECRET con un valor aleatorio de al menos 32 caracteres.');
}

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET no está configurado; las sesiones locales se invalidarán al reiniciar el servidor.');
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === FRONTEND_ORIGIN) return callback(null, true);
    return callback(new Error('Origen CORS no permitido.'));
  },
  credentials: true
}));
app.use(express.json());

// Rutas de la API
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/justifications', require('./routes/justifications'));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/justificat';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log(`Conectado a MongoDB correctamente: ${mongoose.connection.name}`);
    app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
  })
  .catch(err => console.error('Error al conectar MongoDB:', err));