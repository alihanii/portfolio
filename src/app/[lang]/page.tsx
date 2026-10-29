import { asset } from "@/lib/base";
import { getResume, isLocale, type Locale } from "@/lib/content";
import ScrollStage from "@/components/ScrollStage";
import Dock from "@/components/Dock";
import LiveStats from "@/components/LiveStats";
import { ArrowUpRight, Github, Linkedin, Mail, Spark } from "@/components/Icons";

const frames = (r: ReturnType<typeof getResume>, id: string) => r.sections.find((s) => s.id === id)!.frames.join(",");

function SectionHead({ index, title, id }: { index: string; title: string; id: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="dot-accent" aria-hidden="true" />
      <span className="eyebrow tabular-nums">{index}</span>
      <h2 id={id} className="font-display text-3xl font-bold leading-tight md:text-4xl">
        {title}
      </h2>
    </div>
  );
}

type Project = ReturnType<typeof getResume>["projects"]["items"][number];

function ProjectCard({ p, head, featuresLabel }: { p: Project; head?: React.ReactNode; featuresLabel: string }) {
  const body = (
    <>
      {head}
      {p.image && (
        <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-xl border border-line">
          <div
            className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]"
            style={{
              background: `url(${asset(p.image)}) top center / cover no-repeat, linear-gradient(135deg, rgb(var(--accent-rgb) / 0.35), rgb(var(--bg-rgb) / 0.7))`,
            }}
            role="img"
            aria-label={p.name}
          />
          <span className="chip absolute bottom-3 start-3 gap-1.5 bg-black/50 text-white backdrop-blur-md">
            <span className="dot-accent size-1.5" aria-hidden="true" />
            {p.live}
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-bold">{p.name}</h3>
        {p.url && (
          <span className="accent-text transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100">
            <ArrowUpRight />
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{p.description}</p>
      {p.features.length > 0 && (
        <>
          <h4 className="eyebrow mb-2 mt-4">{featuresLabel}</h4>
          <ul className="space-y-1.5 text-sm leading-relaxed">
            {p.features.map((f) => (
              <li key={f} className="flex gap-2.5">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {p.tags.map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
      </div>
      {p.linkLabel && <p className="ltr mt-4 text-xs text-muted">{p.linkLabel}</p>}
    </>
  );
  return p.url ? (
    <a href={p.url} target="_blank" rel="noopener noreferrer" className="glass group block p-6" data-reveal>
      {body}
    </a>
  ) : (
    <article className="glass p-6" data-reveal>
      {body}
    </article>
  );
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = (isLocale(raw) ? raw : "fa") as Locale;
  const r = getResume(lang);
  const { ui, meta } = r;
  const nav = [
    ["about", ui.nav.about],
    ["experience", ui.nav.experience],
    ["stack", ui.nav.stack],
    ["projects", ui.nav.projects],
    ["contact", ui.nav.contact],
  ] as const;

  return (
    <>
      <a href="#about" className="sr-only z-[60] rounded-full bg-accent px-4 py-2 text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
        {ui.skip}
      </a>

      <ScrollStage loadingLabel={ui.loading} />

      {/* ---------- header ---------- */}
      <header className="fixed inset-x-0 top-0 z-40 px-4 pt-3 md:px-8">
        <div className="glass mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 rounded-full px-4 md:px-5">
          <a href="#hero" className="flex items-center gap-2 font-display text-base font-bold">
            <span className="accent-text" aria-hidden="true">
              <Spark />
            </span>
            {meta.name}
          </a>
          <nav aria-label="Sections" className="hidden md:block">
            <ul className="flex items-center gap-1 text-sm">
              {nav.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    data-nav={id}
                    className="rounded-full px-3 py-2 text-muted transition-colors hover:text-fg aria-[current=true]:bg-white/5 aria-[current=true]:text-fg"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <a href={`mailto:${meta.email}`} className="btn btn-ghost h-10 min-h-0 text-sm">
            {ui.letsTalk}
          </a>
        </div>
        <div className="mx-auto mt-2 h-px max-w-[1380px] overflow-hidden" aria-hidden="true">
          <div className="h-full origin-left bg-accent rtl:origin-right" style={{ transform: "scaleX(var(--progress, 0))" }} />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1440px] px-4 md:px-8">
        {/* ---------- hero ---------- */}
        <section id="hero" data-frames={frames(r, "hero")} aria-labelledby="hero-title" className="flex min-h-[100svh] flex-col justify-between pb-28 pt-28 md:pb-24">
          <div className="grid gap-6 md:grid-cols-12 md:items-start">
            <div className="md:col-span-5 lg:col-span-4" data-reveal>
              <p className="eyebrow mb-3">{r.hero.eyebrow}</p>
              <h1 id="hero-title" className="font-display text-[clamp(3rem,7.4vw,6.75rem)] font-extrabold leading-[0.95] tracking-tight">
                {r.hero.line1}
                <br />
                <span className="accent-text">{r.hero.line2}</span>
              </h1>
            </div>
            <div className="glass hidden max-w-sm p-5 md:block md:col-span-4 md:col-start-9 md:mt-10 md:justify-self-end" data-reveal>
              <p className="text-[0.95rem] leading-relaxed">{r.hero.tagline}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                {r.hero.points.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <span className="size-1 rounded-full bg-accent" aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {r.hero.stats.map((s) => (
                <li key={s.label} className="glass p-4 md:p-5" data-reveal>
                  <p className="ltr font-display text-3xl font-bold md:text-4xl">
                    {s.value}
                    <span className="accent-text">.</span>
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted md:text-sm">{s.label}</p>
                </li>
              ))}
            </ul>
            <p className="eyebrow mt-6 flex items-center justify-center gap-2" aria-hidden="true">
              <span className="block h-6 w-px animate-pulse bg-accent" />
              {ui.scroll}
            </p>
          </div>
        </section>

        {/* ---------- about ---------- */}
        <section id="about" tabIndex={-1} data-frames={frames(r, "about")} aria-labelledby="about-title" className="grid min-h-[140vh] gap-[38vh] py-[14vh] outline-none md:grid-cols-12 md:gap-6">
          <div className="glass self-start p-6 md:col-span-5 md:p-7 lg:col-span-4" data-reveal>
            <SectionHead index={r.about.index} title={r.about.title} id="about-title" />
            <p className="leading-relaxed">{r.about.body}</p>
            <p className="mt-5 text-sm text-muted">
              {meta.fullName} · {meta.location}
            </p>
          </div>
          <ul className="space-y-3 self-end md:col-span-4 md:col-start-9">
            {r.about.highlights.map((h, i) => (
              <li key={h.title} className="glass p-5" data-reveal>
                <p className="eyebrow tabular-nums">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-1 font-display text-lg font-bold">{h.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{h.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- experience ---------- */}
        <section id="experience" tabIndex={-1} data-frames={frames(r, "experience")} aria-labelledby="experience-title" className="min-h-[190vh] py-[12vh] outline-none">
          <div className="grid gap-[30vh] md:grid-cols-12 md:gap-6">
            {r.experience.items.map((job, i) => (
              <article
                key={job.company}
                className={`glass p-6 md:self-start md:p-7 ${i % 2 === 0 ? "md:col-span-5 md:row-start-1 lg:col-span-4 md:rtl:col-start-8 lg:rtl:col-start-9" : "md:col-span-5 md:col-start-8 md:row-start-1 md:mt-[70vh] lg:col-span-4 lg:col-start-9 md:rtl:col-start-1 lg:rtl:col-start-1"}`}
                data-reveal
              >
                {i === 0 && <SectionHead index={r.experience.index} title={r.experience.title} id="experience-title" />}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-bold">{job.company}</h3>
                  {job.current && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs">
                      <span className="dot-accent size-1.5" aria-hidden="true" />
                      {ui.current}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm">
                  <span className="accent-text font-semibold">{job.role}</span>
                  <span className="text-muted"> · {job.period}</span>
                </p>
                <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted">
                  {job.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {job.tags.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- stack ---------- */}
        <section id="stack" tabIndex={-1} data-frames={frames(r, "stack")} aria-labelledby="stack-title" className="min-h-[130vh] py-[12vh] outline-none">
          <div className="grid gap-[30vh] md:grid-cols-12 md:gap-6">
            <div className="space-y-3 md:col-span-5 lg:col-span-4">
              <div className="glass p-6" data-reveal>
                <SectionHead index={r.stack.index} title={r.stack.title} id="stack-title" />
                <div className="space-y-5">
                  {r.stack.groups.slice(0, 2).map((g) => (
                    <div key={g.name}>
                      <h3 className="eyebrow mb-2">{g.name}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {g.items.map((it) => (
                          <span key={it} className="chip">
                            {it}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-3 md:col-span-5 md:col-start-8 md:mt-[40vh] lg:col-span-4 lg:col-start-9">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                {r.stack.groups.slice(2).map((g) => (
                  <div key={g.name} className="glass p-5" data-reveal>
                    <h3 className="eyebrow mb-2">{g.name}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {g.items.map((it) => (
                        <span key={it} className="chip">
                          {it}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="glass p-5" data-reveal>
                <h3 className="eyebrow mb-3">{r.stack.softTitle}</h3>
                <ul className="space-y-2 text-sm">
                  {r.stack.soft.map((s) => (
                    <li key={s} className="flex gap-2.5">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- projects ---------- */}
        <section id="projects" tabIndex={-1} data-frames={frames(r, "projects")} aria-labelledby="projects-title" className="min-h-[160vh] py-[12vh] outline-none">
          <div className="grid gap-[30vh] md:grid-cols-12 md:gap-6">
            <div className="space-y-3 md:col-span-5 lg:col-span-4">
              {r.projects.items
                .filter((_, i) => i % 2 === 0)
                .map((p, i) => (
                  <ProjectCard key={p.name} p={p} featuresLabel={ui.features} head={i === 0 ? <SectionHead index={r.projects.index} title={r.projects.title} id="projects-title" /> : null} />
                ))}
            </div>
            <div className="space-y-3 md:col-span-5 md:col-start-8 md:mt-[45vh] lg:col-span-4 lg:col-start-9">
              {r.projects.items
                .filter((_, i) => i % 2 === 1)
                .map((p) => (
                  <ProjectCard key={p.name} p={p} featuresLabel={ui.features} />
                ))}
              <div className="glass p-6" data-reveal>
                <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
                  <span className="accent-text">
                    <Spark />
                  </span>
                  {ui.underTheHood}
                </h3>
                <LiveStats labels={{ frame: ui.frame, fps: ui.fps, loaded: ui.loaded }} locale={lang === "fa" ? "fa-IR" : "en-US"} />
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
                  {r.projects.craft.map((c) => (
                    <li key={c} className="flex gap-2.5">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- contact ---------- */}
        <section id="contact" tabIndex={-1} data-frames={frames(r, "contact")} aria-labelledby="contact-title" className="flex min-h-[110vh] flex-col justify-end pb-32 pt-[20vh] outline-none">
          <div className="grid gap-[24vh] md:grid-cols-12 md:items-end md:gap-6">
            <div className="md:col-span-5 lg:col-span-4" data-reveal>
              <p className="eyebrow mb-3 tabular-nums">{r.contact.index}</p>
              <h2 id="contact-title" className="font-display text-[clamp(2.75rem,6vw,5.5rem)] font-extrabold leading-[0.95] tracking-tight">
                {r.contact.title}
              </h2>
              <p className="mt-4 max-w-sm leading-relaxed text-muted">{r.contact.body}</p>
            </div>
            <div className="space-y-3 md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9">
              <div className="glass p-3" data-reveal>
                {[
                  { href: `mailto:${meta.email}`, label: r.contact.emailLabel, value: meta.email, icon: <Mail /> },
                  { href: meta.github, label: r.contact.githubLabel, value: "github.com/alihanii", icon: <Github /> },
                  { href: meta.linkedin, label: r.contact.linkedinLabel, value: "in/ali-hani", icon: <Linkedin /> },
                ].map((l) => (
                  <a key={l.label} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex min-h-14 items-center gap-3 rounded-xl px-3 transition-colors hover:bg-white/5">
                    <span className="accent-text">{l.icon}</span>
                    <span className="text-sm text-muted">{l.label}</span>
                    <span className="ltr ms-auto text-sm font-medium">{l.value}</span>
                  </a>
                ))}
              </div>
              <div className="glass flex items-center justify-between gap-3 p-5" data-reveal>
                <div>
                  <p className="eyebrow">{r.education.title}</p>
                  <p className="mt-1 text-sm font-semibold">{r.education.degree}</p>
                  <p className="text-sm text-muted">{r.education.school}</p>
                </div>
              </div>
            </div>
          </div>
          <footer className="mt-16 border-t border-line pt-6 text-center text-xs text-muted">{ui.footer}</footer>
        </section>
      </main>

      <Dock lang={lang} ui={ui} pdf={meta.pdf} />
    </>
  );
}
