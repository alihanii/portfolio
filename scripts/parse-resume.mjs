// Build-time PDF -> localized JSON pipeline.
//
//   ANTHROPIC_API_KEY=... npm run resume:parse -- path/to/resume.pdf
//
// Sends the PDF to Claude, gets back resume content in Persian and English
// that matches the shape of src/data/resume-*.json, and writes both files.
// Frame ranges, UI strings and links are kept from the existing files, so
// only the resume content is replaced. Review the diff before committing.
import { readFile, writeFile, copyFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const pdfPath = process.argv[2] ?? "resume.pdf";

const Content = z.object({
  meta: z.object({ name: z.string(), fullName: z.string(), title: z.string(), location: z.string() }),
  hero: z.object({
    eyebrow: z.string(),
    line1: z.string(),
    line2: z.string(),
    tagline: z.string(),
    points: z.array(z.string()),
    stats: z.array(z.object({ value: z.string(), label: z.string() })),
  }),
  about: z.object({ title: z.string(), body: z.string(), highlights: z.array(z.object({ title: z.string(), text: z.string() })) }),
  experience: z.object({
    title: z.string(),
    items: z.array(
      z.object({ company: z.string(), role: z.string(), period: z.string(), current: z.boolean(), bullets: z.array(z.string()), tags: z.array(z.string()) }),
    ),
  }),
  stack: z.object({
    title: z.string(),
    groups: z.array(z.object({ name: z.string(), items: z.array(z.string()) })),
    softTitle: z.string(),
    soft: z.array(z.string()),
  }),
  projects: z.object({
    title: z.string(),
    items: z.array(z.object({ name: z.string(), description: z.string(), tags: z.array(z.string()), url: z.string(), linkLabel: z.string() })),
  }),
  education: z.object({ title: z.string(), school: z.string(), degree: z.string(), masters: z.string() }),
});
const Output = z.object({ fa: Content, en: Content });

const client = new Anthropic();
const pdf = (await readFile(pdfPath)).toString("base64");

const response = await client.messages.parse({
  model: "claude-opus-5-5",
  max_tokens: 16000,
  output_config: { effort: "high", format: zodOutputFormat(Output) },
  messages: [
    {
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
        {
          type: "text",
          text: `This is my ATS resume. Turn it into content for my portfolio site, once in Persian (fa) and once in English (en).
Keep every fact from the resume and do not invent companies, dates, numbers or skills. Fix obvious typos.
Persian dates stay in the Solar Hijri calendar with Persian digits; English dates use Gregorian month + year.
hero.line1/line2 split the job title over two lines; hero.stats are 4 short facts taken from the resume.
Group skills into 4 groups of about 6 items. Keep technology names in Latin script in both languages.`,
        },
      ],
    },
  ],
});

if (response.stop_reason === "refusal" || !response.parsed_output) {
  console.error("Claude did not return resume content:", response.stop_reason);
  process.exit(1);
}

for (const lang of ["fa", "en"]) {
  const file = `src/data/resume-${lang}.json`;
  const current = JSON.parse(await readFile(file, "utf8"));
  const next = response.parsed_output[lang];
  const merged = {
    ...current,
    meta: { ...current.meta, ...next.meta },
    hero: next.hero,
    about: { ...current.about, ...next.about },
    experience: { ...current.experience, ...next.experience },
    stack: { ...current.stack, ...next.stack },
    projects: { ...current.projects, ...next.projects },
    education: next.education,
  };
  await writeFile(file, JSON.stringify(merged, null, 2) + "\n");
  console.log(`wrote ${file}`);
}

await copyFile(pdfPath, "public/resume-alihani.pdf");
console.log("copied PDF to public/resume-alihani.pdf");
