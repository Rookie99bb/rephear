import { headers } from "next/headers";

// Best-effort request metadata for Audit Log entries. Server Actions don't
// receive the Request object directly, but next/headers exposes the
// incoming headers of the request that triggered them.
export function getRequestContext(): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  try {
    const h = headers();
    const forwardedFor = h.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
    const userAgent = h.get("user-agent");
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}
