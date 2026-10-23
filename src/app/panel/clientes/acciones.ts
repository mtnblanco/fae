"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { barberoActivoEnBase, requireBarbero, requireDueno } from "@/lib/auth";
import { clienteParaEscaneo } from "@/lib/datos/panel";
import { aNumero, formatearPesos } from "@/lib/dinero";
import { ERROR_GENERICO, esDuplicado, mensajeDeErrorDb } from "@/lib/errores";
import { type EstadoFormulario, texto } from "@/lib/formularios";
import { exito, fallo, type Resultado } from "@/lib/resultado";
import { RUTAS } from "@/lib/rutas";
import { createAdminClient, dominioEmailClientes } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { esPasswordTelefono } from "@/lib/password";
import { emailInterno } from "@/lib/telefono";
import {
  CORTES_MAX,
  CORTES_MIN,
  altaClienteSchema,
  editarClienteSchema,
  erroresDeCampo,
  idSchema,
  montoSchema,
  precioClienteSchema,
  resetPasswordSchema,
} from "@/lib/validaciones";

export type Credenciales = { id: string; nombre: string; telefono: string; password: string };

const TELEFONO_REPETIDO = "Ya hay un cliente con ese teléfono.";
const SIN_PERMISO = "No tenés permiso para hacer esto.";

function revalidarPanel() {
  revalidatePath(RUTAS.panel, "layout");
}

/** Verifica con service role que el id corresponda a un CLIENTE (nunca a un barbero). */
async function buscarCliente(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await admin
    .from("perfiles")
    .select("id, nombre, telefono, rol")
    .eq("id", id)
    .maybeSingle();
  return data?.rol === "cliente" ? data : null;
}

// ─── Alta ───────────────────────────────────────────────────────────────────
export async function crearCliente(
  _previo: EstadoFormulario<Credenciales>,
  formData: FormData,
): Promise<EstadoFormulario<Credenciales>> {
  const { perfil } = await requireBarbero();
  const valores = {
    nombre: texto(formData, "nombre"),
    telefono: texto(formData, "telefono"),
    // El precio lo carga solo el dueño; si lo manda el empleado, se ignora.
    ...(perfil.es_dueno ? { precio: texto(formData, "precio") } : {}),
  };
  const parse = altaClienteSchema.safeParse({ ...valores, password: texto(formData, "password") });
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error), valores };

  const { nombre, telefono, password } = parse.data;
  const precio = perfil.es_dueno ? (parse.data.precio ?? null) : null;
  if (!(await barberoActivoEnBase())) return { estado: "error", mensaje: SIN_PERMISO, valores };
  const admin = createAdminClient();

  const { data: creado, error } = await admin.auth.admin.createUser({
    email: emailInterno(telefono, dominioEmailClientes()),
    password,
    email_confirm: true,
  });
  if (error || !creado.user) {
    return esDuplicado(error) || error?.code === "email_exists"
      ? { estado: "error", errores: { telefono: [TELEFONO_REPETIDO] }, valores }
      : { estado: "error", mensaje: ERROR_GENERICO, valores };
  }

  const { error: errorPerfil } = await admin.from("perfiles").insert({
    id: creado.user.id,
    nombre,
    telefono,
    rol: "cliente",
    debe_cambiar_password: true,
    precio_habitual: precio,
  });
  if (errorPerfil) {
    // Compensación: sin perfil, el usuario de Auth no sirve. Lo borramos.
    await admin.auth.admin.deleteUser(creado.user.id);
    return esDuplicado(errorPerfil)
      ? { estado: "error", errores: { telefono: [TELEFONO_REPETIDO] }, valores }
      : { estado: "error", mensaje: ERROR_GENERICO, valores };
  }

  revalidarPanel();
  return { estado: "ok", datos: { id: creado.user.id, nombre, telefono, password } };
}

