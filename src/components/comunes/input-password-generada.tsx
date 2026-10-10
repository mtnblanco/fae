"use client";

import { RefreshCw } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generarPassword } from "@/lib/password";

type Props = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue"> & { inicial: string };

/**
 * Contraseña visible (el barbero tiene que poder leerla para pasarla) con un
 * botón para generar una nueva.
 */
export function InputPasswordGenerada({ inicial, ...props }: Props) {
  const [valor, setValor] = useState(inicial);
  return (
    <div className="flex gap-2">
      <Input
        type="text"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="font-mono tracking-[0.08em]"
        {...props}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => setValor(generarPassword())}
        className="shrink-0"
      >
        <RefreshCw aria-hidden />
        Generar
      </Button>
    </div>
  );
}
