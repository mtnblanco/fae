"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

/** Toast de bienvenida después del primer cambio de contraseña. */
export function Bienvenida({ nombre }: { nombre: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (params.get("bienvenida") === "1") {
      toast.success(`¡Listo, ${nombre}!`, {
        description: "Tu contraseña quedó guardada. Este es tu carnet.",
        id: "bienvenida",
      });
      router.replace(pathname, { scroll: false });
    }
  }, [params, router, pathname, nombre]);

  return null;
}