// ─── Edición ────────────────────────────────────────────────────────────────
export async function editarCliente(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requireBarbero();
  const valores = { nombre: texto(formData, "nombre"), telefono: texto(formData, "telefono") };
  const parse = editarClienteSchema.safeParse({ ...valores, id: texto(formData, "id") });
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error), valores };

  const { id, nombre, telefono } = parse.data;
  if (!(await barberoActivoEnBase())) return { estado: "error", mensaje: SIN_PERMISO, valores };
  const admin = createAdminClient();
  const actual = await buscarCliente(admin, id);
  if (!actual) return { estado: "error", mensaje: "No encontramos a ese cliente." };

  const cambiaTelefono = actual.telefono !== telefono;
  const dominio = dominioEmailClientes();

  // El teléfono es el usuario: si cambia, también cambia el email interno de Auth.
  if (cambiaTelefono) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      email: emailInterno(telefono, dominio),
      email_confirm: true,
    });
    if (error) {
      return esDuplicado(error) || error.code === "email_exists"
        ? { estado: "error", errores: { telefono: [TELEFONO_REPETIDO] }, valores }
        : { estado: "error", mensaje: ERROR_GENERICO, valores };
    }
  }

  const { error } = await admin.from("perfiles").update({ nombre, telefono }).eq("id", id);
  if (error) {
    if (cambiaTelefono && actual.telefono) {
      await admin.auth.admin.updateUserById(id, {
        email: emailInterno(actual.telefono, dominio),
        email_confirm: true,
      });
    }
    return esDuplicado(error)
      ? { estado: "error", errores: { telefono: [TELEFONO_REPETIDO] }, valores }
      : { estado: "error", mensaje: ERROR_GENERICO, valores };
  }

  revalidarPanel();
  return {
    estado: "ok",
    mensaje: cambiaTelefono
      ? "Datos guardados. Desde ahora entra con el teléfono nuevo."
      : "Datos guardados.",
  };
}

// ─── Precio habitual (solo el dueño; la base vuelve a verificarlo) ──────────
export async function guardarPrecio(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requireDueno();
  const valores = { precio: texto(formData, "precio") };
  const parse = precioClienteSchema.safeParse({ ...valores, id: texto(formData, "id") });
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error), valores };

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_precio_cliente", {
    p_cliente_id: parse.data.id,
    p_precio: parse.data.precio,
  });
  if (error) return { estado: "error", mensaje: mensajeDeErrorDb(error), valores };

  revalidarPanel();
  return {
    estado: "ok",
    mensaje:
      parse.data.precio === null
        ? "Precio borrado."
        : `Precio guardado: ${formatearPesos(parse.data.precio)}.`,
  };
}

// ─── Reseteo de contraseña ──────────────────────────────────────────────────
export async function resetearPassword(
  _previo: EstadoFormulario<Credenciales>,
  formData: FormData,
): Promise<EstadoFormulario<Credenciales>> {
  const { userId } = await requireBarbero();
  const parse = resetPasswordSchema.safeParse({
    id: texto(formData, "id"),
    password: texto(formData, "password"),
  });
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error) };

  const { id, password } = parse.data;
  if (!(await barberoActivoEnBase())) return { estado: "error", mensaje: SIN_PERMISO };
  const admin = createAdminClient();
  const cliente = await buscarCliente(admin, id);
  if (!cliente?.telefono) return { estado: "error", mensaje: "No encontramos a ese cliente." };
  if (esPasswordTelefono(password, cliente.telefono)) {
    return {
      estado: "error",
      errores: { password: ["No uses el teléfono del cliente como contraseña."] },
    };
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { estado: "error", mensaje: ERROR_GENERICO };

  const { error: errorFlag } = await admin
    .from("perfiles")
    .update({ debe_cambiar_password: true })
    .eq("id", id);
  if (errorFlag) return { estado: "error", mensaje: ERROR_GENERICO };

  // El caso típico es "perdí el celular" o "alguien entró a mi cuenta": se
  // cierran todas las sesiones abiertas (ninguna puede renovarse). La que
  // todavía tenga un token vigente (hasta 1 h) cae en el cambio obligatorio,
  // que pide esta contraseña temporal.
  const { error: errorSesiones } = await admin.rpc("revocar_sesiones", { p_usuario: id });
  if (errorSesiones) {
    console.error("[reseteo] No se pudieron cerrar las sesiones:", errorSesiones.message);
    return {
      estado: "error",
      mensaje:
        "La contraseña se cambió, pero no pudimos cerrar las sesiones abiertas del cliente. Probá de nuevo.",
    };
  }

  // Registro de quién la reseteó (lo ve el dueño). Si falla, no frena el reseteo.
  const { error: errorRegistro } = await admin
    .from("reseteos_password")
    .insert({ cliente_id: id, barbero_id: userId });
  if (errorRegistro) console.error("[reseteo] No se registró:", errorRegistro.message);

  revalidarPanel();
  return {
    estado: "ok",
    datos: { id, nombre: cliente.nombre, telefono: cliente.telefono, password },
  };
}

