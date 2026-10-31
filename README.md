# Solo Studio

**Your freelance website and back office in one app.** A fast, SEO-ready website that wins clients, plus everything you need to run the work: bookings, a client portal, contracts, staged payments, invoices and a secure code handover. Built for UK freelance developers. Self-hosted, so your data stays yours.

## What's included

**Website**
- Homepage with services, case studies, testimonials, pricing, about, FAQ and contact
- Case study pages, service pages and industry pages, all editable in the admin
- Server-rendered, Lighthouse 98–100, with structured data (Person, ProfessionalService, Article, Service, FAQPage, BreadcrumbList), sitemap, robots.txt, `llms.txt` for AI tools and instant indexing (IndexNow)

**Bookings**
- A public booking page for free calls (phone or video) in UK time, with your working hours, buffers and days off
- Confirmation emails with calendar invites and cancel links
- Admin list and month calendar

**Client portal**
- Passwordless sign-in by email link
- Progress timeline, costs, invoices and updates per project
- Contracts signed online with a full audit trail (name, time, IP, document fingerprint)
- Bank transfer details, an "I've paid" button, optional Stripe card payments
- Code and documents handed over, encrypted, once the final payment arrives

**Running the work**
- Clients, jobs and milestones, with templates for common job types
- "Pay before each stage" or "pay on delivery", enforced by the server
- Numbered invoices (milestones and hosting), printable, marked paid automatically
- Hosting fees worked out from your real costs plus your markup
- A dashboard showing what's in progress, ready to start, waiting for payment or a contract

**Security**
- Admin sign-in with password plus an emailed one-time code
- Bank details encrypted in the database and only shown after an emailed code
- Every admin and portal route checked on the server; client data scoped to its owner
- Rate limits, input validation, no user HTML ever rendered

## Stack

Next.js 16 (App Router pages, Pages Router API), React 19, TypeScript, Tailwind CSS 4, SQLite (better-sqlite3) with built-in migrations, sharp for images, nodemailer for email, Stripe (optional). No external database or services required.

## Quick start

```bash
git clone https://github.com/Fhasaj/solo-studio.git
cd solo-studio
npm install
cp .env.example .env          # fill in at least ADMIN_PASSWORD, ADMIN_EMAIL and SECRET_KEY
npm run dev
```

Open http://localhost:3000/admin, sign in with `ADMIN_PASSWORD`, then enter the 6-digit code. In development, if email isn't set up, the code is printed in the terminal.

Then, in the admin:
1. **Settings → Your details**: your name, town, about text, qualifications and links. These drive the whole site, search results and emails.
2. **Settings → Business details and Bank details**: used on contracts and invoices.
3. **Services, Industries, FAQs, Case studies**: replace the example content (case studies can't be published while they still contain `[placeholder]` text).
4. Replace `public/images/logo.png`, `public/images/og-image.png` (1200×630) and `src/app/icon.png`.

## Configuration

All environment variables are documented in [`.env.example`](.env.example). The important ones:

| Variable | Purpose |
|---|---|
| `SITE_URL` | Your public address, used in links, the sitemap and emails |
| `ADMIN_PASSWORD`, `ADMIN_EMAIL` | Admin sign-in; codes go to `ADMIN_EMAIL`, which can't be changed from the admin |
| `SECRET_KEY` | Signs sessions (32+ characters) |
| `DATA_ENCRYPTION_KEY` | Encrypts bank details and code handovers. **Back it up**: without it that data can't be read |
| `EMAIL_*` | SMTP for all emails |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional card payments |

Colours and fonts live in `src/app/globals.css` (`@theme`). Content types are defined in `src/lib/content.ts`, settings in `src/lib/siteSettings.ts`, and the contract template in `src/lib/contractTemplate.ts` (also editable in the admin).

## Deploying

A production `Dockerfile` is included (Next.js standalone output, runs as a non-root user). Mount two persistent volumes:

- `/app/db`: the SQLite databases and encrypted code handovers
- `/app/uploads`: case study images

Migrations run automatically on start. Put it behind a reverse proxy with HTTPS (Traefik, Caddy, Coolify, Cloudflare). Uploads are limited to 100 MB to fit Cloudflare's limit.

For Stripe, add a webhook for `https://your-domain/api/stripe/webhook` with the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.

## Testing

```bash
npm run build
npm test
```

This starts the production build on a fresh temporary database, with a local mail catcher and Stripe test secrets, and runs:

- **Smoke test**: a fresh install works and settings drive the site
- **End-to-end flows** (170+ checks): sign-in codes, uploads, publishing, bookings, the client portal, contracts, payments (bank and Stripe webhooks), invoices and the encrypted code handover
- **Access control** (240 checks): every admin and portal page and API refuses no session, an expired session and a forged one

## Things to know

- **Built for the UK**: prices in pounds, UK time, UK GDPR wording, and a contract template under the law of England and Wales.
- **The contract template and privacy notice are starting points, not legal advice.** Have them reviewed.
- **Card fees**: UK law only allows passing card fees on for business cards. Clients choose business or personal card at checkout, and personal cards are never charged a fee.
- **Address search** uses free open data (postcodes.io and OpenStreetMap), so it won't have every house number.

## Licence

Solo Studio is dual-licensed:

- **[GNU AGPL-3.0](LICENSE)**, free. You can use, change and self-host it. If you run a modified version that others use over a network, you must publish your changes under the same licence.
- **[Commercial licence](COMMERCIAL-LICENSE.md)**, paid. Use it without the AGPL obligations, for example keeping your changes private or offering it to clients as part of your services.

Copyright © 2026 Fatlum Hasaj. Contributions are welcome under the terms in [CONTRIBUTING.md](CONTRIBUTING.md).
