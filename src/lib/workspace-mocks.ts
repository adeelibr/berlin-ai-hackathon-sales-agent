export const dashboardMetrics = [
  {
    label: "Active campaigns",
    value: "06",
    change: "+2 this week",
    detail: "Three personas are currently running in parallel.",
  },
  {
    label: "Lead response rate",
    value: "38%",
    change: "+5.4 pts",
    detail: "Warm inbound follow-up and founder-led intros are converting best.",
  },
  {
    label: "Meetings booked",
    value: "14",
    change: "Next 10 days",
    detail: "Most booked calls cluster on Tuesday and Thursday mornings.",
  },
];

export const dashboardPipeline = [
  { label: "New leads", value: 84, tone: "muted" as const },
  { label: "Called", value: 51, tone: "accent" as const },
  { label: "Qualified", value: 23, tone: "warm" as const },
  { label: "Booked", value: 14, tone: "ink" as const },
];

export const dashboardActivity = [
  {
    title: 'Campaign "Studio Recovery" crossed 40% contact coverage',
    meta: "8 minutes ago",
  },
  {
    title: 'Persona "Calm closer" outperformed the control intro',
    meta: "Today · 11:20",
  },
  {
    title: "Nexa Health moved from objection handling into demo scheduling",
    meta: "Today · 09:45",
  },
  {
    title: "18 new leads imported from founder referrals",
    meta: "Yesterday",
  },
];

export const leads = [
  {
    company: "Nexa Health",
    contact: "Maya Chen",
    role: "VP Revenue",
    status: "Qualified",
    source: "Founder intro",
    nextStep: "Book discovery",
  },
  {
    company: "Northstar Ops",
    contact: "Daniel Moss",
    role: "COO",
    status: "Contacted",
    source: "Outbound list",
    nextStep: "Follow up Thursday",
  },
  {
    company: "Briar Systems",
    contact: "Anika Rao",
    role: "CEO",
    status: "Research",
    source: "Conference list",
    nextStep: "Refine company angle",
  },
  {
    company: "Cinder Labs",
    contact: "Jonas Weber",
    role: "Head of Sales",
    status: "Scheduled",
    source: "Referral",
    nextStep: "Prep for call",
  },
  {
    company: "Oakline AI",
    contact: "Priya Shah",
    role: "Founder",
    status: "New",
    source: "Website waitlist",
    nextStep: "Enrich ICP notes",
  },
];

export const companyNotes = [
  {
    label: "Positioning",
    value:
      "AI voice agents for founder-led outbound teams that want cleaner calls and faster follow-up.",
  },
  {
    label: "Proof points",
    value:
      "Studio-grade audio, campaign personas, and operator visibility across every live conversation.",
  },
  {
    label: "Ideal customer",
    value:
      "Early-stage B2B teams with a hands-on founder or revenue lead owning first outbound motion.",
  },
];

export const companySignals = [
  "Founder-led outreach converts better when the first line reflects the buyer's operating context.",
  "Medical and health-adjacent accounts respond best to calmer scripts and slower pacing.",
  "Calls under two minutes create more follow-up openings than longer qualification-heavy intros.",
];

export const personas = [
  {
    id: "calm-closer",
    name: "Calm closer",
    style: "Measured, reflective, low-pressure",
    summary: "Best for warm founder intros and careful qualification.",
    metrics: ["41% reply", "12 booked", "Low churn"],
  },
  {
    id: "operator",
    name: "Operator",
    style: "Structured, sharp, practical",
    summary: "Works well when buyers care about team workflow and process reliability.",
    metrics: ["33% reply", "8 booked", "Fast ramp"],
  },
  {
    id: "strategist",
    name: "Editorial strategist",
    style: "Narrative-led, context-heavy, confident",
    summary: "Strongest on premium accounts where positioning needs more nuance.",
    metrics: ["29% reply", "6 booked", "High value"],
  },
];

export const campaigns = [
  {
    name: "Studio Recovery",
    brief: "Re-engage quiet SaaS leads with a softer founder voice and shorter openers.",
    persona: "Calm closer",
    progress: 64,
    contacted: 48,
    total: 75,
    status: "Running",
    updatedAt: "Updated 12 min ago",
  },
  {
    name: "Berlin Health Pilot",
    brief:
      "Target health-tech operators with compliance-aware messaging and a consultative first question.",
    persona: "Operator",
    progress: 46,
    contacted: 23,
    total: 50,
    status: "Optimizing",
    updatedAt: "Updated 1 hr ago",
  },
  {
    name: "Founder Referral Loop",
    brief: "Use social proof and referral context to convert hand-picked founder introductions.",
    persona: "Editorial strategist",
    progress: 83,
    contacted: 25,
    total: 30,
    status: "Finishing",
    updatedAt: "Updated yesterday",
  },
];

