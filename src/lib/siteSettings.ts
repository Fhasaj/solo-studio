/*
 * @name: Site Settings
 * @description: The editable settings (hero text, pricing, booking hours, contract template).
 * Shared by the settings API, the admin settings page and the site. Values are stored as strings.
 * */

import { DEFAULT_CONTRACT_TEMPLATE } from './contractTemplate';

export type SettingType = 'text' | 'textarea' | 'number' | 'url' | 'email' | 'hours' | 'dates' | 'select' | 'date';

export interface SettingField {
  key: string;
  label: string;
  type: SettingType;
  group: SettingGroup;
  help?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: { regex: RegExp; message: string };
  // For 'select': [value, label] pairs
  options?: readonly (readonly [string, string])[];
}

export const SETTING_GROUPS = {
  profile: { label: 'Your details', description: 'Who you are and where you work. Used across the site, in search results and in emails.' },
  homepage: { label: 'Homepage', description: 'The first thing visitors read.' },
  pricing: { label: 'Pricing & support', description: 'Shown in the pricing section and used in contracts.' },
  tax: {
    label: 'Tax and VAT',
    description: 'Used for your bookkeeping, tax estimates and VAT figures under Money. Estimates only: check them with an accountant.',
  },
  payments: {
    label: 'Card payments (Stripe)',
    description:
      "Bank transfer is always offered and has no fee. Card payment can be switched on per job. UK law only allows passing card fees on for business cards, never personal ones, and only up to what the fee costs you.",
  },
  contact: { label: 'Contact', description: 'Where enquiries and booking notifications go.' },
  booking: { label: 'Booking calls', description: 'When people can book a free call. All times are UK time.' },
  business: { label: 'Business details', description: 'Your name and address as they appear in contracts.' },
  cv: { label: 'CV', description: 'Write or upload your CV in Markdown. It becomes a page at /cv and a downloadable PDF at /cv.pdf. Switch it on under Site sections.' },
  contract: { label: 'Contract template', description: 'Starting text for new contracts. Placeholders in {{double braces}} are filled in for each project.' },
} as const;

export type SettingGroup = keyof typeof SETTING_GROUPS;

const HOURS_HELP = 'e.g. 09:00-17:00, or 12:00-13:00, 17:30-19:00. Leave empty for no calls that day.';

