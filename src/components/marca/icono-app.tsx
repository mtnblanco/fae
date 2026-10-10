import { svgPosteDataUri } from "@/lib/marca-svg";

/** Ícono de la app para next/og: poste sobre fondo espresso con aro de bronce. */
export function IconoApp({
  tamano,
  margenSeguro = false,
}: {
  tamano: number;
  margenSeguro?: boolean;
}) {
  // Los íconos "maskable" necesitan el dibujo dentro del 80% central.
  const escala = margenSeguro ? 0.5 : 0.62;
  const alto = Math.round(tamano * escala);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 30% 20%, #2b231c 0%, #15110e 70%)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og necesita <img> */}
      <img src={svgPosteDataUri()} width={Math.round(alto * 0.6)} height={alto} alt="" />
    </div>
  );
}
