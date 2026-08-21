// app/api/debug/db/route.ts
import { NextResponse } from "next/server";

function redact(url: string) {
  try {
    const u = new URL(url);
    // Hide password but keep host/port/db so we can debug.
    u.password = "REDACTED";
    return {
      host: u.hostname,
      port: u.port || "(default)",
      db: u.pathname,
      user: u.username,
      params: Object.fromEntries(u.searchParams.entries()),
      fullRedacted: u.toString(),
    };
  } catch {
    return { error: "Invalid URL string" };
  }
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const DATABASE_URL = process.env.DATABASE_URL || "";
  const DIRECT_URL = process.env.DIRECT_URL || "";

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDirectUrl: !!process.env.DIRECT_URL,
    databaseUrl: DATABASE_URL ? redact(DATABASE_URL) : null,
    directUrl: DIRECT_URL ? redact(DIRECT_URL) : null,
  });
}