export const SETTING_FIELDS = [
  { key: 'siteName', label: 'Brand name (header, page titles, emails)', type: 'text', group: 'profile', maxLength: 80 },
  { key: 'ownerName', label: 'Your full name', type: 'text', group: 'profile', maxLength: 80 },
  { key: 'town', label: 'Town or city you work from', type: 'text', group: 'profile', maxLength: 80 },
  { key: 'region', label: 'County or region (optional)', type: 'text', group: 'profile', maxLength: 80 },
  { key: 'areaServed', label: 'Countries you work in (comma separated)', type: 'text', group: 'profile', maxLength: 200 },
  { key: 'freelancingSince', label: 'Freelancing since (year)', type: 'number', group: 'profile', min: 1980, max: 2100 },
  { key: 'siteTitle', label: 'Home page title (search results)', type: 'text', group: 'profile', maxLength: 70 },
  { key: 'siteDescription', label: 'Home page description (search results)', type: 'textarea', group: 'profile', maxLength: 170 },
  { key: 'aboutHeading', label: 'About section heading', type: 'text', group: 'profile', maxLength: 80 },
  { key: 'aboutText', label: 'About you', type: 'textarea', group: 'profile', maxLength: 2000, help: 'A short story: your background and why clients can trust you. Blank line between paragraphs.' },
  { key: 'aboutImage', label: 'Photo or illustration for the about section (optional)', type: 'text', group: 'profile', maxLength: 200, placeholder: '/images/about.png', help: 'A path under /public, e.g. /images/about.png. Leave empty for no image.' },
  { key: 'qualifications', label: 'Qualifications (one per line: Qualification | Where)', type: 'textarea', group: 'profile', maxLength: 1000, help: 'Shown to search engines as your credentials, e.g. BSc Computer Science | University of London' },
  { key: 'knowsAbout', label: 'Skills and specialisms (comma separated)', type: 'text', group: 'profile', maxLength: 500 },
  { key: 'linkedinUrl', label: 'LinkedIn profile (optional)', type: 'url', group: 'profile' },
  { key: 'githubUrl', label: 'GitHub profile (optional)', type: 'url', group: 'profile' },
  { key: 'heroBadge', label: 'Small line above the headline', type: 'text', group: 'homepage', maxLength: 100 },
  { key: 'heroHeadline', label: 'Headline', type: 'text', group: 'homepage', maxLength: 120 },
  { key: 'heroSubheading', label: 'Subheading', type: 'textarea', group: 'homepage', maxLength: 300 },

  { key: 'pricingFrom', label: 'Projects typically start from (whole amount)', type: 'number', group: 'pricing', min: 0, max: 1_000_000 },
  { key: 'pricingNote', label: 'Pricing note', type: 'textarea', group: 'pricing', maxLength: 500 },
  { key: 'dayRate', label: 'Day rate for changes and extra work (whole amount)', type: 'number', group: 'pricing', min: 0, max: 10_000 },
  { key: 'hostingPrice', label: 'Hosting and maintenance (from, per month)', type: 'number', group: 'pricing', min: 0, max: 10_000, help: 'Shown in the pricing section. Set the actual fee on each job.' },
  { key: 'hostingMarkupPercent', label: 'Markup on hosting costs (%)', type: 'number', group: 'pricing', min: 0, max: 200, help: "A job's hosting fee is its server and running costs plus this percentage." },
  { key: 'depositPercent', label: 'Deposit before work starts (%)', type: 'number', group: 'pricing', min: 0, max: 100 },
  { key: 'supportMonths', label: 'Free support after launch (months)', type: 'number', group: 'pricing', min: 0, max: 36 },
  { key: 'supportBasicPrice', label: 'Extended support: standard plan (per month)', type: 'number', group: 'pricing', min: 0, max: 10_000 },
  { key: 'supportBasicHours', label: 'Standard plan hours per month', type: 'number', group: 'pricing', min: 0, max: 200 },
  { key: 'supportPriorityPrice', label: 'Extended support: priority plan (per month)', type: 'number', group: 'pricing', min: 0, max: 10_000 },
  { key: 'supportPriorityHours', label: 'Priority plan hours per month', type: 'number', group: 'pricing', min: 0, max: 200 },

  { key: 'taxCountry', label: 'Where you pay tax', type: 'select', group: 'tax', options: [['uk', 'UK (England, Wales or Northern Ireland)'], ['uk-scotland', 'UK, as a Scottish taxpayer'], ['ie', 'Ireland']] },
  { key: 'otherIncome', label: 'Other income this tax year, e.g. a salary (whole amount)', type: 'number', group: 'tax', min: 0, max: 10_000_000, help: 'Pushes your business profit into the right tax bands. Tax on that income is assumed to be paid already.' },
  { key: 'homeOfficeBand', label: 'Working from home (UK flat rate)', type: 'select', group: 'tax', options: [['none', 'Not claiming'], ['25', '25 to 50 hours a month (£10/month)'], ['51', '51 to 100 hours a month (£18/month)'], ['101', '101+ hours a month (£26/month)']] },
  { key: 'mtdQuarters', label: 'Making Tax Digital quarters (UK)', type: 'select', group: 'tax', options: [['standard', 'Standard (6 April to 5 July, …)'], ['calendar', 'Calendar quarters (1 April to 30 June, …)']] },
  { key: 'mileageRateIe', label: 'Mileage rate (Ireland, cents per km)', type: 'number', group: 'tax', min: 0, max: 200, help: 'UK mileage uses the HMRC rates automatically.' },
  { key: 'vatRegistered', label: 'VAT registered', type: 'select', group: 'tax', options: [['no', 'No'], ['yes', 'Yes']] },
  { key: 'vatNumber', label: 'VAT number', type: 'text', group: 'tax', maxLength: 20, placeholder: 'GB123456789 or IE1234567X' },
  { key: 'vatRegisteredFrom', label: 'VAT registered from', type: 'date', group: 'tax' },
  { key: 'vatScheme', label: 'VAT scheme', type: 'select', group: 'tax', options: [['invoice', 'Standard (on invoices issued)'], ['cash', 'Cash accounting (on money received)'], ['flat_rate', 'Flat Rate Scheme (UK)']] },
  { key: 'vatFlatRatePercent', label: 'Flat rate percentage (UK)', type: 'text', group: 'tax', placeholder: '16.5', help: '16.5% if you are a limited cost trader (most freelance developers); 14.5% for IT consultancy otherwise. 1% off in your first year.', pattern: { regex: /^(\d{1,2}(\.\d{1,2})?)?$/, message: 'Enter a percentage like 16.5' } },
  { key: 'vatQuarterEnds', label: 'VAT quarters end in (UK)', type: 'select', group: 'tax', options: [['mar', 'March, June, September, December'], ['apr', 'April, July, October, January'], ['may', 'May, August, November, February']], help: 'Ireland uses two-month periods (January–February, …) automatically.' },
  { key: 'cardFeePercent', label: 'Stripe fee: percentage', type: 'text', group: 'payments', placeholder: '1.5', help: 'Check your Stripe pricing page. 1.5% is the usual rate for UK cards.', pattern: { regex: /^\d{1,2}(\.\d{1,2})?$/, message: 'Enter a percentage like 1.5' } },
  { key: 'cardFeeFixedPence', label: 'Stripe fee: fixed part (pence)', type: 'number', group: 'payments', min: 0, max: 500 },
  { key: 'cardFeeCap', label: 'Most card fee a client pays (whole amount)', type: 'number', group: 'payments', min: 0, max: 1000, help: 'Above this you absorb the rest. 0 = you absorb all card fees.' },
  { key: 'contactEmail', label: 'Contact email', type: 'email', group: 'contact', help: 'Shown on the site and receives booking, payment and contract notifications.' },
  { key: 'contactPhone', label: 'Phone number (optional)', type: 'text', group: 'contact', maxLength: 30, placeholder: '07…' },

  { key: 'bookingVideoLink', label: 'Video call link (optional)', type: 'url', group: 'booking', placeholder: 'https://meet.google.com/…', help: 'If empty, people who choose a video call are told you will send a link.' },
  { key: 'bookingSlotMinutes', label: 'Call length (minutes)', type: 'number', group: 'booking', min: 10, max: 120 },
  { key: 'bookingBufferMinutes', label: 'Gap between calls (minutes)', type: 'number', group: 'booking', min: 0, max: 120 },
  { key: 'bookingMinNoticeHours', label: 'Minimum notice (hours)', type: 'number', group: 'booking', min: 0, max: 336 },
  { key: 'bookingHorizonDays', label: 'How far ahead people can book (days)', type: 'number', group: 'booking', min: 1, max: 120 },
  { key: 'bookingHoursMon', label: 'Monday', type: 'hours', group: 'booking', help: HOURS_HELP },
  { key: 'bookingHoursTue', label: 'Tuesday', type: 'hours', group: 'booking' },
  { key: 'bookingHoursWed', label: 'Wednesday', type: 'hours', group: 'booking' },
  { key: 'bookingHoursThu', label: 'Thursday', type: 'hours', group: 'booking' },
  { key: 'bookingHoursFri', label: 'Friday', type: 'hours', group: 'booking' },
  { key: 'bookingHoursSat', label: 'Saturday', type: 'hours', group: 'booking' },
  { key: 'bookingHoursSun', label: 'Sunday', type: 'hours', group: 'booking' },
  { key: 'bookingBlockedDates', label: 'Days off (one date per line)', type: 'dates', group: 'booking', placeholder: '2026-12-25', help: 'No calls can be booked on these dates.' },

  { key: 'businessName', label: 'Your name as a sole trader', type: 'text', group: 'business', maxLength: 120 },
  { key: 'businessAddress', label: 'Business address', type: 'textarea', group: 'business', maxLength: 300, help: 'Required in contracts.' },

  { key: 'cvMarkdown', label: 'CV (Markdown)', type: 'textarea', group: 'cv', maxLength: 40_000, help: '# Your name, ## Section, ### Job title, - bullet points, **bold**, [link](https://…)' },
  { key: 'contractTemplate', label: 'Contract template', type: 'textarea', group: 'contract', maxLength: 40_000 },
] as const satisfies readonly SettingField[];

