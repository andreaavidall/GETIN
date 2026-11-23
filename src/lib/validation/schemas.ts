import { z } from "zod";

/** Esquemas compartidos entre formularios (cliente) y server actions (servidor). */

export const uuid = z.string().uuid("Identificador invalido");

export const emailSchema = z.string().trim().toLowerCase().email("Correo invalido");

/** Teléfono peruano: 9 digitos, o con prefijo +51. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?51)?9\d{8}$/, "Teléfono peruano invalido (9 digitos)")
  .optional()
  .or(z.literal(""));

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(3, "Escribe tu nombre completo").max(80),
    email: emailSchema,
    password: z
      .string()
      .min(10, "Mínimo 10 caracteres")
      .max(72, "Máximo 72 caracteres")
      .regex(/[a-z]/, "Incluye una minuscula")
      .regex(/[A-Z]/, "Incluye una mayuscula")
      .regex(/\d/, "Incluye un número"),
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
      errorMap: () => ({ message: "Debes aceptar los terminos y la política de privacidad" }),
    }),
  })
  .strict();

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe tu contraseña"),
});

export type SignInInput = z.infer<typeof signInSchema>;

/** Selección de entradas del checkout. */
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
  /**
   * De donde vino el enlace (?ref=). Etiqueta corta y saneada: sirve para que
   * el local sepa que canal le funciona, no para seguir a nadie.
   */
  source: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-zA-Z0-9_-]+$/, "Origen inválido")
    .optional(),
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
    minAge: z.coerce.number().int().min(18, "El mínimo legal es 18").max(99),
    musicGenres: z.array(z.string().trim().min(1)).max(6).default([]),
    entryRules: z.string().trim().max(2000).optional().or(z.literal("")),
    cancellationPolicy: z
      .string()
      .trim()
      .min(10, "Describe la política de cancelación: el comprador la ve antes de pagar")
      .max(2000),
    coverUrl: z.string().url("URL inválida").optional().or(z.literal("")),
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
    capacity: z.coerce.number().int().min(1, "El aforo mínimo es 1").max(100000),
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
  address: z.string().trim().min(6, "Dirección demasiado corta").max(200),
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

// ------------------------------------------------- Libro de Reclamaciones ---

/**
 * La norma peruana pide datos concretos, y distinguir queja de reclamo.
 * Si el consumidor es menor de edad, debe figurar su apoderado.
 */
export const complaintSchema = z
  .object({
    kind: z.enum(["reclamo", "queja"]),
    goodType: z.enum(["servicio", "producto"]).default("servicio"),
    fullName: z.string().trim().min(3, "Escribe tu nombre completo").max(120),
    documentType: z.enum(["DNI", "CE", "Pasaporte", "RUC"]).default("DNI"),
    documentNumber: z
      .string()
      .trim()
      .min(6, "Número de documento demasiado corto")
      .max(20)
      .regex(/^[A-Za-z0-9-]+$/, "Solo letras y números"),
    email: emailSchema,
    phone: z.string().trim().max(20).optional().or(z.literal("")),
    address: z.string().trim().max(200).optional().or(z.literal("")),
    isMinor: z.boolean().default(false),
    guardianName: z.string().trim().max(120).optional().or(z.literal("")),
    orderCode: z
      .string()
      .trim()
      .max(20)
      .optional()
      .or(z.literal("")),
    amount: z.coerce.number().min(0).max(1000000).optional(),
    goodDescription: z
      .string()
      .trim()
      .min(5, "Indica qué contrataste (entrada, mesa, lista...)")
      .max(300),
    detail: z.string().trim().min(20, "Cuenta lo ocurrido con un poco más de detalle").max(3000),
    request: z.string().trim().min(10, "Indica qué solución esperas").max(1500),
    acceptPrivacy: z.literal(true, {
      errorMap: () => ({ message: "Debes aceptar el tratamiento de tus datos" }),
    }),
  })
  .refine((d) => !d.isMinor || (d.guardianName ?? "").trim().length > 2, {
    message: "Si eres menor de edad, indica el nombre de tu padre, madre o apoderado",
    path: ["guardianName"],
  });

export type ComplaintInput = z.infer<typeof complaintSchema>;
