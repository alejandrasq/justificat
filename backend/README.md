# Backend de JutificaT

## Iniciar el servidor

1. Copia `.env.example` a `.env` si aún no tienes uno. El destino configurado es `justificat`.
2. Inicia MongoDB.
3. En esta carpeta ejecuta `npm start`.

En desarrollo, si `SESSION_SECRET` no está definido, se genera una clave temporal y las sesiones dejan de ser válidas al reiniciar. En producción configura `SESSION_SECRET` con una cadena aleatoria de al menos 32 caracteres y sirve la aplicación únicamente por HTTPS.

Puedes generar una clave con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y guardarla como `SESSION_SECRET` en `.env`.

Si Vite se ejecuta en un origen distinto de `http://localhost:5173`, actualiza `FRONTEND_ORIGIN` en `.env` para que coincida exactamente.

## Despliegue gratuito en Render y MongoDB Atlas

El repositorio incluye `render.yaml` en la raíz. En Render, crea un **Blueprint** desde este repositorio y completa estas variables cuando las solicite:

- `MONGO_URI`: cadena de conexión de MongoDB Atlas, con el nombre de la base al final.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`: credenciales del servidor de Cloudinary. No las agregues al frontend ni al repositorio.
- `SESSION_SECRET` se genera automáticamente en Render.

Render construye el frontend de Vite y el backend Express, y sirve ambos desde el mismo dominio para que las cookies de sesión funcionen correctamente. En producción, los comprobantes nuevos se guardan como archivos autenticados en Cloudinary y se recuperan mediante una ruta del backend que requiere sesión de encargado. En desarrollo local, si Cloudinary no está configurado, se mantiene el almacenamiento en `uploads/`.

En MongoDB Atlas crea un usuario de base de datos dedicado y permite las conexiones de Render en **Network Access**. Render Free no proporciona IP de salida fija; para conectarlo puede ser necesario permitir `0.0.0.0/0`. Si lo haces, usa un usuario dedicado con permisos mínimos y una contraseña larga y única (nunca un usuario administrador). Render Free puede entrar en reposo; revisa las limitaciones vigentes antes de usarlo con datos escolares reales. Nunca publiques la cadena de conexión ni las claves de Cloudinary.

Si ya hay solicitudes en Atlas cuyos comprobantes están en `backend/uploads`, primero configura las variables de Atlas y Cloudinary en `backend/.env`, conserva esos archivos en esa carpeta y ejecuta `npm run migrate-receipts-cloudinary --prefix backend` para revisar cuántos se pueden migrar. Para aplicar los cambios a Atlas y subirlos a Cloudinary, ejecuta `npm run migrate-receipts-cloudinary --prefix backend -- --apply`. La migración actualiza únicamente la ruta del comprobante de las solicitudes; no borra los archivos locales. Haz una copia de seguridad de Atlas antes de aplicarla.

## Crear una cuenta de encargado

Desde esta carpeta ejecuta `npm run create-staff` en una terminal interactiva. El comando solicita una cuenta `@gmail.com`, nombre y una contraseña de al menos 12 caracteres, que no se muestra al escribir. Las cuentas de encargado se crean en `personal`; el registro público siempre crea alumnos en `alumnos`.

## Folios de justificantes

Los folios se asignan en orden del 1 al 200 y vuelven a empezar en 1. Se guardan en el campo `folio` de cada documento de la colección `justificante`; no se usa una colección adicional para los folios. Para renumerar los justificantes ya guardados, detén el backend y ejecuta `npm run renumber-folios`. El comando actualiza los folios en la base `justificat` por fecha de emisión y quita el índice único anterior.

## Protección de rutas

El acceso usa una cookie `HttpOnly` firmada y de duración limitada. El backend vuelve a consultar la cuenta en la colección correspondiente para cada petición protegida y autoriza las funciones administrativas por el tipo de cuenta. Las solicitudes de alumnos obtienen la identidad escolar desde su cuenta autenticada, no desde los datos enviados por el navegador.
