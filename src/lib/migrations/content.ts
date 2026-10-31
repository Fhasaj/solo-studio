/*
 * @name: Content migrations
 * @description: Schema and data changes for content.sqlite (services, testimonials, case studies), applied in order.
 * */

import type Database from 'better-sqlite3';
import type { Migration } from '../migrate';
import { getDb } from '../dbConnect';
import { slugify } from '../slug';

const FREELANCE_SERVICES = [
  {
    title: 'Custom business systems',
    icon: 'dashboard',
    description:
      'Replace spreadsheets, paper job sheets and manual admin with one system built around how your business already works.',
    priceFrom: 'From £4,000',
    examples: 'Jobs, staff and scheduling\nTimesheets, wages and payroll\nQuotes, invoices and bank reconciliation\nCustomer, site and supplier records',
    tech: 'Next.js, Go, PostgreSQL',
  },
  {
    title: 'Mobile apps (Flutter)',
    icon: 'phone',
    description:
      'Apps for staff on site, on patrol or on the road. One app for iPhone and Android that keeps working offline and syncs when signal comes back.',
    priceFrom: 'From £6,000',
    examples: 'Check-ins and lone-worker welfare checks\nIncident and defect reports with photos\nDelivery and job status updates\nDigital forms and sign-offs',
    tech: 'Flutter, Dart',
  },
  {
    title: 'Fixing and extending existing systems',
    icon: 'build',
    description:
      "Already have software that's slow, unreliable or missing something? I'll find what's wrong, fix it and add what you need, without starting from scratch.",
    priceFrom: 'From £750',
    examples: 'Bugs and performance problems\nNew features and integrations\nMoving to better or cheaper hosting\nDatabase clean-ups and migrations',
    tech: 'TypeScript, Go, PostgreSQL, Docker',
  },
];

// One example draft showing the structure. Square-bracket text marks what to write; it can't be published until replaced.
const CASE_STUDY_DRAFTS = [
  {
    slug: 'example-job-management-system',
    title: 'Example: job management system for a trades business',
    clientName: '[Client name, or leave empty]',
    industry: 'Construction',
    summary: '[One or two sentences: who the client is, what you built and the main result.]',
    problem: '[How did they work before? What was slow, error-prone or costly?]',
    solution: '[What you built.]\n\n- [Feature]\n- [Feature]\n- [How it is hosted and supported]',
    results: '- [A measurable result, e.g. hours saved each week]\n- [Another outcome]',
    tech: 'Next.js, PostgreSQL',
  },
];


const SERVICE_PAGES: Record<string, string> = {
  'Custom business systems': `Most small businesses run on a mix of spreadsheets, paper forms, WhatsApp groups and off-the-shelf tools that don't quite fit. It works until it doesn't: jobs get missed, wages take a day to work out, and only one person knows how the spreadsheet works.

I build a single system around how your business already runs, so your team spends less time on admin and you can see what's going on at a glance.

## What it can cover
- Jobs, customers, sites and scheduling
- Staff records, timesheets, wages and payroll
- Quotes, invoices and bank reconciliation
- Stock, suppliers and purchase orders
- Reports and dashboards for the numbers you check every week

## How it works
We start with a free call, then a short discovery stage where we map your current process and agree the screens. You see it working early and test it with real data before it goes live. I move your existing data across, train your team and look after it afterwards.

## Built to last
Systems are built with Next.js, Go and PostgreSQL, hosted on UK or EU servers and designed with UK GDPR in mind from the start. You own the code once the final payment is made.`,
  'Mobile apps (Flutter)': `If your staff work on site, on patrol or on the road, a mobile app beats paper forms and phone calls. I build apps for iPhone and Android from one codebase, so you get both for the price of one.

## Typical uses
- Check-ins, shift start and finish, and lone-worker welfare checks
- Incident, defect and damage reports with photos
- Delivery and job status updates with signatures
- Digital checklists and sign-offs that land in your office system straight away

## Works where signal doesn't
Apps are built to work offline and sync when the connection comes back, which matters in basements, rural sites and lorries.

## From prototype to the app stores
You see a clickable prototype before any building starts, then test real builds on your own phones. I publish the app to the App Store and Google Play under your own accounts, so it stays yours.`,
  'Fixing and extending existing systems': `You don't always need something new. If you already have software that's slow, unreliable or missing a feature, I can work on it directly.

## Common jobs
- Tracking down bugs and fixing performance problems
- Adding features, reports or integrations with other tools
- Moving to better or cheaper hosting, with backups that actually run
- Database clean-ups and migrations, for example MySQL to PostgreSQL

## How it works
I start by reviewing the code and hosting, then give you a fixed quote for the work. Smaller jobs are paid half up front and half on delivery. If the original developer has disappeared, that's fine: I'm used to picking up other people's code.`,
}

