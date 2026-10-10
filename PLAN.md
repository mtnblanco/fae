# Plan de trabajo

Web de fidelización para una barbería. Se tacha cada tarea al terminarla y verificarla.

## Fase 1 — Setup

- [x] Next.js 16 (App Router) + TypeScript estricto + Tailwind 4
- [x] shadcn/ui (Radix), lucide-react, framer-motion, zod, qrcode, escáner de QR
- [x] Supabase (`@supabase/ssr`, `@supabase/supabase-js`) + `server-only`
- [x] `.env.example`, estructura de carpetas, ESLint, Prettier, Vitest
- [x] Verificación: `tsc`, `lint` y `build` sin errores

## Fase 2 — Base de datos

- [x] Migración: tablas `perfiles`, `cortes`, `canjes`, `reglas`, `descuentos_asociados`
- [x] Índices (FKs, búsqueda con `pg_trgm`) y constraints
- [x] `es_barbero()` (security definer, `search_path` fijo)
- [x] RLS en todas las tablas + policies
- [x] Vista `resumen_clientes` (`security_invoker`) con cortes, sellos y premios disponibles
- [x] Funciones atómicas: `registrar_corte`, `deshacer_corte`, `canjear_premio`, `guardar_regla`, `metricas_panel`
- [x] Realtime para `cortes` y `canjes` (el carnet se actualiza solo)
- [x] `seed.sql` con datos realistas + SQL para crear el primer barbero
- [x] Tests de RLS y de funciones con PGlite (sin Docker)

## Fase 3 — Auth

- [x] Normalización de teléfono + email interno
- [x] Login con teléfono (y email para el barbero) por Server Action
- [x] Cambio obligatorio de contraseña (`/cambiar-password`)
- [x] `proxy.ts`: refresco de sesión, protección de rutas y redirección por rol
- [x] Guards en el servidor (`requireBarbero`, `requireCliente`) además del proxy
- [x] Mensajes de error genéricos

## Fase 4 — Sistema de diseño y layouts

- [x] Tokens (color, tipografía, espaciado, radios, sombras) en `globals.css`
- [x] Ajuste de componentes base (tamaños táctiles, foco visible)
- [x] Componentes compartidos: logo, empty state, page header, credenciales, confirmación
- [x] Layout del panel (bottom nav mobile + sidebar desktop) y del cliente
- [x] Toasts (sonner)

## Fase 5 — Panel del barbero

- [x] Dashboard con métricas y accesos rápidos
- [x] Lista de clientes: búsqueda, filtros y paginación
- [x] Alta de cliente con generador de contraseña + tarjeta de credenciales (copiar / WhatsApp)
- [x] Detalle: datos, historial, sumar corte, canjear premio, deshacer (10 min)
- [x] Editar datos, resetear contraseña, eliminar cliente

## Fase 6 — Carnet del cliente

- [x] Tarjeta de lujo con textura, QR y sellos
- [x] Animación de "estampado" y celebración al completar premio
- [x] Premios, descuentos asociados, historial
- [x] Actualización en vivo (Realtime) al sumar un corte
- [x] Cambio de contraseña voluntario

## Fase 7 — Escáner, descuentos y reglas

- [x] `/panel/escanear` con cámara, confirmación y búsqueda manual de respaldo
- [x] `/panel/descuentos`: alta, edición, baja y activación
- [x] `/panel/reglas`: configuración de la regla activa con historial

## Fase 8 — PWA, SEO y errores

- [x] `manifest`, íconos, `apple-icon`, theme color
- [x] Metadatos, Open Graph, favicon, `robots`
- [x] Páginas 404 y de error

## Fase 9 — Revisión final

- [x] Seguridad (service role, RLS, validaciones, rutas)
- [x] Accesibilidad (contraste, foco, labels, teclado)
- [x] Responsive (360px) y consistencia visual
- [x] Rendimiento (bundle del cliente, imports dinámicos)
- [x] `build`, `lint`, `typecheck` y tests en verde

## Fase 10 — README

- [x] Guía paso a paso para alguien no experto
