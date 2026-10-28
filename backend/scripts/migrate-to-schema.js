require('dotenv').config();

const mongoose = require('mongoose');
const path = require('path');

const sourceUri = process.env.SOURCE_MONGO_URI || 'mongodb://127.0.0.1:27017/sistema_justificantes';
const targetUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/justificat';

function dateValue(value, label, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value || fallback);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`La fecha "${label}" no es válida.`);
  }
  return date;
}

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Falta el campo obligatorio "${label}" en un registro de origen.`);
  }
  return value.trim();
}

function studentDocument(student) {
  const semesterGroup = student.semestre_grupo
    || `${student.semestre ?? student.semester ?? ''}-${student.grupo || student.group || ''}`;
  return {
    _id: student._id,
    nombre: requiredText(student.nombre || student.fullName, 'alumnos.nombre'),
    matricula: requiredText(student.matricula || student.studentId, 'alumnos.matricula'),
    semestre_grupo: requiredText(semesterGroup, 'alumnos.semestre_grupo'),
    especialidad: requiredText(student.especialidad || student.carrera || student.career, 'alumnos.especialidad'),
    turno: student.turno || 'Matutino',
    correo: requiredText(student.correo || student.account, 'alumnos.correo').toLowerCase(),
    'contraseña': requiredText(student['contraseña'] || student.passwordHash, 'alumnos.contraseña')
  };
}

function staffDocument(person) {
  return {
    _id: person._id,
    nombre: requiredText(person.nombre || person.fullName, 'personal.nombre'),
    correo: requiredText(person.correo || person.account, 'personal.correo').toLowerCase(),
    'contraseña': requiredText(person['contraseña'] || person.passwordHash, 'personal.contraseña')
  };
}

function referenceId(value) {
  return value?._id || value || null;
}

function receiptPath(value) {
  const item = Array.isArray(value) ? value[0] : value;
  const rawName = typeof item === 'string' ? item : item?.filename || item?.path;
  const filename = rawName ? path.basename(rawName) : '';
  if (!filename || filename === '.' || filename === path.sep) return '';
  return `/uploads/${filename}`;
}

function statusValue(value, label) {
  const status = String(value || 'PENDIENTE').toLowerCase();
  const statuses = {
    pending: 'PENDIENTE',
    review: 'PENDIENTE',
    issued: 'APROBADO',
    aprobado: 'APROBADO',
    rejected: 'RECHAZADO',
    rechazado: 'RECHAZADO',
    pendiente: 'PENDIENTE'
  };
  const result = statuses[status] || (['PENDIENTE', 'APROBADO', 'RECHAZADO'].includes(value) ? value : null);
  if (!result) throw new Error(`La solicitud ${label} tiene un estado no reconocido: ${value}.`);
  return result;
}

function requestDocument(request, student, fallbackStaffId) {
  const studentId = referenceId(request.id_alumno || request.userId) || student?._id;
  if (!studentId) {
    throw new Error(`La solicitud ${request._id} no tiene una referencia a un alumno existente.`);
  }
  const status = statusValue(request.estatus || request.status, request._id);
  const receipt = receiptPath(request.prueba || request.receta || request.receta_medica_pdf || request.attachments || request.documentos);
  if (!receipt) {
    throw new Error(`La solicitud ${request._id} no tiene un comprobante que pueda migrarse.`);
  }

  const staffId = referenceId(request.id_personal || request.id_orientador)
    || (status !== 'PENDIENTE' ? fallbackStaffId : null);
  const startDate = request.fecha_inicio || request.startDate;
  const endDate = request.fecha_fin || request.endDate;
  const createdAt = dateValue(request.fecha_solicitud || request.createdAt, `fecha_solicitud de ${request._id}`);

  return {
    _id: request._id,
    fecha_solicitud: createdAt,
    estatus: status,
    receta: receipt,
    motivo: requiredText(request.motivo || request.reason, `solicitud ${request._id}.motivo`),
    descripcion: requiredText(request.descripcion || request.description || 'Sin descripción adicional', `solicitud ${request._id}.descripcion`),
    fecha_inicio: dateValue(startDate, `fecha_inicio de ${request._id}`),
    fecha_fin: dateValue(endDate, `fecha_fin de ${request._id}`),
    id_alumno: studentId,
    id_personal: staffId
  };
}

async function readCollections(connection, names) {
  const documents = [];
  for (const name of names) {
    documents.push(...await connection.collection(name).find({}).toArray());
  }
  return documents;
}

function uniqueById(documents) {
  return [...new Map(documents.map((document) => [String(document._id), document])).values()];
}

async function insertIfMissing(collection, documents) {
  if (documents.length === 0) return;
  await collection.bulkWrite(documents.map((document) => ({
    updateOne: {
      filter: { _id: document._id },
      update: { $setOnInsert: document },
      upsert: true
    }
  })), { ordered: true });
}

async function normalizeReceiptField(collection) {
  await collection.updateMany(
    { prueba: { $exists: true }, receta: { $exists: false } },
    { $rename: { prueba: 'receta' } }
  );
  await collection.updateMany(
    { prueba: { $exists: true } },
    { $unset: { prueba: '' } }
  );
}

async function migrate() {
  if (sourceUri === targetUri) {
    throw new Error('La base fuente y la base destino deben ser distintas.');
  }

  const source = await mongoose.createConnection(sourceUri).asPromise();
  const target = await mongoose.createConnection(targetUri).asPromise();

  try {
    const sourceStudents = uniqueById([
      ...(await readCollections(source, ['alumnos'])),
      ...(await source.collection('users').find({ role: 'student' }).toArray())
    ]);
    const sourceStaff = uniqueById([
      ...(await readCollections(source, ['personalorientacions', 'personal'])),
      ...(await source.collection('users').find({ role: 'staff' }).toArray())
    ]);
    const studentsById = new Map(sourceStudents.map((student) => [String(student._id), student]));
    const studentsByAccount = new Map(sourceStudents.map((student) => [
      String(student.correo || student.account || '').toLowerCase(),
      student
    ]));
    const staffById = new Map(sourceStaff.map((person) => [String(person._id), person]));

    const targetStaff = await target.collection('personal').find({}, { projection: { _id: 1 } }).toArray();
    const fallbackStaffId = targetStaff[0]?._id || sourceStaff[0]?._id || null;
    const requests = uniqueById(await readCollections(source, ['solicitudjustificantes', 'solicitud_justificante', 'justifications']));
    const requestsById = new Map();
    const canonicalRequests = requests.map((request) => {
      const student = studentsById.get(String(referenceId(request.id_alumno || request.userId)))
        || studentsByAccount.get(String(request.correo_alumno || request.account || '').toLowerCase());
      const normalized = requestDocument(request, student, fallbackStaffId);
      requestsById.set(String(normalized._id), normalized);
      return normalized;
    });

    await insertIfMissing(
      target.collection('alumnos'),
      sourceStudents.map(studentDocument)
    );
    await insertIfMissing(
      target.collection('personal'),
      sourceStaff.map(staffDocument)
    );
    await insertIfMissing(
      target.collection('solicitud_justificante'),
      canonicalRequests
    );
    await normalizeReceiptField(target.collection('solicitud_justificante'));

    const officials = uniqueById(await readCollections(source, ['justificanteoficials', 'justificanteoficiales', 'justificante']));
    const officialByRequest = new Map();
    for (const official of officials) {
      const requestId = referenceId(official.id_solicitud || official.requestId)
        || (typeof official.folio === 'string' && official.folio.startsWith('OF-')
          ? official.folio.slice(3)
          : null);
      if (!requestId) throw new Error(`El justificante ${official._id} no tiene una solicitud relacionada.`);
      officialByRequest.set(String(requestId).replace(/^OF-/i, '').toLowerCase(), official);
    }
    for (const request of canonicalRequests) {
      if (request.estatus === 'APROBADO' && !officialByRequest.has(String(request._id))) {
        officialByRequest.set(String(request._id), {});
      }
    }

    const officialDocuments = [...officialByRequest.entries()].map(([requestId, legacy]) => {
      const request = requestsById.get(requestId);
      if (!request) throw new Error(`No se encontró la solicitud ${requestId} de un justificante.`);
      const sourceStaffId = referenceId(legacy.id_personal || legacy.id_orientador);
      const idPersonal = request.id_personal || sourceStaffId || fallbackStaffId;
      if (!idPersonal || !staffById.has(String(idPersonal)) && !targetStaff.some((person) => String(person._id) === String(idPersonal))) {
        throw new Error(`No se encontró personal asociado al justificante de la solicitud ${requestId}.`);
      }
      const issuedAt = dateValue(legacy.fecha_emision || request.updatedAt || request.fecha_solicitud, `fecha_emision de ${requestId}`);
      return {
        _id: legacy._id || new mongoose.Types.ObjectId(),
        folio: legacy.folio || legacy.num_folio_oficial || `OF-${String(requestId).toUpperCase()}`,
        motivo: legacy.motivo || request.motivo,
        fecha_inicio: dateValue(legacy.fecha_inicio || request.fecha_inicio, `fecha_inicio de ${requestId}`),
        fecha_fin: dateValue(legacy.fecha_fin || request.fecha_fin, `fecha_fin de ${requestId}`),
        descripcion: legacy.descripcion || legacy.comentarios_dictamen || request.descripcion,
        fecha_emision: issuedAt,
        id_alumno: request.id_alumno,
        id_personal: idPersonal
      };
    });
    await insertIfMissing(target.collection('justificante'), officialDocuments);

    const legacyRequestsCollection = target.collection('justificantes');
    const legacyRequestCount = await legacyRequestsCollection.countDocuments();
    if (legacyRequestCount > 0) {
      throw new Error('La colección antigua "justificantes" todavía contiene datos; no se eliminó.');
    }
    await target.db.dropCollection('justificantes').catch((error) => {
      if (error.codeName !== 'NamespaceNotFound') throw error;
    });

    const justificationIndexes = await target.collection('justificante').indexes();
    for (const index of justificationIndexes) {
      if (index.unique && index.key.folio && Object.keys(index.key).length === 1) {
        await target.collection('justificante').dropIndex(index.name);
      }
    }

    await Promise.all([
      target.collection('alumnos').createIndex({ correo: 1 }, { unique: true }),
      target.collection('alumnos').createIndex({ matricula: 1 }, { unique: true }),
      target.collection('personal').createIndex({ correo: 1 }, { unique: true }),
      target.collection('solicitud_justificante').createIndex({ id_alumno: 1, fecha_solicitud: -1 }),
      target.collection('justificante').createIndex({ folio: 1 })
    ]);

    const counts = {
      alumnos: await target.collection('alumnos').countDocuments(),
      personal: await target.collection('personal').countDocuments(),
      solicitud_justificante: await target.collection('solicitud_justificante').countDocuments(),
      justificante: await target.collection('justificante').countDocuments()
    };
    console.log(JSON.stringify({
      sourceDatabase: source.name,
      targetDatabase: target.name,
      sourcePreserved: true,
      collections: counts
    }, null, 2));
  } finally {
    await Promise.all([source.close(), target.close()]);
  }
}

migrate().catch((error) => {
  console.error(`No se pudo migrar la base a justificat: ${error.message}`);
  process.exitCode = 1;
});
