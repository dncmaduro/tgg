import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniPlay — chơi nhanh, vui lâu",
  description: "Nền tảng mini game multiplayer cho nhóm bạn nhỏ.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
