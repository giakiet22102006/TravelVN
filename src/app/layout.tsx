import type { Metadata } from "next";
import { Be_Vietnam_Pro, Lexend_Deca, Nunito_Sans } from "next/font/google";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
});

const lexendDeca = Lexend_Deca({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lexend-deca",
});

const nunitoSans = Nunito_Sans({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito-sans",
});

export const metadata: Metadata = {
  title: "VN.TRAVEL | TravelVN",
  description: "Hệ thống quản lý và đặt tour du lịch TravelVN",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnam.variable} ${lexendDeca.variable} ${nunitoSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
