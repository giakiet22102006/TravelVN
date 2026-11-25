import type { Metadata } from "next";
import type React from "react";

export const metadata: Metadata = {
  title: "Giỏ Hàng | VN.TRAVEL",
};

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
