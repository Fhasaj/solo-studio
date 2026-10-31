/*
 * @name: Project presets
 * @description: Starting milestones and scope for common kinds of job. The deposit uses the deposit percentage
 * from Settings; the other stages share what's left. Every stage must be paid before the next one starts.
 * */

import type { HostingCost, MilestoneInput } from './query/clients.query';

interface PresetStage {
  title: string;
  description: string;
  // Share of the price left after the deposit; the last stage takes whatever remains, so totals always match
  share: number;
}

export interface ProjectPreset {
  id: string;
  label: string;
  description: string;
  // Fixed deposit for this preset (small jobs), otherwise the Settings deposit percentage is used
  depositPercent?: number;
  stages: PresetStage[];
  scope: string;
}

export const PROJECT_PRESETS: ProjectPreset[] = [
  {
    id: 'business-system',
    label: 'Custom business system',
    description: 'Deposit, then design, build and launch stages',
    stages: [
      {
        title: 'Discovery and design',
        description: 'We map how the business works today and agree the screens, data and workflows. You sign off the design before building starts.',
        share: 1 / 3,
      },
      {
        title: 'Build and testing',
        description: 'I build the system and you test it with real data on a private test site. Includes up to two rounds of changes.',
        share: 2 / 5,
      },
      {
        title: 'Launch and training',
        description: 'The system goes live, existing data is moved across and your team is trained. Your free support period starts here.',
        share: 1,
      },
    ],
    scope: `A web-based system that replaces [what it replaces, e.g. spreadsheets and paper job sheets] for [who uses it].

Included:
- [Feature, e.g. job and customer records]
- [Feature, e.g. staff timesheets and wages]
- [Feature, e.g. invoices and reports]
- User accounts with separate access for managers and staff
- Moving existing data across from [source]
- Training for your team

Not included: [anything you want to rule out explicitly]`,
  },
  {
    id: 'mobile-app',
    label: 'Mobile app (Flutter)',
    description: 'Deposit, then prototype, beta and store release stages',
    stages: [
      {
        title: 'Design and clickable prototype',
        description: 'The screens and flows are designed and shared as a clickable prototype. You sign it off before building starts.',
        share: 1 / 3,
      },
      {
        title: 'Build and beta testing',
        description: 'The app is built and shared with you through TestFlight (iPhone) and Google Play testing, ready to try on real devices. Includes up to two rounds of changes.',
        share: 2 / 5,
      },
      {
        title: 'App Store and Google Play release',
        description: 'The app is published to the App Store and Google Play. Your free support period starts here.',
        share: 1,
      },
    ],
    scope: `A mobile app for iPhone and Android for [who uses it] to [what it's for].

Included:
- [Feature, e.g. shift check-in and check-out]
- [Feature, e.g. incident reports with photos]
- Works offline and syncs when signal returns
- Sign-in and user accounts
- Publishing to the App Store and Google Play

The apps are published under the Client's own Apple Developer and Google Play accounts, which the Client pays for directly.

Not included: [anything you want to rule out explicitly]`,
  },
  {
    id: 'fix-extend',
    label: 'Fix or extend an existing system',
    description: 'Half up front, half on delivery',
    depositPercent: 50,
    stages: [
      {
        title: 'Delivery',
        description: 'The changes are delivered, tested and deployed, and you confirm everything works as agreed.',
        share: 1,
      },
    ],
    scope: `Work on the Client's existing system at [where it's hosted / repository]:
- [Fix or change 1]
- [Fix or change 2]

The Client will provide access to the code, hosting and any accounts needed before work starts.`,
  },
];

export function getPreset(id: unknown) {
  return PROJECT_PRESETS.find((preset) => preset.id === id) ?? null;
}

// Milestones for a preset at a given price (pence). Amounts always add up to the total exactly.
export function presetMilestones(preset: ProjectPreset, totalPrice: number, defaultDepositPercent: number): MilestoneInput[] {
  const depositPercent = preset.depositPercent ?? defaultDepositPercent;
  const deposit = Math.round((totalPrice * depositPercent) / 100);
  const milestones: MilestoneInput[] = [
    { title: `Deposit (${depositPercent}%)`, description: 'Paid before work starts. It books the project into my schedule.', amount: deposit, requiresPayment: true, dueDate: null },
  ];

  const rest = totalPrice - deposit;
  let allocated = 0;
  preset.stages.forEach((stage, index) => {
    const isLast = index === preset.stages.length - 1;
    const amount = isLast ? rest - allocated : Math.round(rest * stage.share);
    allocated += amount;
    milestones.push({ title: stage.title, description: stage.description, amount, requiresPayment: true, dueDate: null });
  });
  return milestones;
}

// Typical running costs for a small hosted business system, as a starting point to edit
export const TYPICAL_HOSTING_COSTS: HostingCost[] = [
  { label: 'Server (VPS)', amount: 1200, period: 'month' },
  { label: 'Off-site backups', amount: 300, period: 'month' },
  { label: 'Domain name', amount: 1500, period: 'year' },
];
