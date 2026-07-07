import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/shared/components/Providers"; 

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: "Almaa Herbal Nature CRM",
  description: "A CRM platform for managing customers, sales, and communication for Almaa Herbal Nature.",
};

export default function RootLayout({ children }) {
  return (
    // FIX: Added suppressHydrationWarning
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}