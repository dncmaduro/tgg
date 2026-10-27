import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniPlay",
  description: "Tạo phòng và chơi mini game cùng bạn bè.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
