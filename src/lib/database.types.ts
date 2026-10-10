/**
 * Tipos de la base de datos, con el mismo formato que genera
 * `supabase gen types typescript`. Si cambiás las migraciones, regeneralos:
 *
 *   npx supabase gen types typescript --project-id TU_PROYECTO > src/lib/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Relacion<Nombre extends string, Columna extends string, Tabla extends string> = {
  foreignKeyName: Nombre;
  columns: [Columna];
  isOneToOne: false;
  referencedRelation: Tabla;
  referencedColumns: ["id"];
};

export type Rol = "barbero" | "cliente";

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
        };
        Insert: {
          id: string;
          nombre: string;
          telefono?: string | null;
          rol?: Rol;
          debe_cambiar_password?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          telefono?: string | null;
          rol?: Rol;
          debe_cambiar_password?: boolean;
          created_at?: string;
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
        };
        Insert: {
          id?: string;
          cliente_id: string;
          fecha?: string;
          registrado_por?: string | null;
          solicitud_id?: string | null;
        };
        Update: {
          id?: string;
          cliente_id?: string;
          fecha?: string;
          registrado_por?: string | null;
          solicitud_id?: string | null;
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
        };
        Insert: {
          id?: string;
          cliente_id: string;
          fecha?: string;
          registrado_por?: string | null;
          premio_descripcion: string;
          solicitud_id?: string | null;
        };
        Update: {
          id?: string;
          cliente_id?: string;
          fecha?: string;
          registrado_por?: string | null;
          premio_descripcion?: string;
          solicitud_id?: string | null;
        };
        Relationships: [
          Relacion<"canjes_cliente_id_fkey", "cliente_id", "perfiles">,
          Relacion<"canjes_registrado_por_fkey", "registrado_por", "perfiles">,
        ];
      };
      reglas: {
        Row: {
          id: string;
          cortes_necesarios: number;
          descripcion_premio: string;
          activa: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          cortes_necesarios: number;
          descripcion_premio: string;
          activa?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          cortes_necesarios?: number;
          descripcion_premio?: string;
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
        };
        Relationships: [];
      };
    };
    Functions: {
      es_barbero: { Args: never; Returns: boolean };
      hoy_ar: { Args: never; Returns: string };
      registrar_corte: {
        Args: { p_cliente_id: string; p_solicitud_id?: string };
        Returns: Database["public"]["Tables"]["cortes"]["Row"];
      };
      deshacer_corte: { Args: { p_corte_id: string }; Returns: undefined };
      canjear_premio: {
        Args: { p_cliente_id: string; p_solicitud_id?: string };
        Returns: Database["public"]["Tables"]["canjes"]["Row"];
      };
      guardar_regla: {
        Args: { p_cortes_necesarios: number; p_descripcion_premio: string };
        Returns: Database["public"]["Tables"]["reglas"]["Row"];
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