const INDUSTRIES = [
  {
    name: 'Construction and trades',
    intro: 'Software for builders, contractors and trades businesses that are outgrowing spreadsheets for jobs, staff and payments.',
    problems: 'Wages and timesheets worked out by hand every week\nJobs, quotes and invoices spread across spreadsheets and email\nNo quick view of which jobs are making money\nBank payments matched to invoices one by one',
    details: `Construction and trades businesses have a lot of moving parts: crews on different sites, subcontractors, materials, staged payments and clients who want updates. Generic software tends to cover half of it.

## What a system can do for you
- Track jobs from quote to final invoice
- Record hours by site and work out wages automatically
- Match bank payments to invoices
- Show profit by job, client and month`,
    matchIndustry: 'Construction',
  },
  {
    name: 'Logistics and transport',
    intro: 'Apps and systems for hauliers, couriers and logistics firms that need drivers, jobs and paperwork in one place.',
    problems: 'Delivery notes and proof of delivery on paper\nDrivers phoning in for job updates\nVehicle checks recorded inconsistently\nInvoices delayed waiting for paperwork',
    details: `In logistics, time spent chasing paperwork is time not spent moving goods. A driver app and an office system that talk to each other remove most of it.

## What it can cover
- Driver apps for job lists, status updates, photos and signatures
- Daily vehicle checks with defects flagged straight to the office
- Proof of delivery available the moment the job is done
- Invoicing that starts as soon as a job is complete`,
    matchIndustry: 'Logistics',
  },
];

const FAQS = [
  ['How much does custom software cost?', "It depends on what you need. Small fixes and additions to an existing system can be a few hundred pounds, while a full business system is usually several thousand. After a free call you get a fixed quote, so you know the cost before anything starts. You pay in stages as the work is delivered."],
  ['How long does a project take?', 'Most business systems take between 6 and 12 weeks from the first call to going live, depending on size. You see working screens within the first few weeks and can follow progress in your client portal throughout.'],
  ['Do I own the code?', 'Yes. Once the final payment is made, the code and documentation are yours and are handed over through your client portal. You are never locked in to me.'],
  ['Can you host it for me?', "Yes. I can host and look after it on UK or EU servers for a monthly fee covering the server, backups, security updates and monitoring. If you'd rather host it yourself, I'll hand it over and help with the setup."],
  ['What happens after the system goes live?', 'Every project includes 6 months of support after launch, covering bug fixes and help. After that you can choose a monthly support plan, or just get in touch when you need something.'],
  ['Is it UK GDPR compliant?', 'Systems are designed with UK GDPR in mind from the start: data is stored on UK or EU servers, access is limited to the people who need it, and sensitive information like photos and personal records is kept separate and secured.'],
  ['Do you only work with local businesses?', 'No. Most of the work happens remotely by phone, video and the client portal, so I can work with businesses anywhere in the UK, and visit when it helps.'],
  ['Can you fix or add to our existing system?', "Yes. I'll review your current code and hosting first, then give you a fixed quote for the work. It doesn't matter if the original developer is no longer around."],
]

function tableExists(db: Database.Database, table: string) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

