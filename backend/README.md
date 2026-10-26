# Backend de JutificaT

## Iniciar el servidor

1. Copia `.env.example` a `.env` si aún no tienes uno. El destino configurado es `justificat`.
2. Inicia MongoDB.
3. En esta carpeta ejecuta `npm start`.

En desarrollo, si `SESSION_SECRET` no está definido, se genera una clave temporal y las sesiones dejan de ser válidas al reiniciar. En producción configura `SESSION_SECRET` con una cadena aleatoria de al menos 32 caracteres y sirve la aplicación únicamente por HTTPS.

Puedes generar una clave con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y guardarla como `SESSION_SECRET` en `.env`.

Si Vite se ejecuta en un origen distinto de `http://localhost:5173`, actualiza `FRONTEND_ORIGIN` en `.env` para que coincida exactamente.

## Crear una cuenta de encargado

Desde esta carpeta ejecuta `npm run create-staff` en una terminal interactiva. El comando solicita correo, nombre y una contraseña de al menos 12 caracteres, que no se muestra al escribir. Las cuentas de encargado se crean en `personal`; el registro público siempre crea alumnos en `alumnos`.

## Migrar desde la base anterior

Ejecuta `npm run migrate-database` para copiar los datos de `sistema_justificantes` a `justificat`. La migración es repetible, no borra ni modifica la fuente y solo agrega registros que todavía no existan en el destino. Si la fuente está en otro servidor, define `SOURCE_MONGO_URI` en `.env`.

El destino usa las colecciones `alumnos`, `personal`, `solicitud_justificante` y `justificante`, de acuerdo con el diagrama. Las contraseñas se guardan como hashes. `alumnos` conserva además correo y credencial para permitir el inicio de sesión de estudiantes; `justificante` conserva `id_solicitud` para vincular la emisión a su solicitud.

Después de verificar los datos en Compass, inicia o reinicia el backend con `npm start`.

## Folios de justificantes

Los folios se asignan en orden del 1 al 200 y vuelven a empezar en 1. Se guardan en el campo `folio` de cada documento de la colección `justificante`; no se usa una colección adicional para los folios. Para renumerar los justificantes ya guardados, detén el backend y ejecuta `npm run renumber-folios`. El comando actualiza los folios en la base `justificat` por fecha de emisión y quita el índice único anterior.

## Protección de rutas

El acceso usa una cookie `HttpOnly` firmada y de duración limitada. El backend vuelve a consultar la cuenta en la colección correspondiente para cada petición protegida y autoriza las funciones administrativas por el tipo de cuenta. Las solicitudes de alumnos obtienen la identidad escolar desde su cuenta autenticada, no desde los datos enviados por el navegador.
