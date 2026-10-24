import "server-only";
import { cache } from "react";
import { normalizarBusqueda } from "@/lib/busqueda";
import type {
  Canje,
  Corte,
  Descuento,
  FilaFacturacion,
  Metricas,
  Regla,
  ResumenCliente,
} from "@/lib/database.types";
import { aNumero } from "@/lib/dinero";
import { limitesRango, type Rango } from "@/lib/periodos";
import { createClient } from "@/lib/supabase/server";

/** Todas las consultas usan la sesión del barbero: el RLS se aplica igual. */

const POR_PAGINA = 20;

export const FILTROS_CLIENTES = ["todos", "con-premio", "inactivos", "nuevos"] as const;
export type FiltroClientes = (typeof FILTROS_CLIENTES)[number];

export const ORDENES_CLIENTES = ["ultima-visita", "nombre", "alta"] as const;
export type OrdenClientes = (typeof ORDENES_CLIENTES)[number];

const DIAS = 86_400_000;

function fallar(error: { message: string } | null, contexto: string): never | void {
  if (error) throw new Error(`${contexto}: ${error.message}`);
}

export async function obtenerMetricas(): Promise<Metricas> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("metricas_panel");
  fallar(error, "No se pudieron cargar las métricas");
  const fila = data?.[0];
  if (!fila) throw new Error("No se pudieron cargar las métricas");
  return fila;
}

export type ClienteListado = Pick<
  ResumenCliente,
  | "id"
  | "nombre"
  | "telefono"
  | "total_cortes"
  | "ultimo_corte"
  | "sellos_actuales"
  | "premios_disponibles"
  | "cortes_necesarios"
  | "etapas"
  | "premios"
  | "created_at"
>;

const COLUMNAS_LISTADO =
  "id, nombre, telefono, total_cortes, ultimo_corte, sellos_actuales, premios_disponibles, cortes_necesarios, etapas, premios, created_at";

export async function listarClientes(opciones: {
  busqueda?: string;
  filtro?: FiltroClientes;
  orden?: OrdenClientes;
  pagina?: number;
}) {
  const pagina = Math.max(1, opciones.pagina ?? 1);
  const desde = (pagina - 1) * POR_PAGINA;
  const supabase = await createClient();

  let consulta = supabase.from("resumen_clientes").select(COLUMNAS_LISTADO, { count: "exact" });

  const termino = opciones.busqueda ? normalizarBusqueda(opciones.busqueda) : null;
  if (termino) consulta = consulta.ilike("busqueda", `*${termino}*`);

  const ahora = Date.now();
  switch (opciones.filtro) {
    case "con-premio":
      consulta = consulta.gt("premios_disponibles", 0);
      break;
    case "inactivos":
      consulta = consulta.lt("ultimo_corte", new Date(ahora - 30 * DIAS).toISOString());
      break;
    case "nuevos":
      consulta = consulta.gte("created_at", new Date(ahora - 30 * DIAS).toISOString());
      break;
    default:
      break;
  }

  switch (opciones.orden) {
    case "nombre":
      consulta = consulta.order("nombre", { ascending: true });
      break;
    case "alta":
      consulta = consulta.order("created_at", { ascending: false });
      break;
    default:
      consulta = consulta
        .order("ultimo_corte", { ascending: false, nullsFirst: false })
        .order("nombre");
  }

  const { data, count, error } = await consulta.range(desde, desde + POR_PAGINA - 1);
  // PGRST103: página fuera de rango (por ejemplo, ?pagina=999). La página vuelve a la primera.
  if (error?.code !== "PGRST103") fallar(error, "No se pudieron cargar los clientes");

  const total = count ?? 0;
  return {
    clientes: (data ?? []) as ClienteListado[],
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    porPagina: POR_PAGINA,
  };
}

/** Cuántos movimientos muestra el historial de la ficha (y cuántos suma "Ver más"). */
export const HISTORIAL_POR_PAGINA = 20;
export const HISTORIAL_MAX = 1000;

export type CorteHistorial = Pick<Corte, "id" | "fecha" | "registrado_por" | "monto">;

/**
 * Ficha del cliente con los primeros `limite` movimientos del historial.
 * El RLS decide qué cortes vuelven: el dueño ve todos; el empleado, los suyos.
 */
export async function obtenerCliente(id: string, limite = HISTORIAL_POR_PAGINA) {
  const supabase = await createClient();
  const [resumen, cortes, canjes] = await Promise.all([
    supabase.from("resumen_clientes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("cortes")
      .select("id, fecha, registrado_por, monto", { count: "exact" })
      .eq("cliente_id", id)
      .order("fecha", { ascending: false })
      .limit(limite),
    supabase
      .from("canjes")
      .select("id, fecha, premio_descripcion, registrado_por", { count: "exact" })
      .eq("cliente_id", id)
      .order("fecha", { ascending: false })
      .limit(limite),
  ]);
  fallar(resumen.error ?? cortes.error ?? canjes.error, "No se pudo cargar el cliente");
  if (!resumen.data) return null;
  return {
    cliente: { ...resumen.data, precio_habitual: aNumero(resumen.data.precio_habitual) },
    cortes: (cortes.data ?? []).map((c) => ({ ...c, monto: aNumero(c.monto) })) as CorteHistorial[],
    canjes: (canjes.data ?? []) as Pick<
      Canje,
      "id" | "fecha" | "premio_descripcion" | "registrado_por"
    >[],
    /** Cortes que puede ver quien consulta (para el empleado, solo los suyos). */
    cortesVisibles: cortes.count ?? 0,
    canjesTotal: canjes.count ?? 0,
  };
}

/** Nombre de cada barbero, por id (para mostrar quién hizo cada corte). */
export const nombresBarberos = cache(async (): Promise<Record<string, string>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("perfiles").select("id, nombre").eq("rol", "barbero");
  fallar(error, "No se pudieron cargar los barberos");
  return Object.fromEntries((data ?? []).map((b) => [b.id, b.nombre]));
});

