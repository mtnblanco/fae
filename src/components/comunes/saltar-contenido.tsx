/** Enlace para saltar la navegación con el teclado (visible solo al enfocarlo). */
export function SaltarAlContenido() {
  return (
    <a
      href="#contenido"
      className="sr-only z-50 rounded-md bg-oro px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Saltar al contenido
    </a>
  );
}
