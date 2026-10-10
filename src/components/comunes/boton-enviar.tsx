"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = ComponentProps<typeof Button> & { textoCargando?: ReactNode };

/** Botón de submit que se deshabilita y muestra un spinner mientras se envía. */
export function BotonEnviar({ children, textoCargando, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {textoCargando ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
