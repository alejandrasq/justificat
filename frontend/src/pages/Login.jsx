import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false });
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', isError: false });
    setLoading(true);

    try {
      const response = await api.post('/login', {
        account: account.trim().toLowerCase(),
        password,
      });

      const user = response.data.user;
      if (user.role === 'staff') {
        navigate('/encargado');
      } else {
        navigate('/justificar');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'No se pudo conectar con el servidor.';
      setMessage({ text: `No se pudo iniciar sesión: ${errorMsg}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header className="topbar">
        <Link className="wordmark" to="/login" aria-label="JutificaT, inicio">Jutifica<span>T</span></Link>
        <span className="topbar-caption">Justificantes escolares</span>
        <img className="account-mark" src="/dgti.png" alt="DGETI" />
      </header>

      <main className="login-layout">
        <section className="poster-panel" aria-label="Identidad del CBTis 258">
          <img className="school-poster" src="/cobra.png" alt="Mascota y espacios del CBTis 258" />
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-content">
            <h1 id="login-title">Iniciar <span>Sesión</span></h1>
            <p className="login-intro">Ingresa con tu cuenta escolar para solicitar y consultar tus justificantes.</p>

            <form className="login-card" id="login-form" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="account">Correo institucional o cuenta</label>
                <input
                  id="account"
                  name="cuenta"
                  type="text"
                  autoComplete="username"
                  required
                  autoFocus
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="password">Contraseña</label>
                <div className="password-wrap">
                  <input
                    id="password"
                    name="contrasena"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    aria-label="Mostrar contraseña"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>

              <button className="submit-button" id="submit-button" type="submit" disabled={loading}>
                <span>{loading ? 'Entrando...' : 'Entrar'}</span>
                <span className="button-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </span>
              </button>

              <p className="mode-switch">
                ¿No tienes cuenta? <Link className="text-button" to="/registro">Regístrate aquí</Link>
              </p>
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