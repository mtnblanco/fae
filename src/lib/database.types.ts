/**
 * Tipos de la base de datos, con el mismo formato que genera
 * `supabase gen types typescript`. Si cambiás las migraciones, regeneralos:
 *
 *   npx supabase gen types typescript --project-id TU_PROYECTO > src/lib/database.types.ts
 */

import type { Etapa, PremioEtapa } from "@/lib/progreso";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Relacion<Nombre extends string, Columna extends string, Tabla extends string> = {
  foreignKeyName: Nombre;
  columns: [Columna];
  isOneToOne: false;
  referencedRelation: Tabla;
  referencedColumns: ["id"];
};

export type Rol = "barbero" | "cliente";
export type MedioPago = "efectivo" | "transferencia";
export type TipoFoto = "image/webp" | "image/jpeg";

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      perfiles: {
        Row: {
          id: string;
          nombre: string;
          telefono: string | null;
          rol: Rol;
          debe_cambiar_password: boolean;
          created_at: string;
          busqueda: string;
          es_dueno: boolean;
          precio_habitual: number | null;
          es_admin: boolean;
          /** Solo barberos: precio de su mensualidad (4 cortes). */
          precio_mensualidad: number | null;
        };
        Insert: {
          id: string;
          nombre: string;
          telefono?: string | null;
          rol?: Rol;
          debe_cambiar_password?: boolean;
          created_at?: string;
          es_dueno?: boolean;
          precio_habitual?: number | null;
          es_admin?: boolean;
        };
        Update: {
          id?: string;
          nombre?: string;
          telefono?: string | null;
          rol?: Rol;
          debe_cambiar_password?: boolean;
          created_at?: string;
          es_dueno?: boolean;
          precio_habitual?: number | null;
          es_admin?: boolean;
        };
        Relationships: [];
      };
      cortes: {
        Row: {
          id: string;
          cliente_id: string;
          fecha: string;
          registrado_por: string | null;
          solicitud_id: string | null;
          monto: number | null;
          /** Null si no se cobró o en cortes anteriores a la migración 20261030000100. */
          medio_pago: MedioPago | null;
        };
        Insert: {
          id?: string;
          cliente_id: string;
          fecha?: string;
          registrado_por?: string | null;
          solicitud_id?: string | null;
          monto?: number | null;
          medio_pago?: MedioPago | null;
        };
        Update: {
          id?: string;
          cliente_id?: string;
          fecha?: string;
          registrado_por?: string | null;
          solicitud_id?: string | null;
          monto?: number | null;
          medio_pago?: MedioPago | null;
        };
        Relationships: [
          Relacion<"cortes_cliente_id_fkey", "cliente_id", "perfiles">,
          Relacion<"cortes_registrado_por_fkey", "registrado_por", "perfiles">,
        ];
      };
      canjes: {
        Row: {
          id: string;
          cliente_id: string;
          fecha: string;
          registrado_por: string | null;
          premio_descripcion: string;
          solicitud_id: string | null;
          /** Corte de la etapa canjeada (null en canjes muy viejos). */
          etapa: number | null;
        };
        Insert: {
          id?: string;
          cliente_id: string;
          fecha?: string;
          registrado_por?: string | null;
          premio_descripcion: string;
          solicitud_id?: string | null;
          etapa?: number | null;
        };
        Update: {
          id?: string;
          cliente_id?: string;
          fecha?: string;
          registrado_por?: string | null;
          premio_descripcion?: string;
          solicitud_id?: string | null;
          etapa?: number | null;
        };
        Relationships: [
          Relacion<"canjes_cliente_id_fkey", "cliente_id", "perfiles">,
          Relacion<"canjes_registrado_por_fkey", "registrado_por", "perfiles">,
        ];
      };
      reglas: {
        Row: {
          id: string;
          /** Largo de la tarjeta (corte de la última etapa). */
          cortes_necesarios: number;
          /** Premio de la última etapa. */
          descripcion_premio: string;
          etapas: Etapa[];
          activa: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          cortes_necesarios?: number;
          descripcion_premio?: string;
          etapas?: Etapa[];
          activa?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          cortes_necesarios?: number;
          descripcion_premio?: string;
          etapas?: Etapa[];
          activa?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      descuentos_asociados: {
        Row: {
          id: string;
          comercio: string;
          descripcion: string;
          vigente_desde: string;
          vigente_hasta: string | null;
          activo: boolean;
          created_at: string;
          /** Versión de la foto del local (null = sin foto). Solo la escriben las funciones. */
          foto_actualizada_en: string | null;
        };
        Insert: {
          id?: string;
          comercio: string;
          descripcion: string;
          vigente_desde?: string;
          vigente_hasta?: string | null;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          comercio?: string;
          descripcion?: string;
          vigente_desde?: string;
          vigente_hasta?: string | null;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      // ─── Foto del local de cada descuento (migración 20261027000100) ───
      fotos_descuentos: {
        Row: {
          descuento_id: string;
          tipo: TipoFoto;
          /** La imagen en base64. */
          foto: string;
          actualizada_en: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // ─── Turnos (migración 20261023000200) ───
      horarios_semanales: {
        Row: {
          id: string;
          barbero_id: string;
          dia_semana: number;
          desde: string;
          hasta: string;
          duracion_min: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      dias_especiales: {
        Row: {
          id: string;
          barbero_id: string;
          fecha: string;
          cerrado: boolean;
          desde: string | null;
          hasta: string | null;
          duracion_min: number | null;
          motivo: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      turnos: {
        Row: {
          id: string;
          barbero_id: string;
          cliente_id: string | null;
          tipo: "reserva" | "bloqueo";
          estado: "reservado" | "atendido" | "cancelado";
          inicio: string;
          fin: string;
          rango: string;
          nota: string | null;
          corte_id: string | null;
          creado_por: string | null;
          cancelado_por: string | null;
          cancelado_en: string | null;
          solicitud_id: string | null;
          created_at: string;
          /** Servicio elegido al reservar (null si no eligió o si se borró). */
          servicio_id: string | null;
          /** Copia del nombre y el precio al reservar: no cambian si editan el servicio. */
          servicio_nombre: string | null;
          servicio_precio: number | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // ─── Servicios y precios (migración 20261029000100) ───
      servicios: {
        Row: {
          id: string;
          barbero_id: string;
          nombre: string;
          descripcion: string | null;
          precio: number;
          activo: boolean;
          orden: number;
          creado_en: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // ─── Servicios sin cliente registrado (migración 20261030000100) ───
      servicios_hechos: {
        Row: {
          id: string;
          barbero_id: string | null;
          servicio_id: string | null;
          servicio_nombre: string;
          monto: number;
          medio_pago: MedioPago;
          nota: string | null;
          fecha: string;
          registrado_por: string | null;
          solicitud_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // ─── Mensualidades (migración 20261030000200) ───
      mensualidades: {
        Row: {
          id: string;
          cliente_id: string;
          /** Quién la cobró. */
          barbero_id: string | null;
          monto: number;
          medio_pago: MedioPago;
          cortes_incluidos: number;
          fecha: string;
          solicitud_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      cortes_mensualidad: {
        Row: {
          id: string;
          mensualidad_id: string;
          cliente_id: string;
          fecha: string;
          registrado_por: string | null;
          solicitud_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      suscripciones_push: {
        Row: {
          id: string;
          barbero_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
          actualizada_en: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // ─── Seguridad (migración 20261025000100) ───
      reseteos_password: {
        Row: { id: string; cliente_id: string; barbero_id: string | null; creado_en: string };
        Insert: { cliente_id: string; barbero_id?: string | null };
        Update: never;
        Relationships: [];
      };
      intentos: {
        Row: { id: number; clave: string; en: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      resumen_clientes: {
        Row: {
          id: string;
          nombre: string;
          telefono: string;
          created_at: string;
          debe_cambiar_password: boolean;
          busqueda: string;
          total_cortes: number;
          ultimo_corte: string | null;
          total_canjes: number;
          cortes_necesarios: number | null;
          descripcion_premio: string | null;
          sellos_actuales: number;
          premios_disponibles: number;
          precio_habitual: number | null;
          etapas: Etapa[] | null;
          premios: PremioEtapa[];
        };
        Relationships: [];
      };
    };
    Functions: {
      es_barbero: { Args: never; Returns: boolean };
      es_dueno: { Args: never; Returns: boolean };
      hoy_ar: { Args: never; Returns: string };
      registrar_corte: {
        Args: {
          p_cliente_id: string;
          p_solicitud_id?: string;
          p_monto?: number | null;
          p_medio_pago?: MedioPago | null;
        };
        Returns: Database["public"]["Tables"]["cortes"]["Row"];
      };
      deshacer_corte: { Args: { p_corte_id: string }; Returns: undefined };
      guardar_foto_descuento: {
        Args: { p_descuento: string; p_tipo: TipoFoto; p_foto: string };
        Returns: string;
      };
      quitar_foto_descuento: { Args: { p_descuento: string }; Returns: undefined };
      canjear_premio: {
        Args: { p_cliente_id: string; p_solicitud_id?: string; p_etapa?: number | null };
        Returns: Database["public"]["Tables"]["canjes"]["Row"];
      };
      guardar_regla: {
        Args: { p_cortes_necesarios: number; p_descripcion_premio: string };
        Returns: Database["public"]["Tables"]["reglas"]["Row"];
      };
      guardar_regla_etapas: {
        Args: { p_etapas: Etapa[] };
        Returns: Database["public"]["Tables"]["reglas"]["Row"];
      };
      guardar_precio_cliente: {
        Args: { p_cliente_id: string; p_precio: number | null };
        Returns: number | null;
      };
      facturacion: {
        Args: { p_desde: string; p_hasta: string };
        Returns: {
          barbero_id: string | null;
          barbero_nombre: string | null;
          es_dueno: boolean;
          cortes: number;
          cortes_sin_monto: number;
          total: number;
          es_admin: boolean;
          /** Servicios sin cliente (no están en `cortes`; sí en `total`). */
          servicios: number;
          efectivo: number;
          transferencia: number;
          /** Mensualidades cobradas (su plata está en `total`). */
          mensualidades: number;
          /** Cortes hechos con mensualidad (no suman plata). */
          cortes_mensuales: number;
        }[];
      };
      movimientos_caja: {
        Args: { p_desde: string; p_hasta: string };
        Returns: {
          tipo: "corte" | "servicio" | "mensualidad" | "mensual";
          id: string;
          fecha: string;
          barbero_id: string | null;
          barbero_nombre: string | null;
          cliente_id: string | null;
          /** En los servicios sin cliente, la aclaración que cargó el barbero. */
          cliente_nombre: string | null;
          servicio_nombre: string | null;
          monto: number | null;
          medio_pago: MedioPago | null;
          registrado_por: string | null;
        }[];
      };
      metricas_panel: {
        Args: never;
        Returns: {
          clientes_total: number;
          clientes_nuevos_mes: number;
          cortes_mes: number;
          cortes_mes_anterior: number;
          canjes_mes: number;
          canjes_total: number;
          premios_pendientes: number;
        }[];
      };
      // ─── Turnos (migración 20261023000200) ───
      horarios_libres: {
        Args: { p_barbero: string };
        Returns: { inicio: string; fin: string }[];
      };
      barberos_turnos: {
        Args: never;
        Returns: { id: string; nombre: string; es_dueno: boolean; proximo_libre: string | null }[];
      };
      reservar_turno: {
        Args: {
          p_barbero: string;
          p_inicio: string;
          p_solicitud_id?: string;
          /** Obligatorio si el barbero tiene servicios activos. */
          p_servicio?: string | null;
        };
        Returns: Database["public"]["Tables"]["turnos"]["Row"];
      };
      cancelar_turno: {
        Args: { p_turno_id: string };
        Returns: Database["public"]["Tables"]["turnos"]["Row"];
      };
      reservar_para_cliente: {
        Args: {
          p_barbero: string;
          p_cliente_id: string;
          p_inicio: string;
          p_solicitud_id?: string;
        };
        Returns: Database["public"]["Tables"]["turnos"]["Row"];
      };
      bloquear_horario: {
        Args: {
          p_barbero: string;
          p_inicio: string;
          p_fin: string;
          p_nota?: string | null;
          p_solicitud_id?: string;
        };
        Returns: Database["public"]["Tables"]["turnos"]["Row"];
      };
      guardar_horario_semanal: {
        Args: { p_barbero: string; p_franjas: Json };
        Returns: undefined;
      };
      guardar_dia_especial: {
        Args: { p_barbero: string; p_fecha: string; p_franjas: Json; p_motivo?: string | null };
        Returns: undefined;
      };
      borrar_dia_especial: { Args: { p_barbero: string; p_fecha: string }; Returns: undefined };
      mi_proximo_turno: {
        Args: never;
        Returns: {
          id: string;
          barbero_id: string;
          barbero_nombre: string;
          inicio: string;
          fin: string;
          puede_cancelar: boolean;
          servicio_nombre: string | null;
          servicio_precio: number | null;
        }[];
      };
      agenda_dia: {
        Args: { p_barbero: string; p_fecha: string };
        Returns: {
          tipo: "libre" | "reserva" | "bloqueo";
          inicio: string;
          fin: string;
          turno_id: string | null;
          estado: "reservado" | "atendido" | null;
          cliente_id: string | null;
          cliente_nombre: string | null;
          cliente_telefono: string | null;
          nota: string | null;
          servicio_nombre: string | null;
          servicio_precio: number | null;
        }[];
      };
      guardar_suscripcion_push: {
        Args: { p_endpoint: string; p_p256dh: string; p_auth: string };
        Returns: undefined;
      };
      borrar_suscripcion_push: { Args: { p_endpoint: string }; Returns: undefined };
      // ─── Servicios (migración 20261029000100) ───
      crear_servicio: {
        Args: {
          p_barbero: string;
          p_nombre: string;
          p_precio: number;
          p_descripcion?: string | null;
        };
        Returns: Database["public"]["Tables"]["servicios"]["Row"];
      };
      editar_servicio: {
        Args: {
          p_servicio: string;
          p_nombre: string;
          p_precio: number;
          p_descripcion?: string | null;
        };
        Returns: Database["public"]["Tables"]["servicios"]["Row"];
      };
      activar_servicio: {
        Args: { p_servicio: string; p_activo: boolean };
        Returns: Database["public"]["Tables"]["servicios"]["Row"];
      };
      borrar_servicio: { Args: { p_servicio: string }; Returns: undefined };
      // ─── Cobros (migración 20261030000100) ───
      registrar_servicio_hecho: {
        Args: {
          p_barbero: string;
          p_monto: number;
          p_medio_pago: MedioPago;
          p_servicio?: string | null;
          p_nombre?: string | null;
          p_nota?: string | null;
          p_solicitud_id?: string;
        };
        Returns: Database["public"]["Tables"]["servicios_hechos"]["Row"];
      };
      deshacer_servicio_hecho: { Args: { p_id: string }; Returns: undefined };
      // ─── Mensualidades (migración 20261030000200) ───
      guardar_precio_mensualidad: {
        Args: { p_barbero: string; p_precio: number | null };
        Returns: number | null;
      };
      estado_mensualidad: {
        Args: { p_cliente: string };
        Returns: {
          activa: boolean;
          mensualidad_id: string | null;
          cortes_incluidos: number | null;
          cortes_usados: number;
          usos: string[];
          desde: string | null;
          precio_barbero: number | null;
        }[];
      };
      cobrar_mensualidad: {
        Args: {
          p_cliente: string;
          p_monto: number;
          p_medio_pago: MedioPago;
          p_solicitud_id?: string;
        };
        Returns: Database["public"]["Tables"]["mensualidades"]["Row"];
      };
      usar_corte_mensualidad: {
        Args: { p_cliente: string; p_solicitud_id?: string };
        Returns: Database["public"]["Tables"]["cortes_mensualidad"]["Row"];
      };
      deshacer_corte_mensualidad: { Args: { p_id: string }; Returns: undefined };
      deshacer_mensualidad: { Args: { p_id: string }; Returns: undefined };
      // ─── Seguridad (migración 20261025000100; solo service_role) ───
      revocar_sesiones: { Args: { p_usuario: string }; Returns: number };
      consumir_intento: {
        Args: { p_clave: string; p_max: number; p_ventana_seg: number };
        Returns: number;
      };
      limpiar_intentos: {
        Args: { p_clave: string; p_solo_ultimo?: boolean };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type Public = Database["public"];
export type Tabla<T extends keyof Public["Tables"]> = Public["Tables"][T]["Row"];
export type Vista<T extends keyof Public["Views"]> = Public["Views"][T]["Row"];

export type Perfil = Tabla<"perfiles">;
export type Corte = Tabla<"cortes">;
export type Canje = Tabla<"canjes">;
export type Regla = Tabla<"reglas">;
export type Descuento = Tabla<"descuentos_asociados">;
export type ResumenCliente = Vista<"resumen_clientes">;
export type Metricas = Public["Functions"]["metricas_panel"]["Returns"][number];
export type FilaFacturacion = Public["Functions"]["facturacion"]["Returns"][number];

// Turnos
export type Turno = Tabla<"turnos">;
export type HorarioSemanal = Tabla<"horarios_semanales">;
export type DiaEspecial = Tabla<"dias_especiales">;
export type FilaAgenda = Public["Functions"]["agenda_dia"]["Returns"][number];
export type BarberoTurnos = Public["Functions"]["barberos_turnos"]["Returns"][number];
export type MiTurno = Public["Functions"]["mi_proximo_turno"]["Returns"][number];
export type Servicio = Tabla<"servicios">;

// Cobros
export type ServicioHecho = Tabla<"servicios_hechos">;
export type MovimientoCaja = Public["Functions"]["movimientos_caja"]["Returns"][number];