export const contentMigrations: Migration[] = [
  {
    // The old services were written for job hunting. Hide (not delete) them and add the freelance ones first.
    id: '2026-10-30-freelance-services',
    up: (db) => {
      db.prepare('UPDATE services SET isHidden = 1, sortOrder = sortOrder + ?').run(FREELANCE_SERVICES.length);
      const insert = db.prepare(
        'INSERT INTO services (title, icon, description, priceFrom, examples, tech, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      FREELANCE_SERVICES.forEach((s, index) => insert.run(s.title, s.icon, s.description, s.priceFrom, s.examples, s.tech, index));
    },
  },
  {
    // Testimonials move from testimonial.sqlite into the shared content tables, keeping their visibility
    id: '2026-10-30-import-testimonials',
    up: (db) => {
      const legacy = getDb('testimonial');
      if (!tableExists(legacy, 'testimonial')) return;
      const rows = legacy.prepare('SELECT text, name, jobTitle, isHidden FROM testimonial ORDER BY id').all() as Array<{
        text: string;
        name: string;
        jobTitle: string | null;
        isHidden: number;
      }>;
      const insert = db.prepare('INSERT INTO testimonials (quote, name, role, sortOrder, isHidden) VALUES (?, ?, ?, ?, ?)');
      rows.forEach((row, index) => insert.run(row.text, row.name, row.jobTitle ?? '', index, row.isHidden ? 1 : 0));
    },
  },
  {
    id: '2026-10-30-case-studies',
    up: (db) => {
      db.exec(`
        CREATE TABLE case_studies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          clientName TEXT NOT NULL DEFAULT '',
          industry TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '',
          problem TEXT NOT NULL DEFAULT '',
          solution TEXT NOT NULL DEFAULT '',
          results TEXT NOT NULL DEFAULT '',
          tech TEXT NOT NULL DEFAULT '',
          coverSrc TEXT NOT NULL DEFAULT '',
          coverAlt TEXT NOT NULL DEFAULT '',
          coverWidth INTEGER NOT NULL DEFAULT 0,
          coverHeight INTEGER NOT NULL DEFAULT 0,
          featured INTEGER NOT NULL DEFAULT 0,
          sortOrder INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
          seoTitle TEXT NOT NULL DEFAULT '',
          seoDescription TEXT NOT NULL DEFAULT '',
          publishedAt DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE case_study_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          caseStudyId INTEGER NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
          src TEXT NOT NULL,
          alt TEXT NOT NULL,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          sortOrder INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX case_study_images_case_study ON case_study_images (caseStudyId, sortOrder);

        -- Old slugs, so renamed case studies keep working through a 301 redirect
        CREATE TABLE case_study_redirects (
          oldSlug TEXT PRIMARY KEY,
          caseStudyId INTEGER NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE
        );
      `);
    },
  },
  {
    id: '2026-10-30-seed-case-studies',
    up: (db) => {
      const insert = db.prepare(`
        INSERT INTO case_studies (slug, title, clientName, industry, summary, problem, solution, results, tech, featured, sortOrder, status)
        VALUES (@slug, @title, @clientName, @industry, @summary, @problem, @solution, @results, @tech, 1, @sortOrder, 'draft')
      `);
      CASE_STUDY_DRAFTS.forEach((draft, sortOrder) => insert.run({ ...draft, sortOrder }));
    },
  },
  {
    // Service and industry pages, and FAQs, for search engines and AI answers
    id: '2026-11-01-seo-content',
    up: (db) => {
      const services = db.prepare("SELECT id, title FROM services WHERE slug = ''").all() as { id: number; title: string }[];
      const setSlug = db.prepare('UPDATE services SET slug = ? WHERE id = ?');
      const taken = new Set<string>();
      for (const service of services) {
        let slug = slugify(service.title) || `service-${service.id}`;
        if (taken.has(slug)) slug = `${slug}-${service.id}`;
        taken.add(slug);
        setSlug.run(slug, service.id);
      }
      const setDetails = db.prepare("UPDATE services SET details = ? WHERE title = ? AND details = ''");
      for (const [title, details] of Object.entries(SERVICE_PAGES)) setDetails.run(details, title);

      const insertIndustry = db.prepare(
        'INSERT INTO industries (name, slug, intro, problems, details, matchIndustry, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      INDUSTRIES.forEach((i, index) => insertIndustry.run(i.name, slugify(i.name), i.intro, i.problems, i.details, i.matchIndustry, index));

      const insertFaq = db.prepare('INSERT INTO faqs (question, answer, sortOrder) VALUES (?, ?, ?)');
      FAQS.forEach(([question, answer], index) => insertFaq.run(question, answer, index));
    },
  },
];
