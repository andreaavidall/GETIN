import { z } from "zod";

/**
 * Validación de variables de entorno.
 *
 * - `publicEnv` se puede leer en el navegador (solo NEXT_PUBLIC_*).
 * - `serverEnv()` se lee unicamente en el servidor; si se importa desde un
 *   componente de cliente, Next falla en el build gracias a "server-only".
 *
 * Nada se válida de forma estricta al arrancar para que el proyecto pueda
 * ejecutarse en modo demo sin Supabase; cada funcion avisa de lo que falta.
 */

const publicSchema = z.object({
  // Vacias si el proyecto corre en modo demo: se comprueba con
  // isSupabaseConfigured() en lugar de reventar al arrancar.
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .default("")
    .refine((v) => v === "" || /^https?:\/\//.test(v), "NEXT_PUBLIC_SUPABASE_URL debe ser una URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .default("")
    .refine((v) => v === "" || v.length >= 20, "NEXT_PUBLIC_SUPABASE_ANON_KEY parece incompleta"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_DATA_MODE: z.enum(["demo", "live"]).default("demo"),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  NEXT_PUBLIC_DATA_MODE: process.env.NEXT_PUBLIC_DATA_MODE ?? "demo",
});

/** ¿Hay credenciales de Supabase para hablar con la base de datos real? */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Modo de datos efectivo.
 * `demo` = catalogo ficticio en memoria, sin compras reales.
 * `live` = Supabase configurado; las compras usan el proveedor de pagos elegido.
 */
export function dataMode(): "demo" | "live" {
  if (publicEnv.NEXT_PUBLIC_DATA_MODE === "live" && isSupabaseConfigured()) return "live";
  return "demo";
}

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  PAYMENTS_PROVIDER: z.enum(["test", "culqi"]).default("test"),
  PAYMENTS_TEST_WEBHOOK_SECRET: z.string().default("getin-dev-webhook-secret"),
  CULQI_PUBLIC_KEY: z.string().optional().default(""),
  CULQI_SECRET_KEY: z.string().optional().default(""),
  CULQI_WEBHOOK_SECRET: z.string().optional().default(""),
  GETIN_DEFAULT_COMMISSION_BPS: z.coerce.number().int().min(0).max(10000).default(700),
  QR_TOKEN_SECRET: z.string().default("getin-dev-qr-secret-change-me"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  cached = serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PAYMENTS_PROVIDER: process.env.PAYMENTS_PROVIDER,
    PAYMENTS_TEST_WEBHOOK_SECRET: process.env.PAYMENTS_TEST_WEBHOOK_SECRET,
    CULQI_PUBLIC_KEY: process.env.CULQI_PUBLIC_KEY,
    CULQI_SECRET_KEY: process.env.CULQI_SECRET_KEY,
    CULQI_WEBHOOK_SECRET: process.env.CULQI_WEBHOOK_SECRET,
    GETIN_DEFAULT_COMMISSION_BPS: process.env.GETIN_DEFAULT_COMMISSION_BPS,
    QR_TOKEN_SECRET: process.env.QR_TOKEN_SECRET,
  });
  return cached;
}
