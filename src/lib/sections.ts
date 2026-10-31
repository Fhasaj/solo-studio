/*
 * @name: Site Sections
 * @description: The sections of the public site that can be switched on and off from the admin panel.
 * */

export const SECTION_DEFAULTS = {
  services: true,
  work: true,
  testimonials: true,
  pricing: true,
  faq: true,
  cv: false,
} as const;

export type SectionKey = keyof typeof SECTION_DEFAULTS;
export type SectionVisibility = Record<SectionKey, boolean>;

export function isSectionKey(key: unknown): key is SectionKey {
  return typeof key === "string" && key in SECTION_DEFAULTS;
}
