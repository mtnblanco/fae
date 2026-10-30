import "server-only";
import { type PDFFont, type PDFPage, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { sitio } from "@/config/site";
import { formatearPesos } from "@/lib/dinero";
import {
  diaInforme,
  diaISOInforme,
  horaInforme,
  type Informe,
  type TotalesInforme,
} from "@/lib/informe";

// A4 vertical, en puntos. Blanco y negro: es para imprimir o mandar.
const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 40;
const UTIL = ANCHO - 2 * MARGEN;

const NEGRO = rgb(0.1, 0.1, 0.1);
const GRIS = rgb(0.42, 0.42, 0.42);
const LINEA = rgb(0.82, 0.82, 0.82);
const FONDO = rgb(0.95, 0.95, 0.95);

type Columna = { titulo: string; ancho: number; derecha?: boolean };

/**
 * Las fuentes estándar del PDF solo tienen los caracteres de Windows-1252
 * (tildes y ñ sí; emojis no): lo demás se reemplaza para que no falle.
 */
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const seguro = (texto: string) =>
  [...texto.normalize("NFC")]
    .map((c) => {
      const n = c.codePointAt(0)!;
      return (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || WIN_ANSI_EXTRA.has(c)
        ? c
        : "?";
    })
    .join("");

/** Recorta el texto con "…" para que entre en el ancho. */
function ajustar(texto: string, fuente: PDFFont, tam: number, ancho: number): string {
  let t = seguro(texto);
  if (fuente.widthOfTextAtSize(t, tam) <= ancho) return t;
  while (t.length > 1 && fuente.widthOfTextAtSize(`${t}…`, tam) > ancho) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export async function informePdf(
  informe: Informe,
  generado: Date = new Date(),
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const { desde, hasta } = informe.rango;
  const periodo =
    desde === hasta
      ? `Día ${diaISOInforme(desde)}`
      : `Del ${diaISOInforme(desde)} al ${diaISOInforme(hasta)}`;

  doc.setTitle(`Informe de caja ${sitio.nombre} · ${periodo}`);
  doc.setAuthor(sitio.nombre);
  doc.setCreator(sitio.nombre);
  doc.setCreationDate(generado);

  let pagina: PDFPage = doc.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const texto = (
    t: string,
    x: number,
    opciones: {
      tam?: number;
      fuente?: PDFFont;
      color?: typeof NEGRO;
      ancho?: number;
      derecha?: boolean;
    } = {},
  ) => {
    const { tam = 9, fuente = normal, color = NEGRO, ancho, derecha } = opciones;
    const valor = ancho ? ajustar(t, fuente, tam, ancho) : seguro(t);
    const dx = derecha && ancho ? ancho - fuente.widthOfTextAtSize(valor, tam) : 0;
    pagina.drawText(valor, { x: x + dx, y, size: tam, font: fuente, color });
  };
  const linea = (grosor = 0.5, color = LINEA) =>
    pagina.drawLine({
      start: { x: MARGEN, y },
      end: { x: ANCHO - MARGEN, y },
      thickness: grosor,
      color,
    });

  function nuevaPagina() {
    pagina = doc.addPage([ANCHO, ALTO]);
    y = ALTO - MARGEN;
    texto(`${sitio.nombre} · Informe de caja · ${periodo}`, MARGEN, { tam: 8, color: GRIS });
    y -= 20;
  }

  /** Deja lugar para `alto` puntos; si no entra, sigue en otra página. */
  function lugar(alto: number): boolean {
    if (y - alto >= MARGEN + 16) return false;
    nuevaPagina();
    return true;
  }

  function encabezadoTabla(columnas: Columna[]) {
    pagina.drawRectangle({ x: MARGEN, y: y - 5, width: UTIL, height: 17, color: FONDO });
    let x = MARGEN;
    for (const c of columnas) {
      texto(c.titulo, x + 4, { tam: 8, fuente: negrita, ancho: c.ancho - 8, derecha: c.derecha });
      x += c.ancho;
    }
    y -= 17;
  }

  function filaTabla(columnas: Columna[], valores: string[], fuente = normal) {
    let x = MARGEN;
    columnas.forEach((c, i) => {
      texto(valores[i] ?? "", x + 4, { fuente, ancho: c.ancho - 8, derecha: c.derecha });
      x += c.ancho;
    });
    y -= 6;
    linea();
    y -= 11;
  }

  function tabla(columnas: Columna[], filas: string[][], pie?: string[]) {
    lugar(17 * 3);
    encabezadoTabla(columnas);
    for (const f of filas) {
      if (lugar(17)) encabezadoTabla(columnas);
      filaTabla(columnas, f);
    }
    if (pie) {
      if (lugar(17)) encabezadoTabla(columnas);
      filaTabla(columnas, pie, negrita);
    }
  }

  function titulo(t: string) {
    lugar(40);
    y -= 8;
    texto(t, MARGEN, { tam: 12, fuente: negrita });
    y -= 18;
  }

  // ─── Encabezado ───
  texto(sitio.nombre, MARGEN, { tam: 18, fuente: negrita });
  texto(
    `Generado el ${diaInforme(generado.toISOString())} a las ${horaInforme(generado.toISOString())}`,
    MARGEN,
    {
      tam: 8,
      color: GRIS,
      ancho: UTIL,
      derecha: true,
    },
  );
  y -= 20;
  texto("Informe de caja", MARGEN, { tam: 12 });
  y -= 15;
  texto(periodo, MARGEN, { tam: 10, color: GRIS });
  y -= 12;
  linea(1, NEGRO);
  y -= 26;

  // ─── Resumen ───
  const t = informe.totales;
  const cajas: [string, string][] = [
    ["Total cobrado", formatearPesos(t.total)],
    ["Efectivo", formatearPesos(t.efectivo)],
    ["Transferencia", formatearPesos(t.transferencia)],
    ["Servicios", String(t.cantidad)],
  ];
  const anchoCaja = UTIL / cajas.length;
  cajas.forEach(([etiqueta, valor], i) => {
    const x = MARGEN + i * anchoCaja;
    texto(etiqueta, x, { tam: 8, color: GRIS, ancho: anchoCaja - 8 });
    y -= 16;
    texto(valor, x, { tam: 14, fuente: negrita, ancho: anchoCaja - 8 });
    y += 16;
  });
  y -= 30;
  if (t.sinDato > 0) {
    texto(
      `Incluye ${formatearPesos(t.sinDato)} de cortes cargados antes de registrar el medio de pago (sin dato).`,
      MARGEN,
      { tam: 8, color: GRIS, ancho: UTIL },
    );
    y -= 14;
  }

  // ─── Por barbero ───
  const sinDato = t.sinDato > 0;
  const colsBarbero: Columna[] = [
    { titulo: "Barbero", ancho: sinDato ? 155 : 215 },
    { titulo: "Servicios", ancho: 60, derecha: true },
    { titulo: "Efectivo", ancho: 80, derecha: true },
    { titulo: "Transferencia", ancho: 80, derecha: true },
    ...(sinDato ? [{ titulo: "Sin dato", ancho: 60, derecha: true }] : []),
    { titulo: "Total", ancho: 80, derecha: true },
  ];
  const valoresBarbero = (nombre: string, b: TotalesInforme) => [
    nombre,
    String(b.cantidad),
    formatearPesos(b.efectivo),
    formatearPesos(b.transferencia),
    ...(sinDato ? [formatearPesos(b.sinDato)] : []),
    formatearPesos(b.total),
  ];
  titulo("Por barbero");
  if (informe.porBarbero.length === 0) {
    texto("No hubo cobros en este período.", MARGEN, { color: GRIS });
    y -= 14;
  } else {
    tabla(
      colsBarbero,
      informe.porBarbero.map((b) => valoresBarbero(b.barbero, b)),
      valoresBarbero("Total", t),
    );
  }

  // ─── Detalle ───
  if (informe.filas.length > 0) {
    titulo("Detalle");
    tabla(
      [
        { titulo: "Fecha", ancho: 58 },
        { titulo: "Hora", ancho: 36 },
        { titulo: "Barbero", ancho: 96 },
        { titulo: "Servicio", ancho: 120 },
        { titulo: "Cliente", ancho: 72 },
        { titulo: "Medio de pago", ancho: 72 },
        { titulo: "Monto", ancho: UTIL - 454, derecha: true },
      ],
      informe.filas.map((f) => [
        f.dia,
        f.hora,
        f.barbero,
        f.servicio,
        f.tipo === "Cliente registrado" ? "Registrado" : "Sin registrar",
        f.medio,
        f.monto === null ? "Sin monto" : formatearPesos(f.monto),
      ]),
    );
  }

  // ─── Números de página ───
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    const etiqueta = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(etiqueta, {
      x: ANCHO - MARGEN - normal.widthOfTextAtSize(etiqueta, 8),
      y: MARGEN - 16,
      size: 8,
      font: normal,
      color: GRIS,
    });
  });

  return doc.save();
}
