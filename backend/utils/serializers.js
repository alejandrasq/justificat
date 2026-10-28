function academicDetails(student) {
  const match = String(student.semestre_grupo || '').match(/^(\d+)\s*[-/ ]?\s*(.*)$/);
  return {
    semester: match ? Number(match[1]) : '',
    group: match ? match[2] : ''
  };
}

function publicUser(user, role) {
  if (role === 'staff') {
    return {
      _id: user._id,
      account: user.correo,
      fullName: user.nombre,
      studentId: '',
      career: '',
      semester: '',
      group: '',
      role
    };
  }

  const { semester, group } = academicDetails(user);
  return {
    _id: user._id,
    account: user.correo,
    fullName: user.nombre,
    studentId: user.matricula,
    career: user.especialidad,
    semester,
    group,
    shift: user.turno || 'Matutino',
    role
  };
}

function publicStudent(student) {
  const { semester, group } = academicDetails(student);
  return {
    _id: student._id,
    account: student.correo,
    fullName: student.nombre,
    studentId: student.matricula,
    career: student.especialidad,
    semester,
    group,
    shift: student.turno || 'Matutino'
  };
}

function dateOnly(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function publicRequest(request, { folio = '' } = {}) {
  const doc = request.toObject ? request.toObject() : request;
  const student = doc.id_alumno || {};
  const { semester, group } = academicDetails(student);
  const receiptPath = doc.receta || doc.prueba || '';
  const filename = receiptPath.split('/').pop() || '';
  const status = {
    PENDIENTE: doc.id_personal ? 'review' : 'pending',
    APROBADO: 'issued',
    RECHAZADO: 'rejected'
  }[doc.estatus] || 'pending';
  const description = String(doc.descripcion || '').trim();
  const visibleDescription = description.toLocaleLowerCase('es-MX') === 'sin descripción adicional'
    ? ''
    : description;

  return {
    _id: doc._id,
    userId: doc.id_alumno?._id || doc.id_alumno,
    account: student.correo || '',
    studentName: student.nombre || '',
    studentId: student.matricula || '',
    career: student.especialidad || '',
    shift: student.turno || 'Matutino',
    semester,
    group,
    startDate: dateOnly(doc.fecha_inicio),
    endDate: dateOnly(doc.fecha_fin),
    reason: doc.motivo,
    description: visibleDescription,
    status,
    attachments: filename ? [{
      filename,
      originalname: filename,
      path: receiptPath,
      mimetype: /\.pdf$/i.test(filename) ? 'application/pdf' : 'image'
    }] : [],
    createdAt: doc.fecha_solicitud,
    folio
  };
}

module.exports = { academicDetails, dateOnly, publicRequest, publicStudent, publicUser };
