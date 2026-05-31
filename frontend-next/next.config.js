/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Прокси к Go-бэкенду: запросы /api/* уходят на сервер Go.
  // Адрес бэкенда настраивается переменной BACKEND_URL (по умолчанию localhost:8080).
  async rewrites() {
    const backend = process.env.BACKEND_URL || "http://localhost:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
