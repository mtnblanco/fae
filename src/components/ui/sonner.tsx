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
        success: <CircleCheckIcon className="size-4 text-salvia" />,
        info: <InfoIcon className="size-4 text-bronce" />,
        warning: <TriangleAlertIcon className="size-4 text-bronce" />,
        error: <OctagonXIcon className="size-4 text-tinta-clara" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--nogal-claro)",
          "--normal-text": "var(--marfil)",
          "--normal-border": "var(--cuero)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "cn-toast font-sans shadow-elevada" } }}
      {...props}
    />
  );
};

export { Toaster };
