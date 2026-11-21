import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/lib/data";
import { Shell } from "@/components/Shell";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["700"], display: "swap", variable: "--font-barlow" });

export const metadata: Metadata = {
  title: "Fantasy Picks",
  description: "Daily start/sit and free-agent recommendations for one ESPN fantasy basketball league.",
};

export const viewport: Viewport = { themeColor: "#0e1116" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable}`}>
      <body>
        <DataProvider>
          <Shell>{children}</Shell>
        </DataProvider>
      </body>
    </html>
  );
}