// Stillwater workspace data
export type LeadState = "new" | "called" | "scheduled";

export type Lead = {
  id: string;
  name: string;
  company: string;
  phone: string;
  state: LeadState;
};

export type Persona = {
  id: string;
  name: string;
  style: string;
  bestFor: string;
  feature: boolean;
  accent: "sage" | "stone" | "warm";
  bio: string;
  stats: { tone: string; pace: string; length: string };
};

export type Campaign = {
  id: string;
  name: string;
  persona: string;
  leadIds: string[];
  brief: string;
  talkingPoints: string[];
  status: "running" | "draft";
};

export type CompanyData = {
  name: string;
  tagline: string;
  industry: string;
  website: string;
  socials: { linkedin: string; twitter: string };
  whatWeDo: string;
  valueProp: string;
  targetCustomer: string;
  pricing: Array<{ tier: string; price: string; detail: string }>;
  painPoints: string[];
};

export const SW_LEADS: Lead[] = [
  { id: "l01", name: "Mara Eriksen",     company: "Northwind Logistics",   phone: "+49 30 5510 1144",  state: "new" },
  { id: "l02", name: "Tomás Beltrán",    company: "Helio Solar GmbH",       phone: "+49 89 8821 0093",  state: "called" },
  { id: "l03", name: "Yui Nakagawa",     company: "Kintsugi Studio",        phone: "+81 3 4520 8810",   state: "scheduled" },
  { id: "l04", name: "Dario Conti",      company: "Salt & Cedar",           phone: "+39 02 9450 1290",  state: "new" },
  { id: "l05", name: "Priya Raman",      company: "Indigo Health",          phone: "+44 20 7946 0314",  state: "called" },
  { id: "l06", name: "Lukas Hoffmann",   company: "Tafel & Tisch",          phone: "+49 40 3290 4421",  state: "new" },
  { id: "l07", name: "Anaïs Léveque",    company: "Maison Ferré",           phone: "+33 1 7044 1259",   state: "scheduled" },
  { id: "l08", name: "Idris Okafor",     company: "Lagos Build Co.",        phone: "+234 1 270 4488",   state: "called" },
  { id: "l09", name: "Marta Janowska",   company: "Wolska Mleczarnia",      phone: "+48 22 415 7720",   state: "new" },
  { id: "l10", name: "Soren Vinter",     company: "Fjord Audio",            phone: "+45 33 14 22 90",   state: "new" },
  { id: "l11", name: "Hanna Lindqvist",  company: "Korsbär Konditori",      phone: "+46 8 410 99 21",   state: "called" },
  { id: "l12", name: "Felix Brandt",     company: "Kupfer & Kraft",         phone: "+49 221 7790 8120", state: "scheduled" },
  { id: "l13", name: "Camille Roux",     company: "Atelier Six",            phone: "+33 4 7220 5530",   state: "new" },
  { id: "l14", name: "Owen Pritchard",   company: "Dovetail Carpentry",     phone: "+44 161 220 8870",  state: "called" },
  { id: "l15", name: "Noor Saleh",       company: "Cedar & Salt Beirut",    phone: "+961 1 99 88 12",   state: "new" },
  { id: "l16", name: "Eira Hughes",      company: "Slate Roofing",          phone: "+44 29 2018 4422",  state: "scheduled" },
];

export const SW_STATE_LABEL: Record<LeadState, { label: string; dot: string }> = {
  new:       { label: "New",       dot: "var(--sw-muted)" },
  called:    { label: "Called",    dot: "var(--sw-accent)" },
  scheduled: { label: "Scheduled", dot: "var(--sw-warm)" },
};

