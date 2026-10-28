require('dotenv').config();

const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Alumno = require('../models/Alumno');
const PersonalOrientacion = require('../models/PersonalOrientacion');
const { isAllowedStaffAccount, isValidPersonName, normalizePersonName } = require('../utils/validation');

function ask(question) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    prompt.question(question, (answer) => {
      prompt.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Ejecuta este comando desde una terminal interactiva para ocultar la contraseña.'));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write(question);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();

    const finish = (error) => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          finish(new Error('Operación cancelada.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        value += character;
        process.stdout.write('*');
      }
    };

    input.on('data', onData);
  });
}

async function main() {
  const account = (await ask('Cuenta Gmail del encargado: ')).toLowerCase();
  const fullName = await ask('Nombre completo: ');
  const password = await askHidden('Contraseña (mínimo 12 caracteres; no se mostrará): ');

  if (!isAllowedStaffAccount(account)) {
    throw new Error('Usa una cuenta @gmail.com válida.');
  }
  if (!isValidPersonName(fullName)) {
    throw new Error('El nombre solo debe contener letras y espacios.');
  }
  if (password.length < 12) throw new Error('La contraseña debe tener al menos 12 caracteres.');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/justificat';
  await mongoose.connect(mongoUri);

  if (await Alumno.exists({ correo: account }) || await PersonalOrientacion.exists({ correo: account })) {
    throw new Error('Ya existe una cuenta con ese correo.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await PersonalOrientacion.create({
    correo: account,
    'contraseña': passwordHash,
    nombre: normalizePersonName(fullName)
  });

  console.log(`Cuenta de encargado creada: ${account}`);
  console.log('Inicia sesión con ese correo y la contraseña que acabas de definir.');
}

main()
  .catch((error) => {
    console.error(`No se pudo crear la cuenta de encargado: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
