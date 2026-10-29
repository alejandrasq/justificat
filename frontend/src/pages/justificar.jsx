import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { formatDate } from '../utils/date';
import { getInitials } from '../utils/initials';
import LoadingState from '../components/LoadingState';

export default function Justificar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [activeSection, setActiveSection] = useState('solicitud');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    account: '',
    fullName: '',
    studentId: '',
    career: '',
    semester: '',
    group: '',
    shift: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const previewUrls = useRef([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ text: '', isError: false });

  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    description: ''
  });

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const showToast = useCallback((text, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast({ text: '', isError: false }), 6000);
  }, []);

  const fetchUserRequests = useCallback(async (account) => {
    try {
      const response = await api.get(`/justifications/user/${encodeURIComponent(account)}`);
      setRequests(response.data || []);
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        showToast('Error al cargar las solicitudes previas.', true);
      }
    }
  }, [navigate, showToast]);

  useEffect(() => {
    let active = true;
    api.get('/me')
      .then(({ data }) => {
        if (!active) return;
        if (data.user.role === 'staff') {
          navigate('/encargado');
          return;
        }
        setUser(data.user);
        fetchUserRequests(data.user.account);
      })
      .catch(() => {
        if (active) navigate('/login');
      });

    return () => {
      active = false;
    };
  }, [fetchUserRequests, navigate]);

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
      account: user.account || '',
      fullName: user.fullName || '',
      studentId: user.studentId || '',
      career: user.career || '',
      semester: String(user.semester || ''),
      group: user.group || '',
      shift: user.shift || 'Matutino',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setMenuOpen(false);
    setActiveSection('perfil');
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
      const { data } = await api.put('/profile', {
        account: profileForm.account,
        fullName: profileForm.fullName,
        studentId: profileForm.studentId,
        career: profileForm.career,
        semester: profileForm.semester,
        group: profileForm.group,
        shift: profileForm.shift,
        currentPassword: profileForm.currentPassword,
        ...(profileForm.newPassword ? { newPassword: profileForm.newPassword } : {})
      });
      setUser(data.user);
      setProfileForm((current) => ({ ...current, currentPassword: '', newPassword: '', confirmPassword: '' }));
      showToast('Tu perfil se actualizó correctamente.');
      fetchUserRequests(data.user.account);
    } catch (error) {
      showToast(error.response?.data?.error || 'No se pudo actualizar tu perfil.', true);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileSelect = (e) => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    const selectedFiles = Array.from(e.target.files).slice(0, 1);
    const previews = selectedFiles.map((file) => ({
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));

    previewUrls.current = previews.flatMap((preview) => preview.url ? [preview.url] : []);
    setFiles(selectedFiles);
    setFilePreviews(previews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      showToast('Adjunta una receta, recado u otro comprobante.', true);
      return;
    }

    if (formData.endDate < formData.startDate) {
      showToast('La fecha final debe ser igual o posterior a la fecha inicial.', true);
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();
      data.append('startDate', formData.startDate);
      data.append('endDate', formData.endDate);
      data.append('reason', formData.reason);
      data.append('description', formData.description);

      data.append('document', files[0]);

      await api.post('/justifications', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showToast('Solicitud enviada al encargado correctamente.');
      setFormData({
        startDate: '',
        endDate: '',
        reason: '',
        description: ''
      });
      setFiles([]);
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current = [];
      setFilePreviews([]);
      fetchUserRequests(user.account);
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'No se pudo enviar la solicitud.';
      showToast(errorMsg, true);
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (status) => ({
    pending: 'Pendiente',
    review: 'En revisión',
    issued: 'Justificante emitido',
    rejected: 'No aprobada'
  }[status] || 'Pendiente');

  if (!user) {
    return (
      <main className="route-loading">
        <LoadingState label="Cargando portal del estudiante..." />
      </main>
    );
  }

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
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Menú de cuenta"
              aria-expanded={menuOpen}
              aria-controls="student-account-popup"
              title="Menú de cuenta"
            >
              <img className="account-mark" src="/dgti.png" alt="DGETI" />
            </button>
          {menuOpen && (
            <div className="staff-account-popup" id="student-account-popup">
              <button className="logout-button" type="button" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          )}
          </div>
        </div>
      </header>

      <div className="app-shell staff-dashboard-shell student-dashboard-shell">
        <nav className="sidebar staff-dashboard-sidebar" aria-label="Navegación del estudiante">
          <button
            className={`nav-link ${activeSection === 'solicitud' ? 'active' : ''}`}
            type="button"
            aria-label="Solicitar justificante"
            aria-current={activeSection === 'solicitud' ? 'page' : undefined}
            onClick={() => setActiveSection('solicitud')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>
            </svg>
          </button>
          <button
            className={`nav-link ${activeSection === 'historial' ? 'active' : ''}`}
            type="button"
            aria-label="Historial de justificantes"
            aria-current={activeSection === 'historial' ? 'page' : undefined}
            onClick={() => setActiveSection('historial')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/>
              <path d="M3 3v5h5M12 7v5l3 2"/>
            </svg>
          </button>
          <button
            className={`nav-link student-profile-link ${activeSection === 'perfil' ? 'active' : ''}`}
            type="button"
            aria-label="Ver perfil"
            aria-current={activeSection === 'perfil' ? 'page' : undefined}
            title="Ver perfil"
            onClick={openProfile}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4"/>
              <path d="M5 21a7 7 0 0 1 14 0"/>
            </svg>
          </button>
        </nav>

        <main id="inicio" className="staff-main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CBTis 258 · Control escolar</p>
              <h1>
                {activeSection === 'historial'
                  ? 'Historial de justificantes'
                  : activeSection === 'perfil' ? 'Mi perfil' : 'Solicitar justificante'}
              </h1>
              <p className="heading-note">
                {activeSection === 'historial'
                  ? 'Consulta el estado y los detalles de tus solicitudes anteriores.'
                  : activeSection === 'perfil'
                    ? 'Consulta y actualiza tu información personal y escolar.'
                    : 'Envía tus datos y el comprobante para que el encargado revise tu falta.'}
              </p>
            </div>
            <div className="student-chip">
              <span className="avatar">
                {getInitials(user.fullName, 'ES')}
              </span>
              <span className="student-identity">
                <span className="student-name">{user.fullName || user.account}</span>
                <span className="student-shift">Turno {user.shift || 'Matutino'}</span>
              </span>
            </div>
          </div>

          {activeSection === 'perfil' ? (
            <form className="form-card student-profile-card" onSubmit={handleProfileSubmit}>
              <section className="form-section">
                <h2 className="section-title"><span className="section-number">01</span> Información personal y escolar</h2>
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="profile-full-name">Nombre completo</label>
                    <input id="profile-full-name" name="fullName" type="text" pattern="[\p{L} ]+" maxLength="150" required value={profileForm.fullName} onChange={handleProfileChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="profile-student-id">Número de control</label>
                    <input id="profile-student-id" name="studentId" type="text" inputMode="numeric" pattern="[0-9]{1,14}" maxLength="14" required value={profileForm.studentId} onChange={(event) => setProfileForm((current) => ({ ...current, studentId: event.target.value.replace(/\D/g, '').slice(0, 14) }))} />
                  </div>
                  <div className="field">
                    <label htmlFor="profile-career">Especialidad</label>
                    <select id="profile-career" name="career" required value={profileForm.career} onChange={handleProfileChange}>
                      <option value="" disabled>Selecciona especialidad</option>
                      <option value="Programación">Programación</option>
                      <option value="Mecánica Industrial">Mecánica Industrial</option>
                      <option value="Prep. Alimentos y Bebidas">Prep. Alimentos y Bebidas</option>
                      <option value="Contabilidad">Contabilidad</option>
                      <option value="Logística">Logística</option>
                      <option value="Servicios de Hospedaje">Servicios de Hospedaje</option>
                      <option value="Ciberseguridad">Ciberseguridad</option>
                      <option value="Inteligencia Artificial">Inteligencia Artificial</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="profile-semester">Semestre</label>
                    <select id="profile-semester" name="semester" required value={profileForm.semester} onChange={handleProfileChange}>
                      <option value="" disabled>Selecciona semestre</option>
                      {[1, 2, 3, 4, 5, 6].map((semester) => <option key={semester} value={semester}>{semester}°</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="profile-group">Grupo</label>
                    <select id="profile-group" name="group" required value={profileForm.group} onChange={handleProfileChange}>
                      <option value="" disabled>Selecciona grupo</option>
                      {['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'J'].map((group) => <option key={group} value={group}>{group}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="profile-shift">Turno</label>
                    <select id="profile-shift" name="shift" required value={profileForm.shift} onChange={handleProfileChange}>
                      <option value="" disabled>Selecciona turno</option>
                      <option value="Matutino">Matutino</option>
                      <option value="Vespertino">Vespertino</option>
                    </select>
                  </div>
                  <div className="field wide">
                    <label htmlFor="profile-account">Correo institucional</label>
                    <input id="profile-account" name="account" type="email" pattern="[^@\s]+@cbtis258\.edu\.mx" maxLength="254" required value={profileForm.account} onChange={handleProfileChange} />
                    <small className="field-hint">Debe utilizar el dominio @cbtis258.edu.mx.</small>
                  </div>
                </div>
              </section>

              <section className="form-section">
                <h2 className="section-title"><span className="section-number">02</span> Cambiar contraseña</h2>
                <div className="field-grid">
                  <div className="field wide">
                    <label htmlFor="profile-current-password">Contraseña actual <span className="required">*</span></label>
                    <input id="profile-current-password" name="currentPassword" type="password" autoComplete="current-password" required value={profileForm.currentPassword} onChange={handleProfileChange} />
                    <small className="field-hint">Confirma tu identidad para guardar cualquier cambio.</small>
                  </div>
                  <div className="field">
                    <label htmlFor="profile-new-password">Nueva contraseña</label>
                    <input id="profile-new-password" name="newPassword" type="password" autoComplete="new-password" minLength="8" value={profileForm.newPassword} onChange={handleProfileChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="profile-confirm-password">Confirmar nueva contraseña</label>
                    <input id="profile-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength="8" value={profileForm.confirmPassword} onChange={handleProfileChange} />
                  </div>
                </div>
              </section>
              <div className="student-dialog-actions">
                <button className="staff-action" type="button" onClick={() => setActiveSection('solicitud')}>Cancelar</button>
                <button className="staff-action primary" type="submit" disabled={profileSaving}>
                  {profileSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          ) : activeSection === 'solicitud' ? (
          <div className="workspace">
            <form className="form-card request-form" onSubmit={handleSubmit}>
              <section className="form-section" id="solicitud">
                <h2 className="section-title"><span className="section-number">01</span> Datos del estudiante</h2>
                <div className="field-grid student-readonly-grid">
                  <div className="field">
                    <label id="student-full-name-label">Nombre completo</label>
                    <div className="readonly-value" role="textbox" aria-readonly="true" aria-labelledby="student-full-name-label">{user.fullName || ''}</div>
                  </div>
                  <div className="field">
                    <label id="student-id-label">Matrícula</label>
                    <div className="readonly-value" role="textbox" aria-readonly="true" aria-labelledby="student-id-label">{user.studentId || ''}</div>
                  </div>
                  <div className="field">
                    <label id="student-career-label">Carrera</label>
                    <div className="readonly-value" role="textbox" aria-readonly="true" aria-labelledby="student-career-label">{user.career || ''}</div>
                  </div>
                  <div className="field">
                    <label id="student-semester-label">Semestre</label>
                    <div className="readonly-value" role="textbox" aria-readonly="true" aria-labelledby="student-semester-label">{user.semester ? `${user.semester}°` : ''}</div>
                  </div>
                  <div className="field">
                    <label id="student-group-label">Grupo</label>
                    <div className="readonly-value" role="textbox" aria-readonly="true" aria-labelledby="student-group-label">{user.group || ''}</div>
                  </div>
                  <div className="field">
                    <label id="student-shift-label">Turno</label>
                    <div className="readonly-value" role="textbox" aria-readonly="true" aria-labelledby="student-shift-label">{user.shift || 'Matutino'}</div>
                  </div>
                </div>
              </section>

              <section className="form-section">
                <h2 className="section-title"><span className="section-number">02</span> Detalles de la falta</h2>
                <div className="field-grid">
                  <div className="field">
                    <label>Fecha de la falta <span className="required">*</span></label>
                    <input type="date" name="startDate" required value={formData.startDate} onChange={handleInputChange} />
                  </div>
                  <div className="field">
                    <label>Fecha final <span className="required">*</span></label>
                    <input type="date" name="endDate" min={formData.startDate} required value={formData.endDate} onChange={handleInputChange} />
                  </div>
                  <div className="field">
                    <label>Motivo <span className="required">*</span></label>
                    <select name="reason" required value={formData.reason} onChange={handleInputChange}>
                      <option value="" disabled>Selecciona un motivo</option>
                      <option value="Médico">Médico</option>
                      <option value="Familiar">Familiar</option>
                      <option value="Personal">Personal</option>
                      <option value="Legal">Legal</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="field wide">
                    <label>Descripción <span className="required">*</span></label>
                    <textarea name="description" required placeholder="Describe brevemente el motivo de la solicitud." value={formData.description} onChange={handleInputChange}></textarea>
                  </div>
                </div>
              </section>

              <section className="form-section">
                <h2 className="section-title"><span className="section-number">03</span> Comprobante de la falta</h2>
                <label className="upload-area" htmlFor="supporting-documents">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2"/></svg>
                  <strong>Adjunta una foto de tu receta, recado u otro comprobante</strong>
                  <small>JPG, PNG o PDF · un archivo de hasta 10 MB</small>
                </label>
                <input id="supporting-documents" type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileSelect} />
                
                {files.length > 0 && (
                  <ul className="file-list">
                    {files.map((file, i) => (
                      <li className="file-preview" key={`${file.name}-${file.lastModified}-${i}`}>
                        {filePreviews[i]?.url ? (
                          <img className="file-preview-image" src={filePreviews[i].url} alt={`Vista previa: ${file.name}`} />
                        ) : (
                          <span className="file-preview-document" aria-hidden="true">PDF</span>
                        )}
                        <span className="file-preview-details">
                          <strong>{file.name}</strong>
                          <small>{(file.size / 1024 / 1024).toFixed(2)} MB · {filePreviews[i]?.url ? 'Imagen adjunta' : 'Documento adjunto'}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="form-footer">
                <p className="privacy-note">Tu solicitud quedará pendiente hasta que el encargado la revise.</p>
                <button className="submit-button" type="submit" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </form>

            <aside className="recent-card">
              <div className="recent-header">
                <h2>Estado de mis solicitudes</h2>
                <p>Consulta el avance. El encargado es quien emite el justificante.</p>
              </div>
              
              {requests.length === 0 ? (
                <p className="request-empty">Aún no hay solicitudes. Al enviar una aparecerá aquí.</p>
              ) : (
                <ul className="request-list">
                  {requests.map((req) => (
                    <li className="request-item" key={req._id}>
                      <span className="request-info">
                        <span className="request-id">
                          Solicitud de justificante
                        </span>
                        <span className="request-date">{formatDate(req.startDate)} — {formatDate(req.endDate)} · {req.reason}</span>
                      </span>
                      <span className={`status ${req.status}`}>
                        {statusLabel(req.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
          ) : (
            <section className="form-card student-history" aria-label="Historial de solicitudes">
              <h2 className="section-title">Mis solicitudes</h2>
              {requests.length === 0 ? (
                <p className="request-empty">Aún no tienes solicitudes de justificante.</p>
              ) : (
                <div className="student-history-list">
                  {requests.map((request) => (
                    <article className="student-history-item" key={request._id}>
                      <div className="request-card-head">
                        <div>
                          <h3>Solicitud de justificante</h3>
                          <p>{formatDate(request.startDate)} al {formatDate(request.endDate)} · Turno {request.shift || user.shift || 'Matutino'}</p>
                        </div>
                        <span className={`status ${request.status}`}>{statusLabel(request.status)}</span>
                      </div>
                      <p className="student-history-reason"><strong>Motivo:</strong> {request.reason}</p>
                      {request.description && <p className="student-history-description">{request.description}</p>}
                      <p className="student-history-date">
                        Enviada el {request.createdAt ? new Date(request.createdAt).toLocaleDateString('es-MX') : 'Fecha no disponible'}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {toast.text && (
        <div className={`toast ${toast.isError ? 'toast-error' : ''}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}