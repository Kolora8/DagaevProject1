import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ЗдравМонитор — мониторинг здравоохранения регионов РФ",
  description:
    "Интерактивная карта России: показатели, прогнозы и оборудование здравоохранения по субъектам РФ.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
