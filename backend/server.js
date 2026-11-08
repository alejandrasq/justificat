const path = require('path');
// Carga dotenv de forma flexible en local sin romper Vercel en producción
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { isAllowedFrontendOrigin } = require('./middleware/auth');
const { isCloudinaryConfigured } = require('./utils/cloudinary');

const app = express();

const SESSION_SECRET = process.env.SESSION_SECRET;

if (process.env.NODE_ENV === 'production' && !SESSION_SECRET) {
  throw new Error('SESSION_SECRET debe configurarse en producción.');
}

if (SESSION_SECRET && Buffer.byteLength(SESSION_SECRET) < 32) {
  throw new Error('SESSION_SECRET debe tener al menos 32 bytes aleatorios.');
}

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET no está configurado; las sesiones serán temporales.');
}

if (process.env.NODE_ENV === 'production' && !isCloudinaryConfigured) {
  throw new Error('Configura CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en producción.');
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isAllowedFrontendOrigin(origin)) return callback(null, true);
    return callback(new Error('Origen CORS no permitido.'));
  },
  credentials: true
}));
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
}

// Conexión a MongoDB (optimizada para funciones Serverless)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/justificat';

let isConnected = false;
const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGO_URI);
  isConnected = true;
  console.log(`Conectado a MongoDB correctamente: ${mongoose.connection.name}`);
};

// Middleware para asegurar la conexión a BD en cada petición
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Error al conectar MongoDB:', error);
    res.status(503).json({ error: 'No se pudo conectar con la base de datos.' });
  }
});

// Rutas de la API
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/justifications', require('./routes/justifications'));

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'), (error) => {
      if (error && !res.headersSent) next(error);
    });
  });
}

// En entorno local iniciamos el servidor con app.listen; en Vercel exportamos la app
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
}

// Exportación requerida para Vercel Serverless Functions
module.exports = app;