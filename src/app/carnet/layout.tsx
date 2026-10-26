import type { Metadata } from "next";
import { MarcoCliente } from "@/components/carnet/marco-cliente";
import { requireCliente } from "@/lib/auth";

export const metadata: Metadata = { title: "Mi carnet", robots: { index: false, follow: false } };

export default async function LayoutCarnet({ children }: LayoutProps<"/carnet">) {
  const { perfil } = await requireCliente();
  return <MarcoCliente nombre={perfil.nombre}>{children}</MarcoCliente>;
}
