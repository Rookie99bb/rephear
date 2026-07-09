import { NextResponse } from "next/server";

// Lightweight health check for deployment platforms (Render, Fly.io, etc.)
// that poll an endpoint to confirm the app booted successfully.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
