import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { formatDate } from '../utils/date';
import { getInitials } from '../utils/initials';
import LoadingState from '../components/LoadingState';

export default function GenerarJustificante() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('id');
  const navigate = useNavigate();

  const [loadedRequest, setLoadedRequest] = useState(null);
  const request = loadedRequest?.id === requestId ? loadedRequest.data : null;
  const [sessionUser, setSessionUser] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [issueDate] = useState(() => new Date().toLocaleDateString('es-MX'));
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    description: ''
  });

  useEffect(() => {
    let active = true;

    if (!requestId) {
      navigate('/encargado');
      return () => {
        active = false;
      };
    }

    Promise.all([
      api.get(`/justifications/${requestId}`),
      api.get('/me')
    ])
      .then(async ([{ data: requestData }, { data: session }]) => {
        if (!active) return;
        let data = requestData;
        if (!data.folio) {
          const issued = await api.put(`/justifications/${requestId}/status`, { status: 'issued' });
          data = issued.data;
        }
        if (!data.folio) {
          throw new Error('El servidor no devolvió el folio del justificante.');
        }
        if (!active) return;
        setLoadedRequest({ id: requestId, data });
        setSessionUser(session.user);
        setFormData({
          startDate: data.startDate,
          endDate: data.endDate,
          reason: data.reason || '',
          description: data.description || ''
        });
      })
      .catch((error) => {
        if (!active) return;
        alert(error.response?.data?.error || error.message || 'Error al cargar la solicitud.');
        navigate('/encargado');
      });

    return () => {
      active = false;
    };
  }, [requestId, navigate]);

  const handlePrint = async () => {
    try {
      if (!request?.folio) {
        throw new Error('El justificante aún no tiene un folio asignado.');
      }
      window.print();
    } catch (error) {
      alert(error.response?.data?.error || error.message || 'No se pudo preparar el justificante para imprimir.');
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
      navigate('/login');
    } catch {
      alert('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    }
  };

  return (
    <div className="print-page">
      <header className="topbar staff-topbar staff-dashboard-topbar print-toolbar">
        <Link className="wordmark" to="/encargado" aria-label="JutificaT, volver al panel">
          Jutifica<span>T</span>
        </Link>
        <span className="staff-label"></span>
        <div className="staff-header-actions">
          <div className="print-account-menu">
            <button
              className="print-logout-trigger"
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-label="Menú de cuenta"
              aria-expanded={accountMenuOpen}
              aria-controls="print-account-popup"
              title="Menú de cuenta"
            >
              <img className="account-mark" src="/dgti.png" alt="DGETI" />
            </button>
            {accountMenuOpen && (
              <div className="print-account-popup" id="print-account-popup">
                <button className="logout-button" type="button" onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-shell staff-dashboard-shell staff-scroll-shell print-app-shell">
        <nav className="sidebar staff-dashboard-sidebar print-sidebar" aria-label="Navegación del panel">
          <Link className="nav-link active" to="/encargado" title="Solicitudes" aria-label="Ver solicitudes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6M8 13h8M8 17h6"/>
            </svg>
          </Link>
          <Link className="nav-link" to="/encargado?tab=alumnos" title="Alumnos" aria-label="Ver tabla de alumnos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="10" cy="7" r="4"/>
              <path d="M20 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M17 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </Link>
          <Link
            className="nav-link student-profile-link"
            to="/encargado?tab=perfil"
            title="Perfil"
            aria-label="Ver perfil"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4"/>
              <path d="M5 21a7 7 0 0 1 14 0"/>
            </svg>
          </Link>
        </nav>

        <main className="staff-main print-main">
          <div className="page-heading print-page-heading">
            <div>
              <p className="eyebrow">CBTis 258 · Control Escolar</p>
              <h1>Preparar justificante</h1>
            </div>
            <div className="student-chip">
              <span className="avatar">
                {getInitials(sessionUser?.account || sessionUser?.fullName, 'CE')}
              </span>
              <span className="student-name">{sessionUser?.fullName || sessionUser?.account || 'Control Escolar'}</span>
            </div>
          </div>

          <div className="page-layout print-content">
            {!request ? (
              <>
                <section className="editor print-loading-editor">
                  <Link className="back-link print-back-link" to="/encargado">← Volver a solicitudes</Link>
                  <LoadingState label="Cargando datos para impresión..." />
                </section>
                <article className="certificate certificate-loading" aria-hidden="true">
                  <div className="certificate-loading-lines">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </article>
              </>
            ) : (
              <>
            <section className="editor print-editor">
              <Link className="back-link print-back-link" to="/encargado">← Volver a solicitudes</Link>
              <div className="print-editor-heading">
                <div>
                  <p className="eyebrow">Preparación del documento</p>
                  <h2>Editar justificante</h2>
                </div>
                <span className="section-number">01</span>
              </div>
              <p className="editor-copy">Revisa la información del alumno y ajusta los detalles antes de imprimir.</p>

              <section className="print-student-summary" aria-label="Datos del alumno">
                <p className="print-summary-label">Datos del alumno</p>
                <h3>{request.studentName}</h3>
                <div className="print-student-meta">
                  <span><strong>Matrícula</strong>{request.studentId}</span>
                  <span><strong>Especialidad</strong>{request.career}</span>
                  <span><strong>Semestre y grupo</strong>{request.semester}° · {request.group}</span>
                  <span><strong>Turno</strong>{request.shift || 'Matutino'}</span>
                </div>
              </section>

              <div className="print-editor-section-heading">
                <span className="section-number">02</span>
                <h3>Detalles de la inasistencia</h3>
              </div>

              <form className="absence-editor">
                <div className="field">
                  <label>Fecha de inasistencia</label>
                  <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div className="field">
                  <label>Fecha final</label>
                  <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
                <div className="field">
                  <label>Motivo de la falta</label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    aria-label="Motivo de la falta"
                  />
                </div>
                <div className="field">
                  <label>Descripción</label>
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    aria-label="Descripción de la falta"
                  />
                </div>
              </form>
            </section>

            <article className="certificate">
              <header className="certificate-header">
                <div className="education-mark">
                  <strong>EDUCACIÓN</strong>
                  <span>SECRETARÍA DE EDUCACIÓN PÚBLICA</span>
                </div>
                <img className="dgti-mark" src="/dgti.png" alt="DGETI" />
                <div className="school-heading">
                  <strong>Subsecretaría de Educación Media Superior</strong>
                  <span>Dirección General de Educación Tecnológica Industrial y de Servicios</span>
                  <span>Centro de Bachillerato Tecnológico industrial y de servicios No. 258</span>
                </div>
              </header>

              <div className="certificate-title-row">
                <h2 className="certificate-title">JUSTIFICANTE DE INASISTENCIA</h2>
                {request.folio && (
                  <p className="certificate-folio"><strong>FOLIO:</strong> <span>{request.folio}</span></p>
                )}
              </div>
              <p className="teacher-instruction">C. Docentes favor de tomar en cuenta el presente justificante del alumno:</p>

              <section className="student-data">
                <p><strong>NOMBRE DEL ALUMNO:</strong> <span>{request.studentName}</span></p>
                <p><strong>MATRÍCULA:</strong> <span>{request.studentId}</span></p>
                <p><strong>CARRERA:</strong> <span>{request.career}</span></p>
                <p><strong>SEMESTRE:</strong> <span>{request.semester}°</span></p>
                <p><strong>GRUPO:</strong> <span>{request.group}</span></p>
                <p><strong>TURNO:</strong> <span>{request.shift || 'Matutino'}</span></p>
              </section>

              <section className="issue-dates">
                <p><strong>FECHA DE ELABORACIÓN:</strong> <span>{issueDate}</span></p>
              </section>
              <p className="absence-period"><strong>FECHA(S) DE INASISTENCIA:</strong> <span>{formatDate(formData.startDate)} al {formatDate(formData.endDate)}</span></p>

              <p className="reason-line"><strong>MOTIVO:</strong> <span>{formData.reason}</span></p>
              {formData.description.trim() && (
                <p className="reason-line"><strong>DESCRIPCIÓN:</strong> <span>{formData.description}</span></p>
              )}

              <table className="attendance-table">
                <thead>
                  <tr><th>HORA</th><th>MATERIA</th><th>FIRMA DEL MAESTRO</th></tr>
                </thead>
                <tbody>
                  <tr><td></td><td></td><td></td></tr>
                  <tr><td></td><td></td><td></td></tr>
                  <tr><td></td><td></td><td></td></tr>
                  <tr><td></td><td></td><td></td></tr>
                </tbody>
              </table>

              <footer className="certificate-footer">
                <span>Atentamente</span>
                <strong>DULCE HERNÁNDEZ GARCÍA</strong>
                <span>Encargado de Orientación Educativa</span>
              </footer>
            </article>
            <div className="certificate-actions">
              <button className="print-button" type="button" onClick={handlePrint}>
                Imprimir justificante
              </button>
            </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}