const schoolPhotos = [
  { src: '/imagen1.jfif', alt: 'Instalaciones del CBTis 258', caption: 'CBTis 258' },
  { src: '/imagen2.jfif', alt: 'Equipo de los Cobras', caption: 'Cobras' },
  { src: '/imagen3.jfif', alt: 'Cancha del CBTis 258', caption: 'Cancha' },
];

export default function SchoolIdentity() {
  return (
    <section className="poster-panel" aria-label="Identidad del CBTis 258">
      <div className="school-showcase">
        <div className="school-visual">
          <img className="school-poster" src="/cobra.png" alt="Mascota de los Cobras del CBTis 258" />
          <div className="school-gallery" aria-label="Espacios y comunidad escolar">
            {schoolPhotos.map(({ src, alt, caption }, index) => (
              <figure className={`school-photo-card school-photo-card-${index + 1}`} key={src}>
                <img src={src} alt={alt} />
                <figcaption>{caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="school-brand">
          <h2>CBTis 258</h2>
          <p className="school-name">“Mariano Escobedo de la Peña”</p>
          <p className="school-pride">Un motivo de orgullo</p>
          <div className="school-divider" />
          <p className="school-values">Formación académica | valores | disciplina | éxito</p>
          <p className="school-encouragement">Prepárate para el <strong>éxito</strong></p>
        </div>
      </div>
    </section>
  );
}
