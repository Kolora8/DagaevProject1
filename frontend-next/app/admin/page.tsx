"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Dataset } from "@/lib/dataset";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<Dataset | null>(null);

  // форма логина
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // редактор
  const [code, setCode] = useState("");
  const [year, setYear] = useState("");
  const [disease, setDisease] = useState("");
  const [per100k, setPer100k] = useState("");
  const [absolute, setAbsolute] = useState("");
  const [births, setBirths] = useState("");
  const [msg, setMsg] = useState("");

  const loadData = useCallback(async () => {
    const res = await fetch("/api/admin/data", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const d: Dataset = await res.json();
    setData(d);
    setAuthed(true);
    setCode((c) => c || d.regions[0]?.code || "");
    setYear((y) => y || d.meta.years[d.meta.years.length - 1] || "");
    setDisease((x) => x || d.meta.diseases[0]?.key || "");
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // при смене региона/года/болезни — подставляем текущие значения
  useEffect(() => {
    if (!data || !code || !year) return;
    const r = data.regions.find((x) => x.code === code);
    if (!r) return;
    const m = disease ? r.morbidity[year]?.[disease] : undefined;
    setPer100k(m ? String(m.per_100000) : "");
    setAbsolute(m ? String(m.absolute_numbers) : "");
    setBirths(r.births[year] != null ? String(r.births[year]) : "");
  }, [data, code, year, disease]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      setUsername("");
      setPassword("");
      await loadData();
    } else {
      const j = await res.json().catch(() => ({}));
      setLoginError(j.error || "Ошибка входа");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setData(null);
  }

  async function save() {
    setMsg("");
    const res = await fetch("/api/admin/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        year,
        disease,
        per_100000: per100k,
        absolute_numbers: absolute,
        births,
      }),
    });
    if (res.ok) {
      setMsg("Сохранено ✓");
      await loadData();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || "Ошибка сохранения");
    }
  }

  if (authed === null) {
    return <div className="admin-wrap">Загрузка…</div>;
  }

  if (!authed) {
    return (
      <div className="admin-center">
        <form className="login-card" onSubmit={doLogin}>
          <h1>Админ-панель</h1>
          <p className="sub">ЗдравМонитор · вход</p>
          <input
            placeholder="Логин"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {loginError && <div className="login-err">{loginError}</div>}
          <button type="submit">Войти</button>
          <Link href="/" className="back-link">
            ← на карту
          </Link>
        </form>
      </div>
    );
  }

  const region = data?.regions.find((x) => x.code === code);

  return (
    <div className="admin-wrap">
      <header className="admin-head">
        <div>
          <h1>Админ-панель</h1>
          <div className="sub">Редактирование данных заболеваемости</div>
        </div>
        <div className="admin-actions">
          <Link href="/" className="back-link">
            Открыть карту
          </Link>
          <button className="ghost" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      <div className="admin-card">
        <div className="form-grid">
          <label>
            Регион
            <select value={code} onChange={(e) => setCode(e.target.value)}>
              {data?.regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Год
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {data?.meta.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label>
            Болезнь
            <select
              value={disease}
              onChange={(e) => setDisease(e.target.value)}
            >
              {data?.meta.diseases.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label>
            На 100 тыс.
            <input
              type="number"
              step="0.1"
              value={per100k}
              onChange={(e) => setPer100k(e.target.value)}
            />
          </label>
          <label>
            Абсолютное число
            <input
              type="number"
              value={absolute}
              onChange={(e) => setAbsolute(e.target.value)}
            />
          </label>
          <label>
            Родившихся ({year})
            <input
              type="number"
              value={births}
              onChange={(e) => setBirths(e.target.value)}
            />
          </label>
        </div>

        <div className="save-row">
          <button onClick={save}>Сохранить</button>
          {msg && <span className="save-msg">{msg}</span>}
        </div>

        {region && (
          <div className="hint">
            Текущая запись: {region.name} · {year} · значения сохраняются в
            <code> public/morbidity.json</code> и сразу видны на карте после
            обновления страницы.
          </div>
        )}
      </div>
    </div>
  );
}
