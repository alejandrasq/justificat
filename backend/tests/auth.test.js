process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createSessionToken, requireAuth, requireRole, verifySessionToken } = require('../middleware/auth');
const Alumno = require('../models/Alumno');
const PersonalOrientacion = require('../models/PersonalOrientacion');
const SolicitudJustificante = require('../models/SolicitudJustificante');
const JustificanteOficial = require('../models/JustificanteOficial');
const { publicRequest, publicUser } = require('../utils/serializers');
const { folioFromSequence } = require('../utils/folio');
const {
  isAllowedStaffAccount,
  isInstitutionalEmail,
  isValidPersonName,
  normalizePersonName
} = require('../utils/validation');

test('institutional email validation only accepts the school domain', () => {
  assert.equal(isInstitutionalEmail('student@cbtis258.edu.mx'), true);
  assert.equal(isInstitutionalEmail('STUDENT@CBTIS258.EDU.MX'), true);
  assert.equal(isInstitutionalEmail('student@example.edu'), false);
  assert.equal(isInstitutionalEmail('student@cbtis258.edu.mx.example.com'), false);
  assert.equal(isInstitutionalEmail('student name@cbtis258.edu.mx'), false);
});

test('only the exact justificat staff account can omit the institutional domain', () => {
  assert.equal(isAllowedStaffAccount('justificat'), true);
  assert.equal(isAllowedStaffAccount('JUSTIFICAT'), true);
  assert.equal(isAllowedStaffAccount('staff@cbtis258.edu.mx'), true);
  assert.equal(isAllowedStaffAccount('other-account'), false);
  assert.equal(isAllowedStaffAccount('justificat@example.com'), false);
});

test('person names allow only letters and spaces and are stored in uppercase', () => {
  assert.equal(isValidPersonName('Paula Santes Quiñones'), true);
  assert.equal(isValidPersonName('María José'), true);
  assert.equal(isValidPersonName('Paula2'), false);
  assert.equal(isValidPersonName('Paula-Santes'), false);
  assert.equal(isValidPersonName(''), false);
  assert.equal(normalizePersonName('  María   José  '), 'MARÍA JOSÉ');
});

test('session tokens verify for a valid user and expiry', () => {
  const now = Date.now();
  const userId = '507f1f77bcf86cd799439011';
  const token = createSessionToken(userId, 'staff', now);

  assert.equal(verifySessionToken(token, now)?.sub, userId);
  assert.equal(verifySessionToken(token, now)?.role, 'staff');
  assert.equal(verifySessionToken(token, now + 8 * 60 * 60 * 1000), null);
});

test('session tokens reject tampered payloads and invalid identifiers', () => {
  const now = Date.now();
  const token = createSessionToken('507f1f77bcf86cd799439011', 'student', now);
  const [payload, signature] = token.split('.');

  const tamperedPayload = `${payload[0] === 'A' ? 'B' : 'A'}${payload.slice(1)}`;
  assert.equal(verifySessionToken(`${tamperedPayload}.${signature}`, now), null);
  assert.equal(verifySessionToken(createSessionToken('not-a-user-id', 'student', now), now), null);
});

test('only staff passes the staff-role guard', () => {
  let nextCalled = false;
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    }
  };

  requireRole('staff')({ user: { role: 'student' } }, response, () => { nextCalled = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);

  requireRole('staff')({ user: { role: 'staff' } }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('protected routes reject requests without a session cookie', async () => {
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    }
  };

  await requireAuth({ headers: {} }, response, () => {});
  assert.equal(response.statusCode, 401);
});

test('orientation staff accounts use their dedicated collection and required fields', async () => {
  const staff = new PersonalOrientacion({
    correo: 'staff@example.edu',
    'contraseña': 'hashed-password',
    nombre: 'Control Escolar'
  });

  await assert.doesNotReject(staff.validate());
  assert.equal(PersonalOrientacion.collection.collectionName, 'personal');
});

test('student collection requires the fields shown in the target data model', async () => {
  const student = new Alumno({
    correo: 'student@example.edu',
    'contraseña': 'hashed-password',
    nombre: 'Estudiante'
  });

  await assert.rejects(student.validate(), (error) => {
    assert.ok(error.errors.matricula);
    assert.ok(error.errors.semestre_grupo);
    assert.ok(error.errors.especialidad);
    return true;
  });
  assert.equal(Alumno.collection.collectionName, 'alumnos');
});

test('student control number must contain 1 to 14 digits', async () => {
  const createStudent = (studentId) => new Alumno({
    correo: 'student@example.edu',
    'contraseña': 'hashed-password',
    nombre: 'Estudiante',
    matricula: studentId,
    semestre_grupo: '3-A',
    especialidad: 'Programación'
  });

  await assert.doesNotReject(createStudent('00123456789012').validate());
  await assert.rejects(createStudent('123456789012345').validate(), (error) => {
    assert.ok(error.errors.matricula);
    return true;
  });
  await assert.rejects(createStudent('1234A').validate(), (error) => {
    assert.ok(error.errors.matricula);
    return true;
  });
});

test('students default to the morning shift and only accept configured shifts', async () => {
  const createStudent = (shift) => new Alumno({
    correo: `student-${shift || 'default'}@example.edu`,
    'contraseña': 'hashed-password',
    nombre: 'Estudiante',
    matricula: '12345',
    semestre_grupo: '3-A',
    especialidad: 'Programación',
    ...(shift ? { turno: shift } : {})
  });

  assert.equal(createStudent().turno, 'Matutino');
  await assert.doesNotReject(createStudent('Vespertino').validate());
  await assert.rejects(createStudent('Nocturno').validate(), (error) => {
    assert.ok(error.errors.turno);
    return true;
  });
});

