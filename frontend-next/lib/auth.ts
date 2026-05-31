// Простейшая аутентификация для админ-панели (для учебного проекта).
// Логин/пароль и токен берутся из переменных окружения (.env.local),
// иначе используются значения по умолчанию — ОБЯЗАТЕЛЬНО смените их.

export const SESSION_COOKIE = "admin_session";

export function credentials() {
  return {
    user: process.env.ADMIN_USER || "admin",
    pass: process.env.ADMIN_PASSWORD || "admin123",
  };
}

export function sessionToken(): string {
  return process.env.ADMIN_TOKEN || "gisss-admin-secret-token";
}

export function isAuthed(cookieValue?: string): boolean {
  return !!cookieValue && cookieValue === sessionToken();
}
