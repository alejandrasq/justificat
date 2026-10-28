const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Alumno = require('../models/Alumno');
const PersonalOrientacion = require('../models/PersonalOrientacion');
const SolicitudJustificante = require('../models/SolicitudJustificante');
const JustificanteOficial = require('../models/JustificanteOficial');
const { publicStudent, publicUser } = require('../utils/serializers');
const { isInstitutionalEmail, isValidPersonName, normalizePersonName } = require('../utils/validation');
const {
  clearSessionCookie,
  requireAuth,
  requireRole,
  requireSameOrigin,
  setSessionCookie
} = require('../middleware/auth');

const VALID_CAREERS = [
  'Programación', 'Mecánica Industrial', 'Prep. Alimentos y Bebidas', 'Contabilidad',
  'Logística', 'Servicios de Hospedaje', 'Ciberseguridad', 'Inteligencia Artificial'
];
const VALID_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'J'];
const VALID_SHIFTS = ['Matutino', 'Vespertino'];
const isValidStudentId = (value) => typeof value === 'string' && /^[0-9]{1,14}$/.test(value);
const isValidShift = (value) => VALID_SHIFTS.includes(value);
const isValidCareerAndGroup = (career, group) => (
  typeof career === 'string' && VALID_CAREERS.includes(career.trim())
  && typeof group === 'string' && VALID_GROUPS.includes(group.trim().toUpperCase())
);

