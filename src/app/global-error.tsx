"use client";

// Último recurso: se muestra si falla el layout raíz. No puede usar los estilos
// globales, así que va con estilos en línea.
export default function ErrorGlobal({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es-AR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#15110e",
          color: "#eee6d8",
          fontFamily: "system-ui, sans-serif",
          padding: 16,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 32 }}>
            Algo salió mal
          </h1>
          <p style={{ color: "#b0a493", lineHeight: 1.6 }}>
            La app tuvo un problema inesperado. Probá de nuevo.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              height: 48,
              padding: "0 24px",
              borderRadius: 12,
              border: 0,
              background: "#c9a15b",
              color: "#1a140c",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
