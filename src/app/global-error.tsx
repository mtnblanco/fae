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
          background: "#12100c",
          color: "#f1ebdd",
          fontFamily: "system-ui, sans-serif",
          padding:
            "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 32 }}>
            Algo salió mal
          </h1>
          <p style={{ color: "#ada28d", lineHeight: 1.6 }}>
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
              background: "#c9a227",
              color: "#15110a",
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
