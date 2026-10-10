"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

/** Muestra el toast de "cliente eliminado" después del redirect y limpia la URL. */
export function AvisoEliminado() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (params.get("eliminado") === "1") {
      toast.success("Cliente eliminado", { id: "cliente-eliminado" });
      const nuevos = new URLSearchParams(params);
      nuevos.delete("eliminado");
      const s = nuevos.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    }
  }, [params, router, pathname]);

  return null;
}
