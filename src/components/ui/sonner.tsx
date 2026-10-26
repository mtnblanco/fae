"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Márgenes de sonner (24px; 16px en celulares) más las áreas seguras del iPhone:
// en la app instalada el toast no queda debajo de la isla ni del indicador de inicio.
const conAreaSegura = (px: number) => ({
  top: `calc(${px}px + env(safe-area-inset-top))`,
  bottom: `calc(${px}px + env(safe-area-inset-bottom))`,
  left: `max(${px}px, env(safe-area-inset-left))`,
  right: `max(${px}px, env(safe-area-inset-right))`,
});

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      offset={conAreaSegura(24)}
      mobileOffset={conAreaSegura(16)}
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-exito" />,
        info: <InfoIcon className="size-4 text-oro" />,
        warning: <TriangleAlertIcon className="size-4 text-oro" />,
        error: <OctagonXIcon className="size-4 text-error" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--ebano-claro)",
          "--normal-text": "var(--marfil)",
          "--normal-border": "var(--hierro)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "cn-toast font-sans shadow-elevada" } }}
      {...props}
    />
  );
};

export { Toaster };
