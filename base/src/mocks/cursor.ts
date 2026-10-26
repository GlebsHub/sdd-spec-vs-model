import { BadRequestError } from "./clientsQuery";

type CursorPayload = { offset: number; fingerprint: string };

const toBase64Url = (value: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(value)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const fromBase64Url = (value: string): string => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** Непрозрачный курсор: смещение и отпечаток фильтров, для которых он выдан. */
export const encodeCursor = (payload: CursorPayload): string => toBase64Url(JSON.stringify(payload));

export const decodeCursor = (cursor: string, fingerprint: string): number => {
  let payload: unknown;
  try {
    payload = JSON.parse(fromBase64Url(cursor));
  } catch {
    throw new BadRequestError("Malformed cursor");
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("offset" in payload) ||
    !("fingerprint" in payload) ||
    typeof payload.offset !== "number" ||
    !Number.isInteger(payload.offset) ||
    payload.offset < 0
  ) {
    throw new BadRequestError("Malformed cursor");
  }
  if (payload.fingerprint !== fingerprint) {
    throw new BadRequestError("Cursor was issued for different filters or sort");
  }
  return payload.offset;
};
