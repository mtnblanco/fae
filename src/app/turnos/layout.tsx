import type { Metadata } from "next";
import { MarcoCliente } from "@/components/carnet/marco-cliente";
import { requireCliente } from "@/lib/auth";

export const metadata: Metadata = { title: "Sacá turno", robots: { index: false, follow: false } };

export default async function LayoutTurnos({ children }: LayoutProps<"/turnos">) {
  const { perfil } = await requireCliente();
  return <MarcoCliente nombre={perfil.nombre}>{children}</MarcoCliente>;
}
