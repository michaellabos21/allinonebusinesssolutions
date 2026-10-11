import {
  ArrowRight,
  AtSign,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Handshake,
  Inbox,
  KanbanSquare,
  ListChecks,
  type LucideIcon,
  Play,
  Receipt,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";

import { LandingMotion } from "@/components/landing/landing-motion";
import dealsShot from "@/components/landing/shots/deals.webp";
import invoicesShot from "@/components/landing/shots/invoices.webp";
import overviewShot from "@/components/landing/shots/overview.webp";
import tasksShot from "@/components/landing/shots/tasks.webp";
import { LANDING_VIDEO, MARKETING_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

import "./landing.css";

const HEADLINE = "Run your whole business from one tab.";

/**
 * The public landing page, shown at `/` to visitors who aren't signed in.
 * Everything it says the app does is built and working; nothing here is a
 * promise about later phases.
 */
export function LandingPage() {
  return (
    <LandingMotion>
      <div className="min-h-dvh bg-canvas text-foreground">
        <SiteHeader />
        <main>
          <Hero />
          <ModuleStrip />
          {LANDING_VIDEO ? <VideoSection /> : null}
          <Flow />
          <Feature
            id="sell"
            eyebrow="Sell"
            title="Every enquiry becomes a deal you can see."
            body="Leads arrive from your own web forms or are added by hand. Convert one into a contact and a deal in a click, then move it along a pipeline that fits how you sell."
            points={[
              "Lead forms you share as a link, with spam limits built in",
              "A drag-and-drop pipeline with your own stages",
              "Each deal keeps a history of every move and change of value",
            ]}
            image={dealsShot}
            alt="The deals pipeline board with cards in Discovery, Qualified, Proposal and Negotiation"
            side="right"
          />
          <Feature
            id="deliver"
            eyebrow="Deliver"
            title="Plan the work and talk it through, in one place."
            body="Projects and tasks the way your team already thinks: grouped by status, assigned to several people, with checklists and a comment thread on every task."
            points={[
              "List and board views, with To do, In progress, In review and Done",
              "Comments with @mentions, so the right person sees it",
              "Notifications for assignments, mentions, comments and due dates",
            ]}
            image={tasksShot}
            alt="The tasks list grouped by status, with due dates, priorities and assignees"
            side="left"
          />
          <Feature
            id="get-paid"
            eyebrow="Get paid"
            title="Know who owes you, and how much, at a glance."
            body="Send estimates, turn accepted ones into invoices, and record payments as they come in. Overdue invoices stand out, and your overview shows what's still waiting to be paid."
            points={[
              "Invoice numbers that never repeat, with tax and discounts worked out for you",
              "Part payments, voids and a printable or PDF copy of every invoice",
              "Expenses with receipts, and reports on what you've collected",
            ]}
            image={invoicesShot}
            alt="The invoices list showing issued, part paid, overdue and paid invoices"
            side="right"
          />
          <Everything />
          <Trust />
          <FinalCta />
        </main>
        <SiteFooter />
      </div>
    </LandingMotion>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-display font-semibold">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-lg bg-primary text-[11px] font-bold tracking-wide text-primary-foreground"
          >
            AIO
          </span>
          <span className="hidden text-[15px] sm:inline">{MARKETING_NAME}</span>
        </Link>
        <nav aria-label="Sections" className="ml-4 hidden items-center gap-1 md:flex">
          {[
            ["#sell", "Sell"],
            ["#deliver", "Deliver"],
            ["#get-paid", "Get paid"],
            ...(LANDING_VIDEO ? [["#video", "Video"]] : []),
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="cta-shine rounded-lg bg-primary px-3.5 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate pt-16 sm:pt-24">
      <div aria-hidden className="aurora -z-10">
        <span />
        <span />
        <span />
      </div>
      <div aria-hidden className="dot-grid -z-10" />

      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <p
          className="hero-fade mx-auto inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-caption text-muted-foreground backdrop-blur"
          style={{ "--delay": "0ms" } as React.CSSProperties}
        >
          <span aria-hidden className="pulse-dot size-1.5 rounded-full bg-success" />
          Clients, projects and invoices, together
        </p>
        <h1
          id="hero-title"
          className="mx-auto mt-6 max-w-4xl font-display text-[clamp(2.5rem,1.4rem+4.6vw,5rem)] leading-[1.02] font-semibold tracking-[-0.035em]"
        >
          {HEADLINE.split(" ").map((word, index) => (
            <span key={index}>
              <span className="hero-word" style={{ "--i": index } as React.CSSProperties}>
                {word === "one" ? <span className="text-primary">{word}</span> : word}
              </span>{" "}
            </span>
          ))}
        </h1>
        <p
          className="hero-fade mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground"
          style={{ "--delay": "700ms" } as React.CSSProperties}
        >
          {MARKETING_NAME} keeps your contacts, sales pipeline, projects, tasks, invoices and
          payments in one workspace your whole team shares, so nothing lives in a spreadsheet
          someone forgot to update.
        </p>
        <div
          className="hero-fade mt-9 flex flex-wrap items-center justify-center gap-3"
          style={{ "--delay": "850ms" } as React.CSSProperties}
        >
          <Link
            href="/signup"
            className="cta-shine group inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-medium text-primary-foreground shadow-[0_10px_30px_-10px_rgb(52_71_158/0.7)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            Create your workspace
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-1"
            />
          </Link>
          <a
            href={LANDING_VIDEO ? "#video" : "#sell"}
            className="inline-flex h-12 items-center gap-2 rounded-xl border bg-background/80 px-5 text-[15px] font-medium backdrop-blur transition-colors hover:bg-background"
          >
            {LANDING_VIDEO ? (
              <>
                <Play aria-hidden className="size-4 fill-current" />
                Watch the video
              </>
            ) : (
              "See what's inside"
            )}
          </a>
        </div>
      </div>

      <HeroStage />
    </section>
  );
}

/** The overview screenshot, tilted in 3D, with cards floating over it. */
function HeroStage() {
  return (
    <div className="stage relative mx-auto mt-16 max-w-6xl px-4 pb-8 sm:mt-20 sm:px-6">
      <div className="stage-window relative overflow-hidden rounded-[14px] border bg-background">
        <div className="flex h-9 items-center gap-1.5 border-b bg-canvas px-3.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#e8695f]" />
          <span className="size-2.5 rounded-full bg-[#ecbf4f]" />
          <span className="size-2.5 rounded-full bg-[#62c554]" />
          <span className="mx-auto hidden rounded-md bg-background px-16 py-0.5 text-[11px] text-muted-foreground sm:block">
            Overview
          </span>
        </div>
        <Image
          src={overviewShot}
          alt="The overview: ₱129,680 in open invoices, payments collected, active projects, tasks due this week and the sales pipeline"
          placeholder="blur"
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1152px) 1104px, 100vw"
          className="block h-auto w-full"
        />
      </div>

      <FloatCard
        className="top-[18%] -left-2 hidden md:block lg:-left-10"
        delay="1.3s"
        bob="0s"
        depth={-26}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <UserPlus aria-hidden className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">Ana assigned you a task</span>
          <span className="block text-caption text-muted-foreground">Design homepage hero</span>
        </span>
        <span aria-hidden className="pulse-dot ml-1 size-2 shrink-0 rounded-full bg-primary" />
      </FloatCard>

      <FloatCard
        className="top-[46%] -right-2 hidden md:block lg:-right-12"
        delay="1.6s"
        bob="-2s"
        depth={30}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <Wallet aria-hidden className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">INV-0001 is paid in full</span>
          <span className="block text-caption text-muted-foreground">
            ₱70,560 from Kusina Lokal
          </span>
        </span>
      </FloatCard>

      <FloatCard
        className="bottom-[2%] left-[12%] hidden lg:block"
        delay="1.9s"
        bob="-4s"
        depth={18}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Handshake aria-hidden className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">Clinic website moved to Proposal</span>
          <span className="block text-caption text-muted-foreground">₱95,000 · Bayside Dental</span>
        </span>
      </FloatCard>
    </div>
  );
}

function FloatCard({
  className,
  delay,
  bob,
  depth,
  children,
}: {
  className: string;
  delay: string;
  bob: string;
  depth: number;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden
      data-depth={depth}
      className={cn("float-card z-10", className)}
      style={{ "--delay": delay, "--bob": bob } as React.CSSProperties}
    >
      <div className="flex w-72 items-center gap-3 rounded-xl border bg-background/95 px-3.5 py-3 text-left shadow-[0_20px_50px_-15px_rgb(28_36_52/0.35)] backdrop-blur">
        {children}
      </div>
    </div>
  );
}

const MODULES: { icon: LucideIcon; label: string }[] = [
  { icon: Users, label: "Contacts" },
  { icon: Building2, label: "Companies" },
  { icon: Inbox, label: "Leads" },
  { icon: FileText, label: "Lead forms" },
  { icon: Handshake, label: "Deals" },
  { icon: KanbanSquare, label: "Pipeline" },
  { icon: FolderKanban, label: "Projects" },
  { icon: ListChecks, label: "Tasks" },
  { icon: AtSign, label: "Comments & mentions" },
  { icon: Bell, label: "Notifications" },
  { icon: CalendarDays, label: "Calendar" },
  { icon: ClipboardList, label: "Estimates" },
  { icon: FileText, label: "Invoices" },
  { icon: Wallet, label: "Payments" },
  { icon: Receipt, label: "Expenses & receipts" },
  { icon: BarChart3, label: "Reports" },
  { icon: FileSpreadsheet, label: "CSV import" },
  { icon: ShieldCheck, label: "Team roles" },
];

/** Two rows of modules sliding past in opposite directions. */
function ModuleStrip() {
  const half = Math.ceil(MODULES.length / 2);
  const rows = [MODULES.slice(0, half), MODULES.slice(half)];
  return (
    <section aria-label="What's included" className="py-14">
      <p className="mb-6 text-center text-caption font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Everything a small team runs on
      </p>
      <div className="marquee space-y-3 overflow-hidden">
        {rows.map((row, index) => (
          <div key={index} className="marquee-track" data-reverse={index === 1 ? "" : undefined}>
            {/* Two copies so the loop is seamless; the second is hidden from screen readers. */}
            {[0, 1].map((copy) =>
              row.map(({ icon: Icon, label }) => (
                <span
                  key={`${copy}-${label}`}
                  aria-hidden={copy === 1 || undefined}
                  className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 font-medium whitespace-nowrap"
                >
                  <Icon aria-hidden className="size-4 text-primary" />
                  {label}
                </span>
              )),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function VideoSection() {
  if (!LANDING_VIDEO) return null;
  return (
    <section id="video" aria-labelledby="video-title" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center" data-reveal>
          <p className="text-caption font-semibold tracking-[0.14em] text-primary uppercase">
            See it in action
          </p>
          <h2
            id="video-title"
            className="mt-3 font-display text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] leading-tight font-semibold tracking-[-0.025em]"
          >
            A quick look around {MARKETING_NAME}
          </h2>
        </div>
        <div
          data-reveal="zoom"
          className="mt-10 overflow-hidden rounded-2xl border bg-foreground shadow-[0_40px_100px_-30px_rgb(28_36_52/0.5)]"
        >
          {"youtubeId" in LANDING_VIDEO ? (
            // YouTube's privacy-enhanced player sets no cookies until the video is played.
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${LANDING_VIDEO.youtubeId}?rel=0`}
              title={`${MARKETING_NAME} video`}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="aspect-video w-full border-0"
            />
          ) : (
            <video
              controls
              playsInline
              preload="metadata"
              poster={LANDING_VIDEO.poster}
              className="aspect-video w-full"
            >
              <source src={LANDING_VIDEO.src} type="video/mp4" />
              Your browser can’t play this video.
            </video>
          )}
        </div>
      </div>
    </section>
  );
}

const FLOW_STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Inbox, title: "Lead", body: "An enquiry arrives from your form" },
  { icon: Handshake, title: "Deal", body: "Convert it and move it to won" },
  { icon: FolderKanban, title: "Project", body: "Plan the work as tasks" },
  { icon: FileText, title: "Invoice", body: "Bill from an accepted estimate" },
  { icon: CheckCircle2, title: "Paid", body: "Record the payment, done" },
];
// A wave through the centres of the five step icons (10%, 30%, 50%, 70% and 90% across).
const FLOW_PATH =
  "M 126 60 C 200 0, 304 0, 378 60 S 556 120, 630 60 S 808 0, 882 60 S 1060 120, 1134 60";

/** One customer's journey through the app; the line draws itself on arrival. */
function Flow() {
  return (
    <section aria-labelledby="flow-title" className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <p className="text-caption font-semibold tracking-[0.14em] text-primary uppercase">
            How it fits together
          </p>
          <h2
            id="flow-title"
            className="mt-3 font-display text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] leading-tight font-semibold tracking-[-0.025em]"
          >
            From first enquiry to money in the bank.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Each step hands over to the next, so you never copy a client’s details from one tool
            into another.
          </p>
        </div>

        <div data-reveal className="relative mt-14">
          <svg
            aria-hidden
            viewBox="0 0 1260 120"
            preserveAspectRatio="none"
            className="absolute inset-x-0 -top-7 hidden h-[120px] w-full md:block"
          >
            <path
              id="flow-path"
              d={FLOW_PATH}
              pathLength={1}
              fill="none"
              stroke="var(--primary)"
              strokeOpacity={0.35}
              strokeWidth={2}
              strokeDasharray="1"
              className="flow-line"
              vectorEffect="non-scaling-stroke"
            />
            <circle r="7" fill="var(--primary)" className="flow-traveller">
              <animateMotion dur="4.5s" repeatCount="indefinite" rotate="auto">
                <mpath href="#flow-path" />
              </animateMotion>
            </circle>
          </svg>
          <ol className="relative grid gap-6 md:grid-cols-5 md:gap-4">
            {FLOW_STEPS.map(({ icon: Icon, title, body }, index) => (
              <li
                key={title}
                className="flow-step flex flex-col items-center text-center"
                style={{ "--i": index } as React.CSSProperties}
              >
                <span className="flow-step-icon flex size-16 items-center justify-center rounded-2xl border bg-background text-primary shadow-[0_10px_30px_-12px_rgb(28_36_52/0.25)]">
                  <Icon aria-hidden className="size-6" />
                </span>
                <span className="mt-4 font-display text-lg font-semibold">{title}</span>
                <span className="mt-1 max-w-[12rem] text-muted-foreground">{body}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Feature({
  id,
  eyebrow,
  title,
  body,
  points,
  image,
  alt,
  side,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  image: StaticImageData;
  alt: string;
  side: "left" | "right";
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 py-14 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        <div className={cn(side === "left" && "lg:order-2")}>
          <p
            data-reveal
            className="text-caption font-semibold tracking-[0.14em] text-primary uppercase"
          >
            {eyebrow}
          </p>
          <h2
            id={`${id}-title`}
            data-reveal
            style={{ "--delay": "80ms" } as React.CSSProperties}
            className="mt-3 font-display text-[clamp(1.75rem,1.2rem+2vw,2.5rem)] leading-tight font-semibold tracking-[-0.025em]"
          >
            {title}
          </h2>
          <p
            data-reveal
            style={{ "--delay": "160ms" } as React.CSSProperties}
            className="mt-4 text-[15px] leading-relaxed text-muted-foreground"
          >
            {body}
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((point, index) => (
              <li
                key={point}
                data-reveal
                style={{ "--delay": `${240 + index * 110}ms` } as React.CSSProperties}
                className="flex gap-3"
              >
                <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div
          data-reveal={side === "right" ? "right" : "left"}
          className={cn("relative", side === "left" && "lg:order-1")}
        >
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[28px] bg-[radial-gradient(ellipse_at_center,rgb(52_71_158/0.14),transparent_70%)]"
          />
          <div
            data-wipe={side}
            className="overflow-hidden rounded-[14px] border bg-background shadow-[0_30px_70px_-25px_rgb(28_36_52/0.4)]"
          >
            <Image
              src={image}
              alt={alt}
              placeholder="blur"
              sizes="(min-width: 1024px) 640px, 100vw"
              className="block h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

const EVERYTHING: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Users,
    title: "Contacts and companies",
    body: "Everyone you work with, their notes and history, and a CSV import with a preview.",
  },
  {
    icon: FileText,
    title: "Lead forms",
    body: "Share a link; each enquiry lands as a lead, with limits that stop spam floods.",
  },
  {
    icon: KanbanSquare,
    title: "Deals pipeline",
    body: "Your own stages, drag and drop, and a reason recorded for every lost deal.",
  },
  {
    icon: ListChecks,
    title: "Tasks and checklists",
    body: "Several assignees, due dates, an In review step and progress you can see.",
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "Assignments, mentions, comments, tasks due today, payments and new leads.",
  },
  {
    icon: ClipboardList,
    title: "Estimates and invoices",
    body: "Line items with details, tax and discounts, and accepted estimates become invoices.",
  },
  {
    icon: Receipt,
    title: "Expenses",
    body: "Log what you spend and keep the receipt with it, privately.",
  },
  {
    icon: BarChart3,
    title: "Reports",
    body: "What you've collected, month by month, and where your pipeline stands.",
  },
  {
    icon: CalendarDays,
    title: "Calendar",
    body: "Task, project and invoice due dates on one calendar.",
  },
];

function Everything() {
  return (
    <section aria-labelledby="everything-title" className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <h2
            id="everything-title"
            className="font-display text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] leading-tight font-semibold tracking-[-0.025em]"
          >
            One workspace instead of five tools.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Everything below is in the app today, connected to everything else.
          </p>
        </div>
        <ul className="spotlight-grid mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EVERYTHING.map(({ icon: Icon, title, body }, index) => (
            <li
              key={title}
              data-reveal
              style={{ "--delay": `${(index % 3) * 90}ms` } as React.CSSProperties}
              className="spotlight rounded-2xl border bg-background p-6"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold">{title}</h3>
              <p className="mt-1.5 leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Trust() {
  const points = [
    {
      title: "Your workspace is yours alone",
      body: "The database itself keeps each business's records apart, not just the screens.",
    },
    {
      title: "Roles for everyone on the team",
      body: "Owners, admins, managers, members and clients each see only what they should. Money stays with managers and above.",
    },
    {
      title: "Numbers you can trust",
      body: "Totals are worked out by the database with fixed rounding rules, and invoice numbers never repeat.",
    },
  ];
  return (
    <section aria-labelledby="trust-title" className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          data-reveal="zoom"
          className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-12 text-background sm:px-12"
        >
          <div
            aria-hidden
            className="absolute -top-24 -right-24 size-72 rounded-full bg-primary/40 blur-3xl"
          />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            <div>
              <ShieldCheck aria-hidden className="size-8 text-[#9fb0ff]" />
              <h2
                id="trust-title"
                className="mt-4 font-display text-[clamp(1.6rem,1.2rem+1.6vw,2.25rem)] leading-tight font-semibold tracking-[-0.02em]"
              >
                Built carefully, because it holds your business.
              </h2>
            </div>
            <ul className="grid gap-8 sm:grid-cols-3">
              {points.map((point, index) => (
                <li
                  key={point.title}
                  data-reveal
                  style={{ "--delay": `${200 + index * 120}ms` } as React.CSSProperties}
                >
                  <h3 className="font-display text-base font-semibold">{point.title}</h3>
                  <p className="mt-2 leading-relaxed text-background/70">{point.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="relative isolate overflow-hidden py-20 sm:py-28"
    >
      <div aria-hidden className="aurora -z-10 opacity-40">
        <span />
        <span />
        <span />
      </div>
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6" data-reveal>
        <h2
          id="cta-title"
          className="font-display text-[clamp(2rem,1.3rem+3vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.03em]"
        >
          Bring your business into one place.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
          Create a workspace, invite your team, and add your first client in a few minutes.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="cta-shine group inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-medium text-primary-foreground shadow-[0_10px_30px_-10px_rgb(52_71_158/0.7)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            Create your workspace
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-1"
            />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center rounded-xl border bg-background/80 px-6 text-[15px] font-medium transition-colors hover:bg-background"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-caption text-muted-foreground sm:px-6">
        <p>© {MARKETING_NAME}</p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-foreground">
            Create a workspace
          </Link>
        </nav>
      </div>
    </footer>
  );
}
