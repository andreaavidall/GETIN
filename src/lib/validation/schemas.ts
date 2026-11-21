import { z } from "zod";

/** Esquemas compartidos entre formularios (cliente) y server actions (servidor). */

export const uuid = z.string().uuid("Identificador invalido");

export const emailSchema = z.string().trim().toLowerCase().email("Correo invalido");

/** Telefono peruano: 9 digitos, o con prefijo +51. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?51)?9\d{8}$/, "Telefono peruano invalido (9 digitos)")
  .optional()
  .or(z.literal(""));

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(3, "Escribe tu nombre completo").max(80),
    email: emailSchema,
    password: z
      .string()
      .min(10, "Minimo 10 caracteres")
      .max(72, "Maximo 72 caracteres")
      .regex(/[a-z]/, "Incluye una minuscula")
      .regex(/[A-Z]/, "Incluye una mayuscula")
      .regex(/\d/, "Incluye un numero"),
    phone: phoneSchema,
    birthdate: z
      .string()
      .refine((value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return false;
        const adult = new Date();
        adult.setFullYear(adult.getFullYear() - 18);
        return date <= adult;
      }, "Debes ser mayor de 18 años para usar GETIN"),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Debes aceptar los terminos y la politica de privacidad" }),
    }),
  })
  .strict();

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe tu contraseña"),
});

export type SignInInput = z.infer<typeof signInSchema>;

/** Seleccion de entradas del checkout. */
export const cartSchema = z.object({
  eventId: uuid,
  tickets: z
    .array(
      z.object({
        ticketTypeId: uuid,
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .default([]),
  tableAvailabilityId: uuid.optional(),
});

export type CartInput = z.infer<typeof cartSchema>;

export const guestListJoinSchema = z.object({
  guestListId: uuid,
  guestName: z.string().trim().min(3, "Escribe el nombre con el que entras").max(80),
  companions: z.number().int().min(0).max(20).default(0),
  acceptConditions: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar las condiciones de la lista" }),
  }),
});

export const scanSchema = z.object({
  token: z.string().trim().min(10).max(400),
  venueId: uuid,
  device: z.string().trim().max(60).optional(),
});

// ------------------------------------------------------- panel de discoteca ---

export const eventFormSchema = z
  .object({
    name: z.string().trim().min(3, "Nombre demasiado corto").max(120),
    tagline: z.string().trim().max(160).optional().or(z.literal("")),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
    startsAt: z.string().min(1, "Indica la fecha y hora de inicio"),
    endsAt: z.string().optional().or(z.literal("")),
    lastEntryAt: z.string().optional().or(z.literal("")),
    minAge: z.coerce.number().int().min(18, "El minimo legal es 18").max(99),
    musicGenres: z.array(z.string().trim().min(1)).max(6).default([]),
    entryRules: z.string().trim().max(2000).optional().or(z.literal("")),
    cancellationPolicy: z
      .string()
      .trim()
      .min(10, "Describe la politica de cancelacion: el comprador la ve antes de pagar")
      .max(2000),
    coverUrl: z.string().url("URL invalida").optional().or(z.literal("")),
  })
  .refine(
    (data) => !data.endsAt || new Date(data.endsAt) > new Date(data.startsAt),
    { message: "El fin debe ser posterior al inicio", path: ["endsAt"] },
  );

export type EventFormInput = z.infer<typeof eventFormSchema>;

export const ticketTypeFormSchema = z
  .object({
    name: z.string().trim().min(2, "Nombre demasiado corto").max(60),
    description: z.string().trim().max(300).optional().or(z.literal("")),
    /** Precio en soles; se convierte a centimos en el servidor. */
    price: z.coerce.number().min(0, "El precio no puede ser negativo").max(100000),
    capacity: z.coerce.number().int().min(1, "El aforo minimo es 1").max(100000),
    maxPerOrder: z.coerce.number().int().min(1).max(50).default(6),
    salesStartAt: z.string().optional().or(z.literal("")),
    salesEndAt: z.string().optional().or(z.literal("")),
    conditions: z.string().trim().max(500).optional().or(z.literal("")),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => !data.salesEndAt || !data.salesStartAt || new Date(data.salesEndAt) > new Date(data.salesStartAt),
    { message: "El cierre de venta debe ser posterior al inicio", path: ["salesEndAt"] },
  );

export type TicketTypeFormInput = z.infer<typeof ticketTypeFormSchema>;

export const venueApplicationSchema = z.object({
  name: z.string().trim().min(3).max(120),
  legalName: z.string().trim().min(3, "Razon social requerida").max(160),
  taxId: z.string().trim().regex(/^(10|15|17|20)\d{9}$/, "RUC invalido (11 digitos)"),
  district: z.string().trim().min(3).max(60),
  address: z.string().trim().min(6, "Direccion demasiado corta").max(200),
  phone: z.string().trim().min(6).max(20),
  email: emailSchema,
  capacity: z.coerce.number().int().min(10).max(20000),
  minAge: z.coerce.number().int().min(18).max(99).default(18),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  musicGenres: z.array(z.string()).max(6).default([]),
});

export type VenueApplicationInput = z.infer<typeof venueApplicationSchema>;

export const refundRequestSchema = z.object({
  orderId: uuid,
  reason: z.string().trim().min(15, "Explica el motivo con un poco mas de detalle").max(1000),
});
