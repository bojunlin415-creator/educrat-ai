import type { Metadata } from "next";
import { SiteHeader } from "@/components/navigation/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "課堂星球｜AI 教材工作台",
    template: "%s｜課堂星球",
  },
  description: "為台灣國小教師打造的 AI 教材生成工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="zh-Hant-TW">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
