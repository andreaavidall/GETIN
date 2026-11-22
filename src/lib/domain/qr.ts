import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Credenciales QR.
 *
 * Formato del contenido del QR:
 *
 *     GETIN1.<subject>.<nonce>.<hmac>
 *
 *  - `subject`  tipo + id del objeto validado: "t:<uuid>" entrada,
 *               "r:<uuid>" reserva de mesa, "g:<uuid>" lista de invitados.
 *  - `nonce`    128 bits aleatorios (base64url). Se guarda en la base.
 *  - `hmac`     HMAC-SHA256 de "GETIN1.<subject>.<nonce>" con QR_TOKEN_SECRET,
 *               truncado a 160 bits. El secreto solo existe en el servidor.
 *
 * Consecuencias buscadas:
 *  - El QR no contiene ningún dato personal: ni nombre, ni correo, ni DNI.
 *  - Quien lea la tabla `qr_credentials` no puede fabricar un QR valido, porque
 *    no tiene el secreto; y no puede adivinarlo, porque el nonce es aleatorio.
 *  - El servidor puede volver a dibujar el QR del usuario cuantas veces quiera
 *    a partir del nonce guardado (sin almacenar el token completo).
 *  - La validación es local (HMAC) antes de tocar la base: un QR falsificado no
 *    llega a generar consulta.
 */

export const QR_VERSION = "GETIN1";

export type QrSubjectKind = "ticket" | "reservation" | "guest_entry";

const KIND_PREFIX: Record<QrSubjectKind, string> = {
  ticket: "t",
  reservation: "r",
  guest_entry: "g",
};

const PREFIX_KIND: Record<string, QrSubjectKind> = {
  t: "ticket",
  r: "reservation",
  g: "guest_entry",
};

export type QrCredential = {
  /** Contenido exacto que se codifica en el QR. */
  token: string;
  nonce: string;
  /** sha256(token) en hex: es la clave de busqueda en la base. */
  tokenHash: string;
  /** Primeros 8 caracteres del hash, para soporte. No autentica nada. */
  tokenPrefix: string;
};

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payload).digest().subarray(0, 20));
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newNonce(): string {
  return b64url(randomBytes(16));
}

/** Crea una credencial nueva para un objeto concreto. */
export function createQrCredential(
  kind: QrSubjectKind,
  id: string,
  secret: string,
  nonce: string = newNonce(),
): QrCredential {
  if (!secret || secret.length < 8) {
    throw new Error("QR_TOKEN_SECRET no configurado");
  }
  const subject = `${KIND_PREFIX[kind]}:${id}`;
  const payload = `${QR_VERSION}.${subject}.${nonce}`;
  const token = `${payload}.${sign(payload, secret)}`;
  const tokenHash = hashToken(token);
  return { token, nonce, tokenHash, tokenPrefix: tokenHash.slice(0, 8) };
}

/** Reconstruye el token a partir del nonce guardado (para volver a mostrar el QR). */
export function rebuildQrToken(
  kind: QrSubjectKind,
  id: string,
  nonce: string,
  secret: string,
): string {
  return createQrCredential(kind, id, secret, nonce).token;
}

export type QrVerification =
  | { valid: true; kind: QrSubjectKind; id: string; nonce: string; tokenHash: string }
  | { valid: false; error: "format" | "version" | "signature" };

/**
 * Verifica la firma de un QR escaneado. No consulta la base de datos: solo
 * responde si el token pudo haber sido emitido por este servidor.
 */
export function verifyQrToken(token: string, secret: string): QrVerification {
  const parts = token.trim().split(".");
  if (parts.length !== 4) return { valid: false, error: "format" };

  const [version, subject, nonce, signature] = parts as [string, string, string, string];
  if (version !== QR_VERSION) return { valid: false, error: "version" };

  const [prefix, id] = subject.split(":");
  const kind = prefix ? PREFIX_KIND[prefix] : undefined;
  if (!kind || !id || !nonce) return { valid: false, error: "format" };

  const expected = sign(`${version}.${subject}.${nonce}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // Comparacion en tiempo constante; longitudes distintas = invalido.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, error: "signature" };
  }

  return { valid: true, kind, id, nonce, tokenHash: hashToken(token.trim()) };
}