// Ruta de Registro (Sustituye a register.php)
router.post('/register', async (req, res) => {
  try {
    const { account, password, fullName, studentId, career, semester, group, shift } = req.body;

    // Validaciones de campos obligatorios
    if (
      typeof account !== 'string' || typeof password !== 'string'
      || typeof fullName !== 'string' || typeof studentId !== 'string'
      || typeof career !== 'string' || typeof group !== 'string' || typeof shift !== 'string'
      || !account.trim() || !password || !fullName.trim()
      || !studentId.trim() || !career.trim() || !group.trim()
    ) {
      return res.status(422).json({ error: 'Revisa los datos escolares: completa todos los campos.' });
    }

    if (!isInstitutionalEmail(account)) {
      return res.status(422).json({ error: 'El correo debe terminar en @cbtis258.edu.mx.' });
    }

    if (!isValidPersonName(fullName)) {
      return res.status(422).json({ error: 'El nombre solo debe contener letras y espacios.' });
    }

    if (!isValidStudentId(studentId)) {
      return res.status(422).json({ error: 'El número de control debe contener únicamente números y tener máximo 14 dígitos.' });
    }
    if (!isValidShift(shift)) {
      return res.status(422).json({ error: 'Selecciona un turno válido.' });
    }
    if (!isValidCareerAndGroup(career, group)) {
      return res.status(422).json({ error: 'Selecciona una especialidad y grupo válidos.' });
    }

    const semesterNumber = Number(semester);
    if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 6) {
      return res.status(422).json({ error: 'Selecciona un semestre válido.' });
    }

    if (password.length < 8) {
      return res.status(422).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const lowerAccount = account.toLowerCase().trim();

    // Comprobar si el correo o la matrícula ya están registrados
    const existingAccount = await Promise.all([
      Alumno.exists({ correo: lowerAccount }),
      PersonalOrientacion.exists({ correo: lowerAccount })
    ]);
    if (existingAccount.some(Boolean)) {
      return res.status(409).json({ error: 'Ese correo institucional ya está registrado.' });
    }

    const existingStudentId = await Alumno.findOne({ matricula: studentId.trim() });
    if (existingStudentId) {
      return res.status(409).json({ error: 'Esa matrícula ya está registrada.' });
    }

    // Encriptar la contraseña (reemplaza password_hash de PHP)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Guardar el nuevo usuario en MongoDB
    const newUser = new Alumno({
      correo: lowerAccount,
      'contraseña': passwordHash,
      nombre: normalizePersonName(fullName),
      matricula: studentId.trim(),
      especialidad: career.trim(),
      turno: shift,
      semestre_grupo: `${semesterNumber}-${group.trim().toUpperCase()}`
    });

    await newUser.save();
    res.status(201).json({ message: 'Cuenta creada correctamente.' });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Ruta de Login (Sustituye a login.php)
router.post('/login', async (req, res) => {
  try {
    const { account, password } = req.body;

    if (typeof account !== 'string' || typeof password !== 'string' || !account.trim() || !password) {
      return res.status(400).json({ error: 'Escribe la cuenta y la contraseña.' });
    }

    const lowerAccount = account.toLowerCase().trim();
    let user = await Alumno.findOne({ correo: lowerAccount });
    let role = 'student';
    if (!user) {
      user = await PersonalOrientacion.findOne({ correo: lowerAccount });
      role = 'staff';
    }

    if (!user) {
      return res.status(401).json({ error: 'La cuenta o la contraseña no son correctas.' });
    }

    // Verificar contraseña encriptada
    const isMatch = await bcrypt.compare(password, user['contraseña']);
    if (!isMatch) {
      return res.status(401).json({ error: 'La cuenta o la contraseña no son correctas.' });
    }

    setSessionCookie(res, user._id, role);

    // Respuesta con los datos del usuario
    res.status(200).json({
      user: publicUser(user, role)
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.put('/profile', requireAuth, requireRole('student'), requireSameOrigin, async (req, res) => {
  try {
    const { account, fullName, studentId, career, semester, group, shift, currentPassword, newPassword } = req.body || {};
    if (
      typeof account !== 'string' || typeof fullName !== 'string' || typeof studentId !== 'string'
      || typeof career !== 'string' || typeof group !== 'string' || typeof shift !== 'string'
      || typeof currentPassword !== 'string'
      || !account.trim() || !fullName.trim() || !studentId.trim() || !career.trim()
      || !group.trim() || !currentPassword
    ) {
      return res.status(422).json({ error: 'Completa todos tus datos y escribe tu contraseña actual para confirmar los cambios.' });
    }

    if (!isInstitutionalEmail(account)) {
      return res.status(422).json({ error: 'El correo debe terminar en @cbtis258.edu.mx.' });
    }
    if (!isValidPersonName(fullName)) {
      return res.status(422).json({ error: 'El nombre solo debe contener letras y espacios.' });
    }
    if (!isValidStudentId(studentId)) {
      return res.status(422).json({ error: 'El número de control debe contener únicamente números y tener máximo 14 dígitos.' });
    }
    if (!isValidShift(shift)) {
      return res.status(422).json({ error: 'Selecciona un turno válido.' });
    }
    if (!isValidCareerAndGroup(career, group)) {
      return res.status(422).json({ error: 'Selecciona una especialidad y grupo válidos.' });
    }

    const semesterNumber = Number(semester);
    if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 6) {
      return res.status(422).json({ error: 'Selecciona un semestre válido.' });
    }
    if (newPassword !== undefined && (typeof newPassword !== 'string' || (newPassword && newPassword.length < 8))) {
      return res.status(422).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }

    const student = await Alumno.findById(req.user._id);
    if (!student) return res.status(404).json({ error: 'No se encontró el perfil del alumno.' });

    const currentPasswordMatches = await bcrypt.compare(currentPassword, student['contraseña']);
    if (!currentPasswordMatches) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }

    const normalizedAccount = account.toLowerCase().trim();
    const [existingAccount, existingStudentId] = await Promise.all([
      Promise.all([
        Alumno.exists({ correo: normalizedAccount, _id: { $ne: student._id } }),
        PersonalOrientacion.exists({ correo: normalizedAccount })
      ]),
      Alumno.exists({ matricula: studentId.trim(), _id: { $ne: student._id } })
    ]);
    if (existingAccount.some(Boolean)) {
      return res.status(409).json({ error: 'Ese correo institucional ya está registrado.' });
    }
    if (existingStudentId) {
      return res.status(409).json({ error: 'Esa matrícula ya está registrada.' });
    }

    student.correo = normalizedAccount;
    student.nombre = normalizePersonName(fullName);
    student.matricula = studentId.trim();
    student.especialidad = career.trim();
    student.turno = shift;
    student.semestre_grupo = `${semesterNumber}-${group.trim().toUpperCase()}`;
    if (newPassword) {
      student['contraseña'] = await bcrypt.hash(newPassword, 10);
    }

    await student.save();
    res.json({ user: publicUser(student, 'student') });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'El correo o la matrícula ya están registrados.' });
    }
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ error: 'No se pudo actualizar el perfil.' });
  }
});

router.put('/staff-profile', requireAuth, requireRole('staff'), requireSameOrigin, async (req, res) => {
  try {
    const { account, fullName, currentPassword, newPassword } = req.body || {};
    if (
      typeof account !== 'string' || typeof fullName !== 'string'
      || typeof currentPassword !== 'string' || !account.trim() || !fullName.trim() || !currentPassword
    ) {
      return res.status(422).json({ error: 'Completa tu nombre y cuenta, y escribe tu contraseña actual para confirmar los cambios.' });
    }
    if (!isAllowedStaffAccount(account)) {
      return res.status(422).json({ error: 'Usa una cuenta @gmail.com válida.' });
    }
    if (!isValidPersonName(fullName)) {
      return res.status(422).json({ error: 'El nombre solo debe contener letras y espacios.' });
    }
    if (newPassword !== undefined && (typeof newPassword !== 'string' || (newPassword && newPassword.length < 8))) {
      return res.status(422).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }

    const staff = await PersonalOrientacion.findById(req.user._id);
    if (!staff) return res.status(404).json({ error: 'No se encontró el perfil de personal.' });

    const currentPasswordMatches = await bcrypt.compare(currentPassword, staff['contraseña']);
    if (!currentPasswordMatches) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }

    const normalizedAccount = account.toLowerCase().trim();
    const [existingStaff, existingStudent] = await Promise.all([
      PersonalOrientacion.exists({ correo: normalizedAccount, _id: { $ne: staff._id } }),
      Alumno.exists({ correo: normalizedAccount })
    ]);
    if (existingStaff || existingStudent) {
      return res.status(409).json({ error: 'Esa cuenta ya está registrada.' });
    }

    staff.correo = normalizedAccount;
    staff.nombre = normalizePersonName(fullName);
    if (newPassword) {
      staff['contraseña'] = await bcrypt.hash(newPassword, 10);
    }

    await staff.save();
    res.json({ user: publicUser(staff, 'staff') });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Esa cuenta ya está registrada.' });
    }
    console.error('Error al actualizar perfil de personal:', error);
    res.status(500).json({ error: 'No se pudo actualizar el perfil.' });
  }
});

