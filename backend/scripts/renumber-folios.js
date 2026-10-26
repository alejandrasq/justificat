require('dotenv').config();

const mongoose = require('mongoose');
const { renumberFolios } = require('../utils/renumber-folios');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/justificat';

async function run() {
  await mongoose.connect(MONGO_URI);
  try {
    if (mongoose.connection.name !== 'justificat') {
      throw new Error(`Se esperaba la base "justificat", pero la conexión apunta a "${mongoose.connection.name}".`);
    }

    const count = await renumberFolios(mongoose.connection);
    console.log(`Se renumeraron ${count} justificantes en ciclos del 1 al 200.`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(`No se pudieron renumerar los folios: ${error.message}`);
  process.exitCode = 1;
});
