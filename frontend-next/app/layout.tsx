import type { Metadata } from "next";
import { Onest, DM_Mono } from "next/font/google";
import "./globals.css";

const onest = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

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
    <html lang="ru" className={`${onest.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