router.post('/logout', requireSameOrigin, (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

// Obtener la lista de todos los alumnos registrados
router.get('/students', requireAuth, requireRole('staff'), async (req, res) => {
  try {
    const students = await Alumno.find().select('-contraseña').sort({ nombre: 1 });
    res.json({ students: students.map(publicStudent) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/students/bulk', requireAuth, requireRole('staff'), requireSameOrigin, async (req, res) => {
  try {
    const { semester, group, career, shift } = req.body || {};
    const semesterNumber = Number(semester);
    if (
      !Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 6
      || !['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'J'].includes(group)
      || !VALID_CAREERS.includes(career)
      || !isValidShift(shift)
    ) {
      return res.status(422).json({ error: 'Selecciona semestre, grupo, especialidad y turno válidos.' });
    }

    const shiftCriteria = shift === 'Matutino'
      ? { $or: [{ turno: 'Matutino' }, { turno: { $exists: false } }, { turno: null }, { turno: '' }] }
      : { turno: shift };
    const studentFilter = {
      especialidad: career,
      semestre_grupo: new RegExp(`^${semesterNumber}\\s*[-/ ]?\\s*${group}$`),
      ...shiftCriteria
    };
    const matchingStudents = await Alumno.find(studentFilter).select('_id').lean();
    const studentIds = matchingStudents.map((student) => student._id);
    if (studentIds.length === 0) {
      return res.json({ deletedStudents: 0, deletedRequests: 0, deletedJustifications: 0 });
    }

    const requestResult = await SolicitudJustificante.deleteMany({ id_alumno: { $in: studentIds } });
    const justificationResult = await JustificanteOficial.deleteMany({ id_alumno: { $in: studentIds } });
    const studentResult = await Alumno.deleteMany({ _id: { $in: studentIds } });

    res.json({
      deletedStudents: studentResult.deletedCount,
      deletedRequests: requestResult.deletedCount,
      deletedJustifications: justificationResult.deletedCount
    });
  } catch (error) {
    console.error('Error al eliminar grupo de alumnos:', error);
    res.status(500).json({ error: 'No se pudo completar el borrado masivo.' });
  }
});

// Actualizar datos de un alumno
router.put('/students/:id', requireAuth, requireRole('staff'), requireSameOrigin, async (req, res) => {
  try {
    const { account, fullName, studentId, career, semester, group, shift } = req.body;
    if (!isValidPersonName(fullName)) {
      return res.status(422).json({ error: 'El nombre solo debe contener letras y espacios.' });
    }

    if (!isValidStudentId(studentId)) {
      return res.status(422).json({ error: 'El número de control debe contener únicamente números y tener máximo 14 dígitos.' });
    }

    const semesterNumber = Number(semester);
    if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 6) {
      return res.status(422).json({ error: 'Selecciona un semestre válido.' });
    }
    if (!isValidShift(shift)) {
      return res.status(422).json({ error: 'Selecciona un turno válido.' });
    }
    if (!isValidCareerAndGroup(career, group)) {
      return res.status(422).json({ error: 'Selecciona una especialidad y grupo válidos.' });
    }
    const updated = await Alumno.findByIdAndUpdate(
      req.params.id,
      {
        correo: account,
        nombre: normalizePersonName(fullName),
        matricula: studentId,
        especialidad: career,
        turno: shift,
        semestre_grupo: `${semesterNumber}-${String(group).trim().toUpperCase()}`
      },
      { new: true, runValidators: true }
    ).select('-contraseña');
    if (!updated) return res.status(404).json({ error: 'Alumno no encontrado.' });
    res.json(publicStudent(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un alumno de la base de datos
router.delete('/students/:id', requireAuth, requireRole('staff'), requireSameOrigin, async (req, res) => {
  try {
    const deleted = await Alumno.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Alumno no encontrado.' });
    res.json({ message: 'Alumno eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;