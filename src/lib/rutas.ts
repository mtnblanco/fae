import type { Rol } from "@/lib/database.types";

export const RUTAS = {
  inicio: "/",
  login: "/login",
  cambiarPassword: "/cambiar-password",
  carnet: "/carnet",
  panel: "/panel",
  clientes: "/panel/clientes",
  escanear: "/panel/escanear",
  descuentos: "/panel/descuentos",
  reglas: "/panel/reglas",
  caja: "/panel/caja",
  cajaExportar: "/panel/caja/exportar",
  registrar: "/panel/registrar",
  turnos: "/turnos",
  agenda: "/panel/agenda",
  horarios: "/panel/agenda/horarios",
  servicios: "/panel/agenda/servicios",
} as const;

export const rutaCliente = (id: string) => `${RUTAS.clientes}/${id}`;
export const rutaTurnosBarbero = (id: string) => `${RUTAS.turnos}/${id}`;

/** A dónde va cada usuario después de loguearse. */
export function destinoSegunPerfil(perfil: { rol: Rol; debe_cambiar_password: boolean }): string {
  if (perfil.debe_cambiar_password) return RUTAS.cambiarPassword;
  return perfil.rol === "barbero" ? RUTAS.panel : RUTAS.carnet;
}
