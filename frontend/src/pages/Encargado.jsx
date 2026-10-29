import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { formatDate } from '../utils/date';
import { getInitials } from '../utils/initials';
import { formatLastNamesFirst } from '../utils/personName';
import LoadingState from '../components/LoadingState';

const CAREER_OPTIONS = [
  'Programación',
  'Mecánica Industrial',
  'Prep. Alimentos y Bebidas',
  'Contabilidad',
  'Logística',
  'Servicios de Hospedaje',
  'Ciberseguridad',
  'Inteligencia Artificial'
];
const GROUP_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'J'];
const SHIFT_OPTIONS = ['Matutino', 'Vespertino'];

export default function Encargado() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = ['alumnos', 'perfil'].includes(requestedTab) ? requestedTab : 'solicitudes';
  const [sessionUser, setSessionUser] = useState(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [profileForm, setProfileForm] = useState({
    account: '',
    fullName: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilters, setStudentFilters] = useState({ career: '', semester: '', group: '', shift: '' });
  const [bulkDeleteCriteria, setBulkDeleteCriteria] = useState({ semester: '', group: '', career: '', shift: '' });
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [toast, setToast] = useState({ text: '', isError: false });
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);

  const showToast = useCallback((text, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast({ text: '', isError: false }), 5000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [resRequests, resStudents] = await Promise.all([
        api.get('/justifications'),
        api.get('/auth/students')
      ]);
      setRequests(resRequests.data || []);
      setStudents(resStudents.data.students || []);
    } catch {
      showToast('Error al conectar con la base de datos.', true);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    api.get('/me')
      .then(async ({ data }) => {
        if (!active) return;
        if (data.user.role !== 'staff') {
          navigate('/justificar');
          return;
        }
        setSessionUser(data.user);
        await loadData();
        if (active) setIsDashboardLoading(false);
      })
      .catch(() => {
        if (active) navigate('/login');
      });

    return () => {
      active = false;
    };
  }, [loadData, navigate]);

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/justifications/${id}/status`, { status });
      showToast('Estado de solicitud actualizado.');
      loadData();
    } catch {
      showToast('No se pudo actualizar el estado.', true);
    }
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!/^[\p{L}]+(?:\s+[\p{L}]+)*$/u.test((editingStudent.fullName || '').trim())) {
      showToast('El nombre solo debe contener letras y espacios.', true);
      return;
    }

    if (!/^[0-9]{1,14}$/.test(editingStudent.studentId || '')) {
      showToast('El número de control debe contener únicamente números y tener máximo 14 dígitos.', true);
      return;
    }

    try {
      await api.put(`/auth/students/${editingStudent._id}`, editingStudent);
      setEditingStudent(null);
      showToast('Alumno actualizado correctamente.');
      loadData();
    } catch {
      showToast('Error al actualizar datos.', true);
    }
  };

  const handleDeleteStudent = async () => {
    try {
      await api.delete(`/auth/students/${deletingStudent._id}`);
      setDeletingStudent(null);
      showToast('Alumno eliminado.');
      loadData();
    } catch {
      showToast('Error al eliminar alumno.', true);
    }
  };

  const handleBulkDeleteRequest = (event) => {
    event.preventDefault();
    const matchingCount = students.filter((student) => (
      Number(student.semester) === Number(bulkDeleteCriteria.semester)
      && student.group === bulkDeleteCriteria.group
      && student.career === bulkDeleteCriteria.career
      && (student.shift || 'Matutino') === bulkDeleteCriteria.shift
    )).length;
    setBulkDeleteConfirmation({ ...bulkDeleteCriteria, matchingCount });
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteConfirmation?.matchingCount) return;
    setIsBulkDeleting(true);
    try {
      const { data } = await api.delete('/auth/students/bulk', {
        data: {
          semester: bulkDeleteConfirmation.semester,
          group: bulkDeleteConfirmation.group,
          career: bulkDeleteConfirmation.career,
          shift: bulkDeleteConfirmation.shift
        }
      });
      setBulkDeleteConfirmation(null);
      setBulkDeleteCriteria({ semester: '', group: '', career: '', shift: '' });
      showToast(
        `Se eliminaron ${data.deletedStudents} alumnos, ${data.deletedRequests} solicitudes y ${data.deletedJustifications} justificantes.`
      );
      await loadData();
    } catch (error) {
      showToast(error.response?.data?.error || 'No se pudo eliminar el grupo.', true);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
      navigate('/login');
    } catch {
      showToast('No se pudo cerrar la sesión. Inténtalo de nuevo.', true);
    }
  };

  const openProfile = () => {
    setProfileForm({
      account: sessionUser?.account || '',
      fullName: sessionUser?.fullName || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setAccountMenuOpen(false);
    setActiveTab('perfil');
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    const normalizedValue = name === 'account' ? value.toLowerCase() : value;
    setProfileForm((current) => ({ ...current, [name]: normalizedValue }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
      showToast('La nueva contraseña y su confirmación no coinciden.', true);
      return;
    }
    if (profileForm.newPassword && profileForm.newPassword.length < 8) {
      showToast('La nueva contraseña debe tener al menos 8 caracteres.', true);
      return;
    }

    setProfileSaving(true);
    try {
      const { data } = await api.put('/staff-profile', {
        account: profileForm.account,
        fullName: profileForm.fullName,
        currentPassword: profileForm.currentPassword,
        ...(profileForm.newPassword ? { newPassword: profileForm.newPassword } : {})
      });
      setSessionUser(data.user);
      setProfileForm((current) => ({ ...current, currentPassword: '', newPassword: '', confirmPassword: '' }));
      showToast('Tu perfil se actualizó correctamente.');
    } catch (error) {
      showToast(error.response?.data?.error || 'No se pudo actualizar tu perfil.', true);
    } finally {
      setProfileSaving(false);
    }
  };

  const statusText = (status) => ({
    pending: 'Pendiente',
    review: 'En revisión',
    issued: 'Justificante emitido',
    rejected: 'No aprobada'
  }[status] || 'Pendiente');

  const getRequestCount = (account) => requests.filter((r) => r.account === account).length;
  const filteredStudents = students.filter((student) => {
    const searchValue = studentSearch.trim().toLocaleLowerCase('es-MX')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const searchableFields = [student.fullName, student.account, student.studentId]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('es-MX')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return (!searchValue || searchableFields.includes(searchValue))
      && (!studentFilters.career || student.career === studentFilters.career)
      && (!studentFilters.semester || String(student.semester) === studentFilters.semester)
      && (!studentFilters.group || student.group === studentFilters.group)
      && (!studentFilters.shift || (student.shift || 'Matutino') === studentFilters.shift);
  }).sort((studentA, studentB) => (
    Number(studentA.semester) - Number(studentB.semester)
    || (studentA.group || '').localeCompare(studentB.group || '', 'es-MX', { sensitivity: 'base' })
    || (studentA.career || '').localeCompare(studentB.career || '', 'es-MX', { sensitivity: 'base' })
    || formatLastNamesFirst(studentA.fullName || '').localeCompare(
      formatLastNamesFirst(studentB.fullName || ''),
      'es-MX',
      { sensitivity: 'base' }
    )
  ));
  const hasStudentFilters = studentSearch.trim()
    || studentFilters.career || studentFilters.semester || studentFilters.group || studentFilters.shift;
  const updateStudentFilter = (event) => {
    setStudentFilters((filters) => ({ ...filters, [event.target.name]: event.target.value }));
  };
  const clearStudentFilters = () => {
    setStudentSearch('');
    setStudentFilters({ career: '', semester: '', group: '', shift: '' });
  };

  return (
    <div>
      <header className="topbar staff-topbar staff-dashboard-topbar">
        <div className="wordmark">Justifica<span>T</span></div>
        <span className="staff-label"></span>
        <div className="staff-header-actions">
          <div className="account-menu">
            <button
              className="staff-account-trigger"
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-label="Menú de cuenta"
              aria-expanded={accountMenuOpen}
              aria-controls="staff-account-popup"
              title="Menú de cuenta"
            >
              <img className="account-mark" src="/dgti.png" alt="DGETI" />
            </button>
            {accountMenuOpen && (
              <div className="staff-account-popup" id="staff-account-popup">
                <button className="logout-button" type="button" onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-shell staff-dashboard-shell staff-scroll-shell">
        <nav className="sidebar staff-dashboard-sidebar">
          <button
            className={`nav-link ${activeTab === 'solicitudes' ? 'active' : ''}`}
            onClick={() => setActiveTab('solicitudes')}
            aria-label="Solicitudes"
            title="Solicitudes"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>
          </button>
          <button
            className={`nav-link ${activeTab === 'alumnos' ? 'active' : ''}`}
            onClick={() => setActiveTab('alumnos')}
            aria-label="Alumnos"
            title="Alumnos"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="10" cy="7" r="4"/>
              <path d="M20 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M17 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
          <button
            className={`nav-link student-profile-link ${activeTab === 'perfil' ? 'active' : ''}`}
            type="button"
            onClick={openProfile}
            aria-label="Ver perfil"
            aria-current={activeTab === 'perfil' ? 'page' : undefined}
            title="Ver perfil"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4"/>
              <path d="M5 21a7 7 0 0 1 14 0"/>
            </svg>
          </button>
        </nav>

        <main className="staff-main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CBTis 258 · Control escolar</p>
              <h1>
                {activeTab === 'solicitudes'
                  ? 'Solicitudes de justificante'
                  : activeTab === 'alumnos' ? 'Alumnos registrados en el plantel' : 'Mi perfil'}
              </h1>
              {activeTab === 'perfil' && <p className="heading-note">Consulta y actualiza la información de tu cuenta de personal.</p>}
            </div>
            <div className="student-chip">
              <span className="avatar">
                {getInitials(sessionUser?.account || sessionUser?.fullName, 'CE')}
              </span>
              <span className="student-name">{sessionUser?.fullName || sessionUser?.account || 'Control Escolar'}</span>
            </div>
          </div>

          {activeTab === 'solicitudes' && (
            <section className="staff-section">
              <div className="staff-section-heading">
                <div>
                  <h2>Solicitudes recibidas</h2>
                  <p>Revisa los comprobantes y autoriza los justificantes.</p>
                </div>
                <span className="total-chip">{requests.length} solicitudes</span>
              </div>

              {isDashboardLoading ? (
                <LoadingState label="Cargando solicitudes..." />
              ) : (
                <div className="staff-request-list">
                  {requests.map((req) => (
                    <article className="staff-request" key={req._id}>
                    <div className="request-card-head">
                      <div>
                        <h3>{req.studentName}</h3>
                        <p>{req.studentId} · {req.career} · {req.semester}° semestre · grupo {req.group} · turno {req.shift || 'Matutino'}</p>
                      </div>
                      <span className={`request-status ${req.status}`}>{statusText(req.status)}</span>
                    </div>

                    <div className="staff-request-details">
                      <span><strong>Fechas:</strong> {formatDate(req.startDate)} al {formatDate(req.endDate)}</span>
                      <span><strong>Motivo:</strong> {req.reason}</span>
                      <span><strong>Enviada:</strong> {new Date(req.createdAt).toLocaleDateString()}</span>
                      {req.description && <span><strong>Detalle:</strong> {req.description}</span>}
                    </div>

                    {req.attachments?.[0] && (
                      <div className="evidence-list">
                        <button
                          className="evidence-link"
                          type="button"
                          onClick={() => setSelectedEvidence(`http://localhost:5000/api/justifications/attachments/${encodeURIComponent(req.attachments[0].filename)}`)}
                        >
                          Ver comprobante: {req.attachments[0].originalname}
                        </button>
                      </div>
                    )}

                    <div className="request-actions">
                      {req.status !== 'review' && req.status !== 'issued' && (
                        <button className="staff-action" type="button" onClick={() => handleStatusChange(req._id, 'review')}>
                          Marcar en revisión
                        </button>
                      )}
                      <Link className="staff-action primary" to={`/generar-justificante?id=${req._id}`}>
                        {req.status === 'issued' ? 'Volver a generar' : 'Preparar justificante'}
                      </Link>
                      {req.status !== 'rejected' && (
                        <button className="staff-action danger" type="button" onClick={() => handleStatusChange(req._id, 'rejected')}>
                          Rechazar
                        </button>
                      )}
                    </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'alumnos' && (
            <div className="student-management">
              <div className="staff-section-heading">
                <h2>Alumnos registrados</h2>
                <div className="legend">
                  <span className="legend-item"><i className="legend-dot green"></i>1: bajo</span>
                  <span className="legend-item"><i className="legend-dot yellow"></i>2: atención</span>
                  <span className="legend-item"><i className="legend-dot red"></i>3+: seguimiento</span>
                </div>
              </div>

              {isDashboardLoading ? (
                <LoadingState label="Cargando alumnos..." />
              ) : (
                <>
                <div className="student-filter-bar">
                  <div className="student-search-field">
                    <label htmlFor="student-search">Buscar alumno</label>
                    <input
                      id="student-search"
                      type="search"
                      placeholder="Nombre, correo o matrícula"
                      value={studentSearch}
                      onChange={(event) => setStudentSearch(event.target.value)}
                    />
                  </div>
                  <div className="student-filter-field">
                    <label htmlFor="student-career-filter">Especialidad</label>
                    <select id="student-career-filter" name="career" value={studentFilters.career} onChange={updateStudentFilter}>
                      <option value="">Todos</option>
                      {CAREER_OPTIONS.map((career) => <option key={career} value={career}>{career}</option>)}
                    </select>
                  </div>
                  <div className="student-filter-field">
                    <label htmlFor="student-semester-filter">Semestre</label>
                    <select id="student-semester-filter" name="semester" value={studentFilters.semester} onChange={updateStudentFilter}>
                      <option value="">Todos</option>
                      {[1, 2, 3, 4, 5, 6].map((semester) => (
                        <option key={semester} value={semester}>{semester}°</option>
                      ))}
                    </select>
                  </div>
                  <div className="student-filter-field">
                    <label htmlFor="student-group-filter">Grupo</label>
                    <select id="student-group-filter" name="group" value={studentFilters.group} onChange={updateStudentFilter}>
                      <option value="">Todos</option>
                      {GROUP_OPTIONS.map((group) => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>
                  <div className="student-filter-field">
                    <label htmlFor="student-shift-filter">Turno</label>
                    <select id="student-shift-filter" name="shift" value={studentFilters.shift} onChange={updateStudentFilter}>
                      <option value="">Todos</option>
                      {SHIFT_OPTIONS.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
                    </select>
                  </div>
                  <div className="student-filter-summary" aria-live="polite">
                    {filteredStudents.length} de {students.length} alumnos
                    {hasStudentFilters && (
                      <button className="student-filter-clear" type="button" onClick={clearStudentFilters}>
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </div>
                <form className="bulk-delete-bar" onSubmit={handleBulkDeleteRequest}>
                  <div className="bulk-delete-heading">
                    <strong>Borrar grupo</strong>
                    <span>Elimina alumnos y justificantes.</span>
                  </div>
                  <div className="bulk-delete-field">
                    <label htmlFor="bulk-delete-semester">Semestre</label>
                    <select
                      id="bulk-delete-semester"
                      value={bulkDeleteCriteria.semester}
                      onChange={(event) => setBulkDeleteCriteria((criteria) => ({ ...criteria, semester: event.target.value }))}
                      required
                    >
                      <option value="" disabled>Selecciona semestre</option>
                      {[1, 2, 3, 4, 5, 6].map((semester) => <option key={semester} value={semester}>{semester}°</option>)}
                    </select>
                  </div>
                  <div className="bulk-delete-field">
                    <label htmlFor="bulk-delete-group">Grupo</label>
                    <select
                      id="bulk-delete-group"
                      value={bulkDeleteCriteria.group}
                      onChange={(event) => setBulkDeleteCriteria((criteria) => ({ ...criteria, group: event.target.value }))}
                      required
                    >
                      <option value="" disabled>Selecciona grupo</option>
                      {GROUP_OPTIONS.map((group) => <option key={group} value={group}>{group}</option>)}
                    </select>
                  </div>
                  <div className="bulk-delete-field">
                    <label htmlFor="bulk-delete-career">Especialidad</label>
                    <select
                      id="bulk-delete-career"
                      value={bulkDeleteCriteria.career}
                      onChange={(event) => setBulkDeleteCriteria((criteria) => ({ ...criteria, career: event.target.value }))}
                      required
                    >
                      <option value="" disabled>Selecciona especialidad</option>
                      {CAREER_OPTIONS.map((career) => <option key={career} value={career}>{career}</option>)}
                    </select>
                  </div>
                  <div className="bulk-delete-field">
                    <label htmlFor="bulk-delete-shift">Turno</label>
                    <select
                      id="bulk-delete-shift"
                      value={bulkDeleteCriteria.shift}
                      onChange={(event) => setBulkDeleteCriteria((criteria) => ({ ...criteria, shift: event.target.value }))}
                      required
                    >
                      <option value="" disabled>Selecciona turno</option>
                      {SHIFT_OPTIONS.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
                    </select>
                  </div>
                  <button className="bulk-delete-button" type="submit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2m3 0-.8 14H5.8L5 6m5 4v6m4-6v6"/>
                    </svg>
                    Borrar grupo
                  </button>
                </form>
                <section className="staff-section student-table-panel">
                  <div className="table-wrap">
                    <table className="student-table">
                    <thead>
                      <tr>
                        <th>Alumno</th>
                        <th>Matrícula</th>
                        <th>Carrera</th>
                        <th>Semestre</th>
                        <th>Grupo</th>
                        <th>Turno</th>
                        <th>Solicitudes</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td className="student-empty-result" colSpan="8">No se encontraron alumnos con esos criterios.</td>
                        </tr>
                      ) : filteredStudents.map((student) => {
                        const count = getRequestCount(student.account);
                        const risk = count >= 3 ? 'red' : count === 2 ? 'yellow' : count === 1 ? 'green' : 'none';
                        return (
                          <tr key={student._id} className={`risk-${risk}`}>
                            <td className="student-name-cell student-single-line" title={formatLastNamesFirst(student.fullName)}>
                              {formatLastNamesFirst(student.fullName)}
                            </td>
                            <td>{student.studentId}</td>
                            <td>{student.career}</td>
                            <td>{student.semester}°</td>
                            <td>{student.group}</td>
                            <td>{student.shift || 'Matutino'}</td>
                            <td><span className="count-pill">{count}</span></td>
                            <td className="student-actions">
                              <button
                                className="staff-action student-icon-action"
                                type="button"
                                onClick={() => setEditingStudent({ ...student })}
                                aria-label={`Editar a ${student.fullName}`}
                                title="Editar"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="m16 4 4 4M4 20l4-.8L19.2 8a2.1 2.1 0 0 0-3-3L5 16.2 4 20Z"/>
                                </svg>
                              </button>
                              <button
                                className="staff-action danger student-icon-action"
                                type="button"
                                onClick={() => setDeletingStudent(student)}
                                aria-label={`Eliminar a ${student.fullName}`}
                                title="Eliminar"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M3 6h18M8 6V4h8v2m3 0-.8 14H5.8L5 6m5 4v6m4-6v6"/>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    </table>
                  </div>
                </section>
                </>
              )}
            </div>
          )}

          {activeTab === 'perfil' && (
            <form className="staff-section student-profile-card" onSubmit={handleProfileSubmit}>
              <section className="form-section">
                <h2 className="section-title"><span className="section-number">01</span> Información de la cuenta</h2>
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="staff-profile-full-name">Nombre completo</label>
                    <input
                      id="staff-profile-full-name"
                      name="fullName"
                      type="text"
                      pattern="[\p{L} ]+"
                      maxLength="150"
                      required
                      value={profileForm.fullName}
                      onChange={handleProfileChange}
                    />
                  </div>
                  <div className="field wide">
                    <label htmlFor="staff-profile-account">Correo institucional o cuenta autorizada</label>
                    <input
                      id="staff-profile-account"
                      name="account"
                      type="text"
                      maxLength="254"
                      required
                      value={profileForm.account}
                      onChange={handleProfileChange}
                    />
                  </div>
                </div>
              </section>
              <section className="form-section">
                <h2 className="section-title"><span className="section-number">02</span> Cambiar contraseña</h2>
                <div className="field-grid">
                  <div className="field wide">
                    <label htmlFor="staff-profile-current-password">Contraseña actual <span className="required">*</span></label>
                    <input
                      id="staff-profile-current-password"
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={profileForm.currentPassword}
                      onChange={handleProfileChange}
                    />
                    <small className="field-hint">Confirma tu identidad para guardar cualquier cambio.</small>
                  </div>
                  <div className="field">
                    <label htmlFor="staff-profile-new-password">Nueva contraseña</label>
                    <input
                      id="staff-profile-new-password"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength="8"
                      value={profileForm.newPassword}
                      onChange={handleProfileChange}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="staff-profile-confirm-password">Confirmar nueva contraseña</label>
                    <input
                      id="staff-profile-confirm-password"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength="8"
                      value={profileForm.confirmPassword}
                      onChange={handleProfileChange}
                    />
                  </div>
                </div>
              </section>
              <div className="student-dialog-actions">
                <button className="staff-action" type="button" onClick={() => setActiveTab(initialTab)}>Cancelar</button>
                <button className="staff-action primary" type="submit" disabled={profileSaving}>
                  {profileSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>

      {selectedEvidence && (
        <div className="evidence-dialog" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100 }}>
          <div className="evidence-dialog-content">
            <div className="evidence-dialog-heading">
              <h2>Comprobante adjunto</h2>
              <button className="dialog-close" type="button" onClick={() => setSelectedEvidence(null)}>×</button>
            </div>
            {selectedEvidence.endsWith('.pdf') ? (
              <iframe src={selectedEvidence} className="evidence-preview-document" title="PDF"></iframe>
            ) : (
              <img src={selectedEvidence} className="evidence-preview-image" alt="Comprobante" />
            )}
          </div>
        </div>
      )}

      {editingStudent && (
        <div className="student-dialog" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100 }}>
          <form className="student-edit-form" onSubmit={handleSaveStudent}>
            <div className="student-dialog-heading">
              <h2>Editar Alumno</h2>
              <button className="dialog-close" type="button" onClick={() => setEditingStudent(null)}>×</button>
            </div>
            <div className="student-edit-grid">
              <div className="field">
                <label>Nombre Completo</label>
                <input
                  type="text"
                  pattern="[\p{L} ]+"
                  title="Escribe únicamente letras y espacios."
                  value={editingStudent.fullName || ''}
                  onChange={(e) => setEditingStudent({
                    ...editingStudent,
                    fullName: e.target.value
                  })}
                  required
                />
              </div>
              <div className="field">
                <label>Número de control</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{1,14}"
                  maxLength="14"
                  title="Escribe únicamente números, máximo 14 dígitos."
                  value={editingStudent.studentId || ''}
                  onChange={(e) => setEditingStudent({
                    ...editingStudent,
                    studentId: e.target.value.replace(/\D/g, '').slice(0, 14)
                  })}
                  required
                />
              </div>
              <div className="field">
                <label>Carrera</label>
                <select value={editingStudent.career || ''} onChange={(e) => setEditingStudent({ ...editingStudent, career: e.target.value })} required>
                  <option value="" disabled>Selecciona especialidad</option>
                  {CAREER_OPTIONS.map((career) => <option key={career} value={career}>{career}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Semestre</label>
                <select value={editingStudent.semester || ''} onChange={(e) => setEditingStudent({ ...editingStudent, semester: Number(e.target.value) })} required>
                  <option value="" disabled>Selecciona semestre</option>
                  <option value="1">1</option><option value="2">2</option><option value="3">3</option>
                  <option value="4">4</option><option value="5">5</option><option value="6">6</option>
                </select>
              </div>
              <div className="field">
                <label>Grupo</label>
                <select value={editingStudent.group || ''} onChange={(e) => setEditingStudent({ ...editingStudent, group: e.target.value })} required>
                  <option value="" disabled>Selecciona grupo</option>
                  {GROUP_OPTIONS.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Turno</label>
                <select value={editingStudent.shift || 'Matutino'} onChange={(e) => setEditingStudent({ ...editingStudent, shift: e.target.value })} required>
                  {SHIFT_OPTIONS.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
                </select>
              </div>
            </div>
            <div className="student-dialog-actions">
              <button className="staff-action" type="button" onClick={() => setEditingStudent(null)}>Cancelar</button>
              <button className="staff-action primary" type="submit">Guardar cambios</button>
            </div>
          </form>
        </div>
      )}

      {deletingStudent && (
        <div className="delete-confirm-dialog" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100 }}>
          <div className="delete-confirm-content">
            <h2>Eliminar Alumno</h2>
            <p>¿Seguro que deseas eliminar a <strong>{deletingStudent.fullName}</strong>?</p>
            <div className="student-dialog-actions">
              <button className="staff-action" type="button" onClick={() => setDeletingStudent(null)}>Cancelar</button>
              <button className="staff-action danger" type="button" onClick={handleDeleteStudent}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirmation && (
        <div className="bulk-delete-overlay" role="presentation">
          <div className="bulk-delete-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="bulk-delete-title">
            <div className="bulk-delete-confirmation-heading">
              <span className="bulk-delete-warning-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"/>
                  <path d="M12 9v4m0 3h.01"/>
                </svg>
              </span>
              <div>
                <p className="bulk-delete-eyebrow">Acción permanente</p>
                <h2 id="bulk-delete-title">Confirmar borrado del grupo</h2>
              </div>
            </div>
            {bulkDeleteConfirmation.matchingCount === 0 ? (
              <p className="delete-confirm-copy">No hay alumnos que coincidan con esos criterios.</p>
            ) : (
              <>
                <div className="bulk-delete-summary">
                  <span className="bulk-delete-count">{bulkDeleteConfirmation.matchingCount}</span>
                  <p className="delete-confirm-copy">
                    {bulkDeleteConfirmation.matchingCount === 1
                      ? 'alumno se eliminará permanentemente'
                      : 'alumnos se eliminarán permanentemente'}
                  </p>
                </div>
                <div className="bulk-delete-criteria">
                  <span><strong>Semestre y grupo</strong>{bulkDeleteConfirmation.semester}° {bulkDeleteConfirmation.group}</span>
                  <span><strong>Turno</strong>{bulkDeleteConfirmation.shift}</span>
                  <span className="bulk-delete-criteria-career"><strong>Especialidad</strong>{bulkDeleteConfirmation.career}</span>
                </div>
                <div className="bulk-delete-warning">
                  <strong>También se eliminarán sus solicitudes y justificantes emitidos.</strong>
                  <span>Esta acción es permanente y no se puede deshacer.</span>
                </div>
              </>
            )}
            <div className="student-dialog-actions">
              <button className="staff-action" type="button" onClick={() => setBulkDeleteConfirmation(null)} disabled={isBulkDeleting}>
                Cancelar
              </button>
              {bulkDeleteConfirmation.matchingCount > 0 && (
                <button className="staff-action danger bulk-delete-confirm" type="button" onClick={handleBulkDelete} disabled={isBulkDeleting}>
                  {isBulkDeleting ? 'Eliminando...' : 'Sí, borrar grupo'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {toast.text && <div className={`toast ${toast.isError ? 'toast-error' : ''}`}>{toast.text}</div>}
    </div>
  );
}