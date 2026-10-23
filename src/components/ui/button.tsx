import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-[0.9375rem] font-semibold whitespace-nowrap transition-[color,background-color,border-color,opacity,translate] duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Oro: la acción de todos los días.
        default:
          "bg-primary text-primary-foreground shadow-suave hover:bg-oro-claro active:bg-oro-claro",
        // Neón: LA acción principal de la pantalla (una sola por pantalla).
        // El brillo es estático: no se transiciona box-shadow.
        neon: "bg-neon text-sobre-neon shadow-neon hover:bg-[#ffe766] active:shadow-neon-suave",
        // Contorno oro: secundaria con nombre propio ("Canjear premio", "Ingresar").
        oro: "border-oro/60 bg-transparent text-oro-claro hover:bg-oro/10 aria-expanded:bg-oro/10",
        // Contorno neutro: navegación y acciones de apoyo.
        outline:
          "border-hierro-claro bg-transparent text-marfil hover:border-oro/60 hover:bg-ebano-claro aria-expanded:bg-ebano-claro",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-ebano-alto aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-ebano-claro hover:text-foreground aria-expanded:bg-ebano-claro aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-oro underline-offset-4 hover:text-oro-claro hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-8 gap-1 rounded-md px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-md px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 px-5 text-base [&_svg:not([class*='size-'])]:size-5",
        xl: "h-14 gap-2.5 rounded-xl px-6 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11",
        "icon-xs": "size-8 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 rounded-md",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