test('student login data includes the shift and defaults older accounts to morning', () => {
  const student = {
    _id: new mongoose.Types.ObjectId(),
    correo: 'student@example.edu',
    nombre: 'Estudiante',
    matricula: '12345',
    especialidad: 'Programación',
    semestre_grupo: '3-A'
  };

  assert.equal(publicUser(student, 'student').shift, 'Matutino');
  assert.equal(publicUser({ ...student, turno: 'Vespertino' }, 'student').shift, 'Vespertino');
});

test('application collections and fields match the target MongoDB structure', () => {
  assert.equal(Alumno.collection.collectionName, 'alumnos');
  assert.equal(JustificanteOficial.collection.collectionName, 'justificante');
  assert.equal(PersonalOrientacion.collection.collectionName, 'personal');
  assert.equal(SolicitudJustificante.collection.collectionName, 'solicitud_justificante');
  assert.equal(Alumno.schema.options.timestamps, undefined);
  assert.equal(Alumno.schema.options.versionKey, false);
  assert.equal(Alumno.schema.path('semestre_grupo').instance, 'String');
  assert.ok(Alumno.schema.path('especialidad'));
  assert.deepEqual(Alumno.schema.path('turno').enumValues, ['Matutino', 'Vespertino']);
  assert.equal(PersonalOrientacion.schema.options.timestamps, undefined);
  assert.equal(SolicitudJustificante.schema.options.timestamps, undefined);
  assert.equal(JustificanteOficial.schema.options.timestamps, undefined);
  assert.equal(SolicitudJustificante.schema.options.versionKey, false);
  assert.equal(JustificanteOficial.schema.options.versionKey, false);
  assert.equal(SolicitudJustificante.schema.path('prueba'), undefined);
  assert.equal(SolicitudJustificante.schema.path('receta').instance, 'String');
  assert.equal(SolicitudJustificante.schema.path('fecha_inicio').instance, 'Date');
  assert.equal(SolicitudJustificante.schema.path('fecha_fin').instance, 'Date');
  assert.deepEqual(SolicitudJustificante.schema.path('estatus').enumValues, ['PENDIENTE', 'APROBADO', 'RECHAZADO']);
  assert.equal(SolicitudJustificante.schema.path('folio'), undefined);
  assert.equal(SolicitudJustificante.schema.path('receta_medica_pdf'), undefined);
  assert.ok(SolicitudJustificante.schema.path('id_alumno'));
  assert.ok(SolicitudJustificante.schema.path('id_personal'));
  assert.ok(JustificanteOficial.schema.path('folio'));
  assert.equal(JustificanteOficial.schema.path('folio').options.unique, undefined);
  assert.ok(JustificanteOficial.schema.path('motivo'));
  assert.ok(JustificanteOficial.schema.path('fecha_inicio'));
  assert.ok(JustificanteOficial.schema.path('fecha_fin'));
  assert.ok(JustificanteOficial.schema.path('descripcion'));
  assert.ok(JustificanteOficial.schema.path('fecha_emision'));
  assert.ok(JustificanteOficial.schema.path('id_alumno'));
  assert.ok(JustificanteOficial.schema.path('id_personal'));
  assert.equal(JustificanteOficial.schema.path('id_solicitud'), undefined);
});

test('official justification folios cycle from 1 through 200', () => {
  assert.equal(folioFromSequence(1), '1');
  assert.equal(folioFromSequence(200), '200');
  assert.equal(folioFromSequence(201), '1');
  assert.equal(folioFromSequence(400), '200');
  assert.equal(folioFromSequence(401), '1');
  assert.throws(() => folioFromSequence(0), RangeError);
});

test('request serializer maps the MongoDB schema to the application view', () => {
  const studentId = new Alumno({
    _id: new mongoose.Types.ObjectId(),
    correo: 'student@example.edu',
    'contraseña': 'hashed-password',
    nombre: 'Estudiante',
    matricula: '12345',
    especialidad: 'Programación',
    semestre_grupo: '3-A'
  });
  const request = {
    _id: new mongoose.Types.ObjectId(),
    id_alumno: studentId.toObject(),
    id_personal: null,
    fecha_inicio: new Date('2025-02-20T00:00:00.000Z'),
    fecha_fin: new Date('2025-02-22T23:59:59.999Z'),
    fecha_solicitud: new Date('2025-02-20T10:15:00.000Z'),
    motivo: 'Médico',
    descripcion: 'Cita médica',
    estatus: 'PENDIENTE',
    receta: '/uploads/123-456.pdf'
  };
  const serialized = publicRequest(request);

  assert.equal(serialized.studentName, 'Estudiante');
  assert.equal(serialized.startDate, '2025-02-20');
  assert.equal(serialized.endDate, '2025-02-22');
  assert.equal(serialized.studentName, 'Estudiante');
  assert.equal(serialized.career, 'Programación');
  assert.equal(serialized.semester, 3);
  assert.equal(serialized.group, 'A');
  assert.equal(serialized.shift, 'Matutino');
  assert.equal(serialized.status, 'pending');
  assert.equal(serialized.folio, '');
  assert.equal(publicRequest(request, { folio: '1' }).folio, '1');
  assert.equal(serialized.attachments.length, 1);
  assert.equal(serialized.attachments[0].filename, '123-456.pdf');

  assert.equal(publicRequest({
    ...request,
    descripcion: 'Sin descripción adicional'
  }).description, '');
});
