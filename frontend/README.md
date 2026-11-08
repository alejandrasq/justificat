# Frontend

## Desarrollo local

1. Inicia MongoDB.
2. Desde `backend`, ejecuta `npm start`.
3. Desde `frontend`, ejecuta `npm run dev` y abre la URL que muestra Vite.

Vite reenvía `/api` al backend en `http://localhost:5000`. Si el backend usa
otra dirección, configura `BACKEND_URL` antes de iniciar Vite. La sesión se
conserva de forma independiente en cada pestaña del navegador.

Para desplegar el frontend sin el proxy de desarrollo, configura
`VITE_API_BASE_URL` con la URL base de la API, por ejemplo `https://example.com/api`.
