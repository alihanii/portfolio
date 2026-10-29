import en from "@/data/resume-en.json";
import fa from "@/data/resume-fa.json";

export const locales = ["fa", "en"] as const;
export type Locale = (typeof locales)[number];
export type Resume = typeof en;

const resumes: Record<Locale, Resume> = { en, fa };

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getResume(locale: Locale): Resume {
  return resumes[locale];
}

export const dirOf = (locale: Locale) => (locale === "fa" ? "rtl" : "ltr");
