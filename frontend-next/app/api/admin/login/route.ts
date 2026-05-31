import { NextResponse } from "next/server";
import { credentials, sessionToken, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { username, password } = body as {
    username?: string;
    password?: string;
  };
  const c = credentials();

  if (username === c.user && password === c.pass) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionToken(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 часов
    });
    return res;
  }
  return NextResponse.json(
    { error: "Неверный логин или пароль" },
    { status: 401 }
  );
}
