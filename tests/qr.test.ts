import { describe, expect, it } from "vitest";

import {
  createQrCredential,
  hashToken,
  newNonce,
  QR_VERSION,
  rebuildQrToken,
  verifyQrToken,
} from "@/lib/domain/qr";

/**
 * Credenciales QR.
 *
 * Lo que se prueba aqui es lo que impide que alguien se fabrique una entrada:
 * sin el secreto no se puede producir un token que pase la verificacion.
 */

const SECRET = "secreto-de-pruebas-con-longitud-suficiente";
const OTHER_SECRET = "otro-secreto-completamente-distinto-1234";
const TICKET_ID = "7f1e2d3c-4b5a-4c6d-8e9f-0a1b2c3d4e5f";

describe("createQrCredential", () => {
  it("produce un token verificable con los datos correctos", () => {
    const cred = createQrCredential("ticket", TICKET_ID, SECRET);
    const result = verifyQrToken(cred.token, SECRET);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.kind).toBe("ticket");
    expect(result.id).toBe(TICKET_ID);
    expect(result.nonce).toBe(cred.nonce);
    expect(result.tokenHash).toBe(cred.tokenHash);
  });

  it("el token empieza por la version y no contiene datos personales", () => {
    const cred = createQrCredential("ticket", TICKET_ID, SECRET);
    expect(cred.token.startsWith(`${QR_VERSION}.`)).toBe(true);
    // Solo version, sujeto, nonce y firma: nada mas viaja en el QR.
    expect(cred.token.split(".")).toHaveLength(4);
  });

  it("dos credenciales del mismo objeto son distintas (nonce aleatorio)", () => {
    const a = createQrCredential("ticket", TICKET_ID, SECRET);
    const b = createQrCredential("ticket", TICKET_ID, SECRET);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("guarda el hash del token, no el token", () => {
    const cred = createQrCredential("ticket", TICKET_ID, SECRET);
    expect(cred.tokenHash).toBe(hashToken(cred.token));
    expect(cred.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(cred.tokenPrefix).toBe(cred.tokenHash.slice(0, 8));
  });

  it("exige un secreto configurado", () => {
    expect(() => createQrCredential("ticket", TICKET_ID, "")).toThrow(/QR_TOKEN_SECRET/);
    expect(() => createQrCredential("ticket", TICKET_ID, "corto")).toThrow(/QR_TOKEN_SECRET/);
  });

  it("distingue entradas, reservas y listas", () => {
    for (const kind of ["ticket", "reservation", "guest_entry"] as const) {
      const cred = createQrCredential(kind, TICKET_ID, SECRET);
      const result = verifyQrToken(cred.token, SECRET);
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.kind).toBe(kind);
    }
  });
});

describe("verifyQrToken", () => {
  it("rechaza un token firmado con otro secreto", () => {
    const cred = createQrCredential("ticket", TICKET_ID, OTHER_SECRET);
    const result = verifyQrToken(cred.token, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("signature");
  });

  it("rechaza un token con el identificador manipulado", () => {
    const cred = createQrCredential("ticket", TICKET_ID, SECRET);
    const [version, , nonce, signature] = cred.token.split(".");
    const forged = `${version}.t:00000000-0000-4000-8000-000000000000.${nonce}.${signature}`;

    const result = verifyQrToken(forged, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("signature");
  });

  it("rechaza un token con el nonce manipulado", () => {
    const cred = createQrCredential("ticket", TICKET_ID, SECRET);
    const parts = cred.token.split(".");
    const forged = [parts[0], parts[1], newNonce(), parts[3]].join(".");
    expect(verifyQrToken(forged, SECRET).valid).toBe(false);
  });

  it("rechaza firmas truncadas o alargadas", () => {
    const cred = createQrCredential("ticket", TICKET_ID, SECRET);
    const parts = cred.token.split(".");
    const short = [parts[0], parts[1], parts[2], (parts[3] ?? "").slice(0, 10)].join(".");
    const long = [parts[0], parts[1], parts[2], `${parts[3]}AAAA`].join(".");

    expect(verifyQrToken(short, SECRET).valid).toBe(false);
    expect(verifyQrToken(long, SECRET).valid).toBe(false);
  });

  it("rechaza formatos que no son tokens GETIN", () => {
    const cases = [
      "",
      "hola",
      "GETIN1.t:abc",
      "GETIN1.t:abc.nonce",
      "GETIN1.x:abc.nonce.firma",
      "GETIN0.t:abc.nonce.firma",
      "https://getin.pe/entrada/123",
      '{"ticket":"123"}',
    ];
    for (const token of cases) {
      expect(verifyQrToken(token, SECRET).valid).toBe(false);
    }
  });

  it("rechaza una version desconocida", () => {
    const cred = createQrCredential("ticket", TICKET_ID, SECRET);
    const forged = cred.token.replace(QR_VERSION, "GETIN9");
    const result = verifyQrToken(forged, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("version");
  });

  it("tolera espacios alrededor (entrada manual en la puerta)", () => {
    const cred = createQrCredential("ticket", TICKET_ID, SECRET);
    expect(verifyQrToken(`  ${cred.token}  `, SECRET).valid).toBe(true);
  });
});

describe("rebuildQrToken", () => {
  it("reconstruye el mismo token a partir del nonce guardado", () => {
    const cred = createQrCredential("ticket", TICKET_ID, SECRET);
    const rebuilt = rebuildQrToken("ticket", TICKET_ID, cred.nonce, SECRET);

    expect(rebuilt).toBe(cred.token);
    expect(hashToken(rebuilt)).toBe(cred.tokenHash);
  });

  it("con el nonce pero sin el secreto no se puede reconstruir", () => {
    // Simula a quien lee la tabla qr_credentials sin tener el secreto del servidor.
    const cred = createQrCredential("ticket", TICKET_ID, SECRET);
    const attempt = rebuildQrToken("ticket", TICKET_ID, cred.nonce, OTHER_SECRET);

    expect(attempt).not.toBe(cred.token);
    expect(verifyQrToken(attempt, SECRET).valid).toBe(false);
  });

  it("el nonce de una entrada no sirve para otra", () => {
    const cred = createQrCredential("ticket", TICKET_ID, SECRET);
    const otherTicket = rebuildQrToken(
      "ticket",
      "00000000-0000-4000-8000-000000000001",
      cred.nonce,
      SECRET,
    );
    expect(hashToken(otherTicket)).not.toBe(cred.tokenHash);
  });
});