export const SW_PERSONAS: Persona[] = [
  { id: "p1", name: "Margot", style: "The patient questioner.", bestFor: "Long sales cycles · Healthcare · Legal", feature: true, accent: "sage",
    bio: "Asks one question, waits the full beat, then asks a better one. Margot holds silence like a good therapist — most prospects fill it themselves.",
    stats: { tone: "Warm", pace: "Slow", length: "2:40 avg" } },
  { id: "p2", name: "Hideo", style: "The crisp closer.", bestFor: "Inbound replies · SaaS demos", feature: true, accent: "stone",
    bio: "Three sentences, one ask. Hideo skips small talk and lands the meeting before minute two — the conversation feels expensive on purpose.",
    stats: { tone: "Direct", pace: "Brisk", length: "1:15 avg" } },
  { id: "p3", name: "Soraya", style: "The empathic diagnostician.", bestFor: "Pain-led discovery · Field service", feature: false, accent: "sage",
    bio: "Listens for the small annoyance and reflects it back word-for-word. Prospects who hated cold calls usually book.",
    stats: { tone: "Warm", pace: "Even", length: "3:05 avg" } },
  { id: "p4", name: "Bram", style: "The dry technician.", bestFor: "Engineering buyers · DevTools", feature: false, accent: "stone",
    bio: "Speaks in specs, not adjectives. Bram opens with the integration question that the prospect has been quietly avoiding.",
    stats: { tone: "Neutral", pace: "Even", length: "2:00 avg" } },
  { id: "p5", name: "Iris", style: "The challenger.", bestFor: "Replacement plays · Mid-market", feature: false, accent: "warm",
    bio: "Names the incumbent in the first ten seconds and offers a side-by-side. Combative on paper, oddly likable on the line.",
    stats: { tone: "Direct", pace: "Brisk", length: "2:25 avg" } },
  { id: "p6", name: "Cyrus", style: "The host.", bestFor: "Events & roundtables · Community", feature: false, accent: "sage",
    bio: "Doesn't sell — invites. Frames every call as a small private dinner the prospect is welcome to join.",
    stats: { tone: "Warm", pace: "Even", length: "2:50 avg" } },
  { id: "p7", name: "Lena", style: "The renewal.", bestFor: "Win-back · Lapsed customers", feature: false, accent: "warm",
    bio: "Opens by remembering. Lena reads the past relationship aloud and asks what changed — disarms most quietly cancelled accounts.",
    stats: { tone: "Warm", pace: "Slow", length: "3:20 avg" } },
  { id: "p8", name: "Otto", style: "The auditor.", bestFor: "Procurement & compliance · Finance", feature: false, accent: "stone",
    bio: "Slow, exact, never rushed. Otto reads back numbers and asks for clarification — buyers in regulated industries trust him by minute one.",
    stats: { tone: "Neutral", pace: "Slow", length: "3:40 avg" } },
];

export const SW_CAMPAIGNS: Campaign[] = [
  {
    id: "c1", name: "Q2 Berlin agencies", persona: "p1",
    leadIds: ["l01", "l06", "l12"],
    brief: "Mid-size agencies in Berlin, 20–80 staff. Focus on after-hours coverage; avoid pricing on first call.",
    talkingPoints: [
      "Open with the after-hours pain point",
      "Reference Hermozi's grand-slam offer framing",
      "Schedule a 20-min audit, not a demo",
    ],
    status: "running",
  },
  {
    id: "c2", name: "Lapsed Studio plans", persona: "p7",
    leadIds: ["l05", "l11", "l14"],
    brief: "Customers who churned in the last 90 days. Lead with what changed in the product since they left.",
    talkingPoints: [
      "Acknowledge the churn reason if known",
      "Offer two months of Studio at the Quiet tier",
      "End the call with a calendar link, not a callback",
    ],
    status: "draft",
  },
  {
    id: "c3", name: "Solar GmbH outbound", persona: "p3",
    leadIds: ["l02", "l10", "l16"],
    brief: "DACH solar installers, 5–25 trucks. Owner-operated. They hate being sold to.",
    talkingPoints: [
      "Open with a route-density question",
      "Mirror their last sentence twice before pitching",
      "Book the second call, not the meeting",
    ],
    status: "running",
  },
];

export const SW_COMPANY: CompanyData = {
  name: "Stillwater",
  tagline: "Cold calls that close themselves.",
  industry: "Sales infrastructure · Voice AI",
  website: "stillwater.so",
  socials: { linkedin: "linkedin.com/company/stillwater", twitter: "x.com/stillwater_so" },
  whatWeDo: "Stillwater is a quiet workflow for outbound calling. An agent trained on offer frameworks dials your list, speaks with studio-clean audio, and hangs up before the second minute. Operators compose flows from three nodes: who we are, the agent, the call.",
  valueProp: "Replace the cold-call boiler room with a single calm dashboard. Same dials, a third of the headcount, fully transparent transcripts.",
  targetCustomer: "B2B teams running outbound between 200 and 5,000 dials a week — agencies, SaaS sales, recruiting firms, field-service operators.",
  pricing: [
    { tier: "Quiet",  price: "€0",   detail: "100 calls / month · transcripts only" },
    { tier: "Studio", price: "€480", detail: "2,500 calls / month · custom personas" },
    { tier: "Atlas",  price: "Talk", detail: "Unlimited · on-prem audio · SSO" },
  ],
  painPoints: [
    "SDRs burn out after 60 dials.",
    "Audio quality kills credibility on the first ring.",
    "Tooling fragments scripts, lists, and recordings across four tabs.",
    "Managers can't audit what was actually said.",
  ],
};
