import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import { SESSION_COOKIE, isAuthed } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "public", "morbidity.json");

function authed(): boolean {
  return isAuthed(cookies().get(SESSION_COOKIE)?.value);
}

async function readData() {
  const raw = await fs.readFile(FILE, "utf8");
  return JSON.parse(raw);
}

// Текущий набор данных (для редактора).
export async function GET() {
  if (!authed())
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  return NextResponse.json(await readData());
}

// Обновление значений по региону/году/болезни (+ рождаемость).
export async function PUT(req: Request) {
  if (!authed())
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.code || !body.year) {
    return NextResponse.json({ error: "Недостаточно данных" }, { status: 400 });
  }

  const data = await readData();
  const region = data.regions.find((r: { code: string }) => r.code === body.code);
  if (!region) {
    return NextResponse.json({ error: "Регион не найден" }, { status: 404 });
  }

  if (body.disease) {
    region.morbidity[body.year] = region.morbidity[body.year] || {};
    region.morbidity[body.year][body.disease] = {
      per_100000: Number(body.per_100000) || 0,
      absolute_numbers: Number(body.absolute_numbers) || 0,
    };
  }
  if (body.births != null && body.births !== "") {
    region.births[body.year] = Number(body.births) || 0;
  }

  await fs.writeFile(FILE, JSON.stringify(data));
  return NextResponse.json({ ok: true });
}
