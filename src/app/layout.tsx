import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import PinGate from "@/components/PinGate";
import DataProvider from "@/lib/DataProvider";

export const metadata: Metadata = {
  title: "Saturn Mobile",
  description: "Phone shop inventory & finance tracker",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A0A0A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PinGate>
          <DataProvider>
            <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 0 80px" }}>
              {children}
            </div>
            <BottomNav />
          </DataProvider>
        </PinGate>
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                setInterval(function() { reg.update(); }, 60000);
                reg.update();
              });
            }`,
          }}
        />
      </body>
    </html>
  );
}