// ─── Baja ───────────────────────────────────────────────────────────────────
export async function eliminarCliente(id: string): Promise<Resultado> {
  await requireDueno();
  if (!idSchema.safeParse(id).success) return fallo("Cliente inválido.");
  if (!(await barberoActivoEnBase(true))) return fallo(SIN_PERMISO);
  const admin = createAdminClient();
  if (!(await buscarCliente(admin, id))) return fallo("No encontramos a ese cliente.");

  // Borra el usuario de Auth; el perfil, los cortes y los canjes se van en cascada.
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return fallo(ERROR_GENERICO);

  revalidarPanel();
  redirect(`${RUTAS.clientes}?eliminado=1`);
}

// ─── Cortes y premios (con la sesión del barbero: valida la base) ───────────
export type EstadoCliente = NonNullable<Awaited<ReturnType<typeof clienteParaEscaneo>>>;

/** Suma un corte con lo que pagó el cliente (`monto` null = sin monto). */
export async function sumarCorte(
  clienteId: string,
  solicitudId: string,
  monto: number | null,
): Promise<Resultado<{ corteId: string; monto: number | null; cliente: EstadoCliente | null }>> {
  await requireBarbero();
  if (!idSchema.safeParse(clienteId).success || !idSchema.safeParse(solicitudId).success) {
    return fallo("Solicitud inválida.");
  }
  const montoValido = montoSchema.safeParse(monto);
  if (!montoValido.success) return fallo(mensajeDeErrorDb({ message: "monto_invalido" }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_corte", {
    p_cliente_id: clienteId,
    p_solicitud_id: solicitudId,
    p_monto: montoValido.data,
  });
  if (error || !data) return fallo(mensajeDeErrorDb(error));

  revalidarPanel();
  return exito({
    corteId: data.id,
    monto: aNumero(data.monto),
    cliente: await clienteParaEscaneo(clienteId),
  });
}

export async function deshacerCorte(corteId: string): Promise<Resultado> {
  await requireBarbero();
  if (!idSchema.safeParse(corteId).success) return fallo("Corte inválido.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("deshacer_corte", { p_corte_id: corteId });
  if (error) return fallo(mensajeDeErrorDb(error));
  revalidarPanel();
  return exito(undefined);
}

/** Canjea el premio de la etapa `etapa` (el corte n.º de esa etapa). */
export async function canjearPremio(
  clienteId: string,
  solicitudId: string,
  etapa: number,
): Promise<Resultado<{ premio: string; cliente: EstadoCliente | null }>> {
  await requireBarbero();
  if (
    !idSchema.safeParse(clienteId).success ||
    !idSchema.safeParse(solicitudId).success ||
    !Number.isInteger(etapa) ||
    etapa < CORTES_MIN ||
    etapa > CORTES_MAX
  ) {
    return fallo("Solicitud inválida.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("canjear_premio", {
    p_cliente_id: clienteId,
    p_solicitud_id: solicitudId,
    p_etapa: etapa,
  });
  if (error || !data) return fallo(mensajeDeErrorDb(error));

  revalidarPanel();
  return exito({ premio: data.premio_descripcion, cliente: await clienteParaEscaneo(clienteId) });
}

/** Para el escáner: datos del cliente cuyo QR se leyó. */
export async function buscarClienteEscaneado(id: string): Promise<Resultado<EstadoCliente>> {
  await requireBarbero();
  if (!idSchema.safeParse(id).success) return fallo("Ese QR no es de un carnet de la barbería.");
  const cliente = await clienteParaEscaneo(id);
  return cliente
    ? exito(cliente)
    : fallo("No encontramos a ese cliente. Puede que lo hayan dado de baja.");
}
