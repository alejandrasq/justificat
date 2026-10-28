import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Justificar from './pages/justificar';
import Encargado from './pages/Encargado';
import GenerarJustificante from './pages/GenerarJustificante';
import './global.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/justificar" element={<Justificar />} />
        <Route path="/encargado" element={<Encargado />} />
        <Route path="/generar-justificante" element={<GenerarJustificante />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;