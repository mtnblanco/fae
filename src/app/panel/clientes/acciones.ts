"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBarbero } from "@/lib/auth";
import { clienteParaEscaneo } from "@/lib/datos/panel";
import { ERROR_GENERICO, esDuplicado, mensajeDeErrorDb } from "@/lib/errores";
import { type EstadoFormulario, texto } from "@/lib/formularios";
import { exito, fallo, type Resultado } from "@/lib/resultado";
import { RUTAS } from "@/lib/rutas";
import { createAdminClient, dominioEmailClientes } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailInterno } from "@/lib/telefono";
import {
  altaClienteSchema,
  editarClienteSchema,
  erroresDeCampo,
  idSchema,
  resetPasswordSchema,
} from "@/lib/validaciones";

export type Credenciales = { id: string; nombre: string; telefono: string; password: string };

const TELEFONO_REPETIDO = "Ya hay un cliente con ese teléfono.";

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
  await requireBarbero();
  const valores = { nombre: texto(formData, "nombre"), telefono: texto(formData, "telefono") };
  const parse = altaClienteSchema.safeParse({ ...valores, password: texto(formData, "password") });
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error), valores };

  const { nombre, telefono, password } = parse.data;
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

// ─── Reseteo de contraseña ──────────────────────────────────────────────────
export async function resetearPassword(
  _previo: EstadoFormulario<Credenciales>,
  formData: FormData,
): Promise<EstadoFormulario<Credenciales>> {
  await requireBarbero();
  const parse = resetPasswordSchema.safeParse({
    id: texto(formData, "id"),
    password: texto(formData, "password"),
  });
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error) };

  const { id, password } = parse.data;
  const admin = createAdminClient();
  const cliente = await buscarCliente(admin, id);
  if (!cliente?.telefono) return { estado: "error", mensaje: "No encontramos a ese cliente." };

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { estado: "error", mensaje: ERROR_GENERICO };

  const { error: errorFlag } = await admin
    .from("perfiles")
    .update({ debe_cambiar_password: true })
    .eq("id", id);
  if (errorFlag) return { estado: "error", mensaje: ERROR_GENERICO };

  revalidarPanel();
  return {
    estado: "ok",
    datos: { id, nombre: cliente.nombre, telefono: cliente.telefono, password },
  };
}

// ─── Baja ───────────────────────────────────────────────────────────────────
export async function eliminarCliente(id: string): Promise<Resultado> {
  await requireBarbero();
  if (!idSchema.safeParse(id).success) return fallo("Cliente inválido.");
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

export async function sumarCorte(
  clienteId: string,
  solicitudId: string,
): Promise<Resultado<{ corteId: string; cliente: EstadoCliente | null }>> {
  await requireBarbero();
  if (!idSchema.safeParse(clienteId).success || !idSchema.safeParse(solicitudId).success) {
    return fallo("Solicitud inválida.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_corte", {
    p_cliente_id: clienteId,
    p_solicitud_id: solicitudId,
  });
  if (error || !data) return fallo(mensajeDeErrorDb(error));

  revalidarPanel();
  return exito({ corteId: data.id, cliente: await clienteParaEscaneo(clienteId) });
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

export async function canjearPremio(
  clienteId: string,
  solicitudId: string,
): Promise<Resultado<{ premio: string; cliente: EstadoCliente | null }>> {
  await requireBarbero();
  if (!idSchema.safeParse(clienteId).success || !idSchema.safeParse(solicitudId).success) {
    return fallo("Solicitud inválida.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("canjear_premio", {
    p_cliente_id: clienteId,
    p_solicitud_id: solicitudId,
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
