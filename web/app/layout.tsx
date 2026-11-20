import type { Metadata } from "next";
import "./globals.css";
import { DataProvider } from "@/lib/data";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Fantasy Basketball Picks",
  description: "Daily start/sit and free-agent recommendations for one ESPN fantasy basketball league.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <DataProvider>
          <Shell>{children}</Shell>
        </DataProvider>
      </body>
    </html>
  );
}