// ─── Caja (solo el dueño: la base rechaza al empleado) ──────────────────────
export async function obtenerFacturacion({ desde, hasta }: Rango): Promise<FilaFacturacion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("facturacion", { p_desde: desde, p_hasta: hasta });
  fallar(error, "No se pudo cargar la caja");
  return (data ?? []).map((f) => ({ ...f, total: aNumero(f.total) ?? 0 }));
}

const CORTES_POR_PAGINA = 25;

export type CorteCaja = CorteHistorial & { clienteId: string; clienteNombre: string };

/** Cortes de un período, del más nuevo al más viejo, con el nombre del cliente. */
export async function listarCortesPeriodo(rango: Rango, paginaPedida = 1) {
  const pagina = Math.max(1, paginaPedida);
  const desde = (pagina - 1) * CORTES_POR_PAGINA;
  const { inicio, fin } = limitesRango(rango);
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("cortes")
    .select("id, fecha, cliente_id, registrado_por, monto", { count: "exact" })
    .gte("fecha", inicio)
    .lt("fecha", fin)
    .order("fecha", { ascending: false })
    .range(desde, desde + CORTES_POR_PAGINA - 1);
  if (error?.code !== "PGRST103") fallar(error, "No se pudieron cargar los cortes");

  const filas = data ?? [];
  const ids = [...new Set(filas.map((c) => c.cliente_id))];
  const nombres = new Map<string, string>();
  if (ids.length) {
    const r = await supabase.from("perfiles").select("id, nombre").in("id", ids);
    fallar(r.error, "No se pudieron cargar los cortes");
    for (const p of r.data ?? []) nombres.set(p.id, p.nombre);
  }

  const total = count ?? 0;
  return {
    cortes: filas.map((c): CorteCaja => ({
      id: c.id,
      fecha: c.fecha,
      registrado_por: c.registrado_por,
      monto: aNumero(c.monto),
      clienteId: c.cliente_id,
      clienteNombre: nombres.get(c.cliente_id) ?? "Cliente eliminado",
    })),
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / CORTES_POR_PAGINA)),
    porPagina: CORTES_POR_PAGINA,
  };
}

export type Actividad = {
  id: string;
  tipo: "corte" | "canje";
  fecha: string;
  clienteId: string;
  clienteNombre: string;
  detalle?: string;
  registrado_por?: string | null;
};

export async function actividadReciente(limite = 8): Promise<Actividad[]> {
  const supabase = await createClient();
  const [cortes, canjes] = await Promise.all([
    supabase
      .from("cortes")
      .select("id, fecha, cliente_id, registrado_por")
      .order("fecha", { ascending: false })
      .limit(limite),
    supabase
      .from("canjes")
      .select("id, fecha, cliente_id, premio_descripcion")
      .order("fecha", { ascending: false })
      .limit(limite),
  ]);
  fallar(cortes.error ?? canjes.error, "No se pudo cargar la actividad");

  const items = [
    ...(cortes.data ?? []).map((c) => ({
      id: c.id,
      tipo: "corte" as const,
      fecha: c.fecha,
      clienteId: c.cliente_id,
      registrado_por: c.registrado_por,
    })),
    ...(canjes.data ?? []).map((c) => ({
      id: c.id,
      tipo: "canje" as const,
      fecha: c.fecha,
      clienteId: c.cliente_id,
      detalle: c.premio_descripcion,
    })),
  ]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, limite);

  const ids = [...new Set(items.map((i) => i.clienteId))];
  const nombres = new Map<string, string>();
  if (ids.length) {
    const { data, error } = await supabase.from("perfiles").select("id, nombre").in("id", ids);
    fallar(error, "No se pudo cargar la actividad");
    for (const p of data ?? []) nombres.set(p.id, p.nombre);
  }
  return items.map((i) => ({
    ...i,
    clienteNombre: nombres.get(i.clienteId) ?? "Cliente eliminado",
  }));
}

export async function clientesConPremio(limite = 5) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumen_clientes")
    .select("id, nombre, premios_disponibles, ultimo_corte")
    .gt("premios_disponibles", 0)
    .order("ultimo_corte", { ascending: false, nullsFirst: false })
    .limit(limite);
  fallar(error, "No se pudieron cargar los premios pendientes");
  return data ?? [];
}

export async function listarDescuentos(): Promise<Descuento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("descuentos_asociados")
    .select("*")
    .order("activo", { ascending: false })
    .order("created_at", { ascending: false });
  fallar(error, "No se pudieron cargar los descuentos");
  return data ?? [];
}

export async function obtenerReglas(): Promise<{ activa: Regla | null; historial: Regla[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reglas")
    .select("*")
    .order("created_at", { ascending: false });
  fallar(error, "No se pudo cargar la regla de premios");
  const reglas = data ?? [];
  return {
    activa: reglas.find((r) => r.activa) ?? null,
    historial: reglas.filter((r) => !r.activa),
  };
}

/** Datos mínimos de un cliente para la pantalla del escáner (incluye su precio, para cobrarle). */
export async function clienteParaEscaneo(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumen_clientes")
    .select(
      "id, nombre, telefono, total_cortes, sellos_actuales, premios_disponibles, cortes_necesarios, descripcion_premio, etapas, premios, ultimo_corte, precio_habitual",
    )
    .eq("id", id)
    .maybeSingle();
  fallar(error, "No se pudo cargar el cliente");
  return data ? { ...data, precio_habitual: aNumero(data.precio_habitual) } : null;
}
