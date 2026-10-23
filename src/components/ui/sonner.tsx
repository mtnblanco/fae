"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
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