export type SettingKey = (typeof SETTING_FIELDS)[number]['key'];
export type SiteSettings = Record<SettingKey, string>;

export const SETTING_DEFAULTS: SiteSettings = {
  siteName: 'Your Name',
  ownerName: 'Your Name',
  town: 'Your Town',
  region: '',
  areaServed: 'United Kingdom',
  freelancingSince: '2020',
  siteTitle: 'Custom software for small businesses',
  siteDescription:
    'Freelance software developer building custom business systems and mobile apps for small and medium businesses across the UK.',
  aboutHeading: 'About me',
  aboutText:
    "Tell visitors who you are: your background, what you've built and why clients can trust you to build theirs.\n\nKeep it short and personal. Edit this in Admin → Settings → Your details.",
  aboutImage: '',
  qualifications: '',
  knowsAbout: 'Custom business software, Mobile app development, Next.js, Flutter, PostgreSQL, UK GDPR',
  linkedinUrl: '',
  githubUrl: '',
  heroBadge: 'Working with businesses across the UK',
  heroHeadline: 'Custom software for small and medium businesses',
  heroSubheading:
    'I replace the spreadsheets, paper forms and WhatsApp threads that run your business with simple systems your team will actually use. Built, hosted and supported by me.',

  pricingFrom: '3000',
  pricingNote:
    'Every project gets a fixed quote after a free call, so you know the cost up front. You pay in stages as the work is delivered, and every project includes 6 months of support after launch.',
  dayRate: '425',
  hostingPrice: '40',
  hostingMarkupPercent: '10',
  depositPercent: '25',
  supportMonths: '6',
  supportBasicPrice: '120',
  supportBasicHours: '2',
  supportPriorityPrice: '250',
  supportPriorityHours: '5',

  taxCountry: 'uk',
  otherIncome: '0',
  homeOfficeBand: 'none',
  mtdQuarters: 'standard',
  mileageRateIe: '0',
  vatRegistered: 'no',
  vatNumber: '',
  vatRegisteredFrom: '',
  vatScheme: 'invoice',
  vatFlatRatePercent: '16.5',
  vatQuarterEnds: 'mar',

  cardFeePercent: '1.5',
  cardFeeFixedPence: '20',
  cardFeeCap: '25',

  contactEmail: 'hello@example.com',
  contactPhone: '',

  bookingVideoLink: '',
  bookingSlotMinutes: '20',
  bookingBufferMinutes: '10',
  bookingMinNoticeHours: '24',
  bookingHorizonDays: '30',
  bookingHoursMon: '09:00-17:00',
  bookingHoursTue: '09:00-17:00',
  bookingHoursWed: '09:00-17:00',
  bookingHoursThu: '09:00-17:00',
  bookingHoursFri: '09:00-17:00',
  bookingHoursSat: '',
  bookingHoursSun: '',
  bookingBlockedDates: '',

  businessName: 'Your Name',
  businessAddress: '',

  cvMarkdown: `# Your Name

Freelance software developer · Your Town · [hello@example.com](mailto:hello@example.com)

## Summary

A couple of sentences about what you do and who you do it for.

## Experience

### Freelance software developer · 2020 to present

- What you built, for whom, and the result
- Another project with a measurable outcome

## Skills

- **Languages:** TypeScript, Go, SQL
- **Tools:** Next.js, Flutter, PostgreSQL, Docker

## Education

### BSc Computer Science · University, 2020`,
  contractTemplate: DEFAULT_CONTRACT_TEMPLATE,
};

export function isSettingKey(key: unknown): key is SettingKey {
  return typeof key === 'string' && key in SETTING_DEFAULTS;
}

// "09:00-12:00, 13:00-17:00" → [{ start: "09:00", end: "12:00" }, …]; throws on bad input
export function parseHours(value: string) {
  if (!value.trim()) return [];
  return value.split(',').map((range) => {
    const match = /^\s*([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)\s*$/.exec(range);
    if (!match) throw new Error(`"${range.trim()}" isn't a time range like 09:00-17:00`);
    const start = `${match[1]}:${match[2]}`;
    const end = `${match[3]}:${match[4]}`;
    if (end <= start) throw new Error(`"${range.trim()}" ends before it starts`);
    return { start, end };
  });
}
