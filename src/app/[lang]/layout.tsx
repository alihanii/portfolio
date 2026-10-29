import { asset } from "@/lib/base";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Inter, Syne, Vazirmatn } from "next/font/google";
import { dirOf, getResume, isLocale, locales } from "@/lib/content";
import { bootScript } from "@/lib/theme";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-syne", display: "swap" });
const vazir = Vazirmatn({ subsets: ["arabic", "latin"], variable: "--font-vazir", display: "swap" });

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { meta, about } = getResume(lang);
  return {
    title: `${meta.name} | ${meta.title}`,
    description: about.body,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    alternates: { languages: { fa: asset("/fa/"), en: asset("/en/") } },
    openGraph: { title: `${meta.name} | ${meta.title}`, description: about.body, images: [asset("/og.jpg")] },
  };
}

export const viewport: Viewport = {
  themeColor: "#070505",
  width: "device-width",
  initialScale: 1,
};

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} dir={dirOf(lang)} className={`${inter.variable} ${syne.variable} ${vazir.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <link rel="preload" as="image" href={asset("/frames/lg/001.webp")} media="(min-width: 768px)" />
        <link rel="preload" as="image" href={asset("/frames/sm/001.webp")} media="(max-width: 767px)" />
      </head>
      <body>{children}</body>
    </html>
  );
}
