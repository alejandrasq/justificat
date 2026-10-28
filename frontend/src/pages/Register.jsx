import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import SchoolIdentity from '../components/SchoolIdentity';

export default function Register() {
  const [formData, setFormData] = useState({
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    matricula: '',
    carrera: '',
    semestre: '',
    grupo: '',
    turno: '',
    cuenta: '',
    contrasena: '',
    confirmPassword: ''
  });

  const [message, setMessage] = useState({ text: '', isError: false });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name } = e.target;
    const value = name === 'matricula'
      ? e.target.value.replace(/\D/g, '').slice(0, 14)
      : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', isError: false });

    if (!/^[^\s@]+@cbtis258\.edu\.mx$/i.test(formData.cuenta.trim())) {
      setMessage({ text: 'El correo debe terminar en @cbtis258.edu.mx.', isError: true });
      return;
    }

    if (formData.contrasena !== formData.confirmPassword) {
      setMessage({ text: 'Las contraseñas no coinciden.', isError: true });
      return;
    }

    const fullName = [
      formData.nombre.trim(),
      formData.apellido_paterno.trim(),
      formData.apellido_materno.trim()
    ].filter(Boolean).join(' ');

    setLoading(true);

    try {
      await api.post('/register', {
        account: formData.cuenta.trim().toLowerCase(),
        password: formData.contrasena,
        fullName,
        studentId: formData.matricula.trim(),
        career: formData.carrera.trim(),
        semester: Number(formData.semestre),
        group: formData.grupo.trim().toUpperCase(),
        shift: formData.turno
      });

      setMessage({ text: 'Cuenta creada correctamente. Redirigiendo al inicio de sesión...', isError: false });
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'No se pudo crear la cuenta.';
      setMessage({ text: `Error: ${errorMsg}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registration-page">
      <header className="topbar">
        <Link className="wordmark" to="/login" aria-label="JutificaT, iniciar sesión">Jutifica<span>T</span></Link>
        <span className="topbar-caption">Portal de justificantes escolares</span>
        <img className="account-mark" src="/dgti.png" alt="DGETI" />
      </header>

      <main className="login-layout">
        <SchoolIdentity />

        <section className="login-panel" aria-labelledby="register-title">
          <div className="login-content">
            <h1 id="register-title">Crear <span>Cuenta</span></h1>
            <p className="login-intro">Registra tus datos escolares para solicitar y consultar justificantes.</p>

            <form className="login-card registration-card" id="register-form" onSubmit={handleSubmit}>
              <p className="registration-title">Datos del estudiante</p>
              
              <div className="field">
                <label htmlFor="register-name">Nombres</label>
                <input id="register-name" name="nombre" type="text" pattern="[\p{L} ]+" title="Escribe únicamente letras y espacios." maxLength="150" required value={formData.nombre} onChange={handleChange} />
              </div>

              <div className="field">
                <label htmlFor="register-last-name">Apellido Paterno</label>
                <input id="register-last-name" name="apellido_paterno" type="text" pattern="[\p{L} ]+" title="Escribe únicamente letras y espacios." maxLength="150" required value={formData.apellido_paterno} onChange={handleChange} />
              </div>

              <div className="field">
                <label htmlFor="register-mother-last-name">Apellido Materno</label>
                <input id="register-mother-last-name" name="apellido_materno" type="text" pattern="[\p{L} ]+" title="Escribe únicamente letras y espacios." maxLength="150" required value={formData.apellido_materno} onChange={handleChange} />
              </div>

              <div className="field">
                <label htmlFor="register-student-id">Número de control</label>
                <input id="register-student-id" name="matricula" type="text" inputMode="numeric" pattern="[0-9]{1,14}" maxLength="14" title="Escribe únicamente números, máximo 14 dígitos." required value={formData.matricula} onChange={handleChange} />
              </div>

              <div className="field">
                <label htmlFor="register-career">Especialidad</label>
                <select id="register-career" name="carrera" required value={formData.carrera} onChange={handleChange}>
                  <option value="" disabled>Selecciona Especialidad</option>
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

              <div className="field profile-grid">
                <div>
                  <label htmlFor="register-semester">Semestre</label>
                  <select id="register-semester" name="semestre" required value={formData.semestre} onChange={handleChange}>
                    <option value="" disabled>Selecciona Semestre</option>
                    <option value="1">1</option><option value="2">2</option><option value="3">3</option>
                    <option value="4">4</option><option value="5">5</option><option value="6">6</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="register-group">Grupo</label>
                  <select id="register-group" name="grupo" required value={formData.grupo} onChange={handleChange}>
                    <option value="" disabled>Selecciona Grupo</option>
                    <option value="A">A</option><option value="B">B</option><option value="C">C</option>
                    <option value="D">D</option><option value="E">E</option><option value="F">F</option>
                    <option value="H">H</option><option value="I">I</option><option value="J">J</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="register-shift">Turno</label>
                <select id="register-shift" name="turno" required value={formData.turno} onChange={handleChange}>
                  <option value="" disabled>Selecciona turno</option>
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="register-account">Correo institucional</label>
                <input id="register-account" name="cuenta" type="email" pattern="[^@\s]+@cbtis258\.edu\.mx" title="Usa un correo con dominio @cbtis258.edu.mx." maxLength="254" required value={formData.cuenta} onChange={handleChange} />
                <small className="field-hint">Usa tu correo @cbtis258.edu.mx para iniciar sesión.</small>
              </div>

              <div className="field">
                <label htmlFor="register-password">Contraseña</label>
                <input id="register-password" name="contrasena" type="password" minLength="8" required value={formData.contrasena} onChange={handleChange} />
              </div>

              <div className="field">
                <label htmlFor="confirm-password">Confirmar contraseña</label>
                <input id="confirm-password" name="confirmPassword" type="password" minLength="8" required value={formData.confirmPassword} onChange={handleChange} />
              </div>

              <button className="submit-button" id="register-button" type="submit" disabled={loading}>
                <span>{loading ? 'Guardando...' : 'Crear cuenta'}</span>
                <span className="button-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </span>
              </button>

              <p className="mode-switch">¿Ya tienes cuenta? <Link className="text-button" to="/login">Inicia sesión</Link></p>
            </form>

            {message.text && (
              <p className={`form-message ${message.isError ? '' : 'success'}`} role="alert">
                {message.text}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}