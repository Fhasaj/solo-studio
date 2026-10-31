/*
 * @name: Site Content
 * @description: The editable content types shown on the home page. Shared by the API, the admin panel and the site.
 * */

export type FieldType = "text" | "textarea" | "lines" | "tags" | "icon" | "caseStudy" | "slug";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export const CONTENT_TYPES = {
  services: {
    label: "Services",
    fields: [
      { name: "title", label: "Service name", type: "text", required: true, maxLength: 80 },
      { name: "slug", label: "Page address (/services/…)", type: "slug", placeholder: "Made from the name if left empty" },
      { name: "icon", label: "Icon", type: "icon" },
      { name: "description", label: "Description", type: "textarea", maxLength: 400 },
      { name: "priceFrom", label: "Starting price (optional)", type: "text", placeholder: "e.g. From £4,000", maxLength: 40 },
      { name: "examples", label: "Examples (one per line)", type: "lines", maxLength: 1000 },
      { name: "tech", label: "Tech (comma separated)", type: "tags", maxLength: 300 },
      { name: "details", label: "Full page text (optional: gives the service its own page)", type: "textarea", maxLength: 8000, placeholder: "Blank line between paragraphs, \"## \" for headings, \"- \" for bullets" },
      { name: "seoDescription", label: "Meta description for its page (optional)", type: "text", maxLength: 170 },
    ],
  },
  industries: {
    label: "Industries",
    fields: [
      { name: "name", label: "Industry", type: "text", required: true, maxLength: 80, placeholder: "Security companies" },
      { name: "slug", label: "Page address (/industries/…)", type: "slug", placeholder: "Made from the name if left empty" },
      { name: "intro", label: "Intro (one or two sentences)", type: "textarea", required: true, maxLength: 400 },
      { name: "problems", label: "Problems you solve (one per line)", type: "lines", maxLength: 1500 },
      { name: "details", label: "Full page text", type: "textarea", maxLength: 8000, placeholder: "Blank line between paragraphs, \"## \" for headings, \"- \" for bullets" },
      { name: "matchIndustry", label: "Case studies to show (their industry contains)", type: "text", maxLength: 80, placeholder: "e.g. Security" },
      { name: "seoDescription", label: "Meta description (optional)", type: "text", maxLength: 170 },
    ],
  },
  faqs: {
    label: "FAQs",
    fields: [
      { name: "question", label: "Question", type: "text", required: true, maxLength: 200 },
      { name: "answer", label: "Answer", type: "textarea", required: true, maxLength: 2000 },
    ],
  },
  testimonials: {
    label: "Testimonials",
    fields: [
      { name: "quote", label: "Quote", type: "textarea", required: true, maxLength: 1200 },
      { name: "name", label: "Name", type: "text", required: true, maxLength: 100 },
      { name: "role", label: "Role and company", type: "text", placeholder: "Director, Example Ltd", maxLength: 150 },
      { name: "caseStudyId", label: "Linked case study (optional)", type: "caseStudy" },
    ],
  },
} satisfies Record<string, { label: string; fields: FieldConfig[] }>;

export type ContentType = keyof typeof CONTENT_TYPES;

export function isContentType(value: unknown): value is ContentType {
  return typeof value === "string" && value in CONTENT_TYPES;
}

// Raw row as stored in SQLite: every content field is a string
export interface ContentRow {
  id: number;
  sortOrder: number;
  isHidden: boolean;
  [field: string]: string | number | boolean;
}

export function splitLines(value: unknown): string[] {
  return String(value ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
}

export function splitTags(value: unknown): string[] {
  return String(value ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
}
