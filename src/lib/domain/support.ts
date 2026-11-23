/**
 * Motivos de una solicitud de soporte.
 *
 * Vive fuera del archivo de acciones a proposito: un modulo "use server" solo
 * puede exportar funciones asincronas, y esto es una constante que necesitan
 * tanto el servidor como el formulario.
 *
 * El motivo no es decorativo: "pago pendiente", "no recibi el QR" y "evento
 * cancelado" se resuelven de formas distintas, y pedirlo de entrada ahorra el
 * primer intercambio de mensajes.
 */
export const SUPPORT_REASONS = {
  pago_pendiente: "Pagué y mi orden sigue pendiente",
  qr_no_recibido: "No recibí mi código QR",
  evento_cancelado: "El evento se canceló o cambió",
  no_pude_entrar: "No pude entrar al local",
  cobro_incorrecto: "Me cobraron de más",
  otro: "Otro problema",
} as const;

export type SupportReason = keyof typeof SUPPORT_REASONS;
