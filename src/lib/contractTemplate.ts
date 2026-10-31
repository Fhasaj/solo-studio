/*
 * @name: Contract Template
 * @description: The default software development agreement. Editable in admin under Settings → Contract template.
 * Lines starting with "## " become headings and lines starting with "- " become bullet points.
 * This is a starting point, not legal advice: have a solicitor review it before relying on it.
 * */

export const CONTRACT_PLACEHOLDERS = [
  ['businessName', 'Your name as a sole trader'],
  ['businessAddress', 'Your business address'],
  ['clientName', "Client's name"],
  ['clientCompany', "Client's company (or their name if blank)"],
  ['clientEmail', "Client's email"],
  ['projectTitle', 'Project title'],
  ['projectReference', 'Project reference, e.g. FH-2026-001'],
  ['projectSummary', 'Project summary (the agreed scope)'],
  ['totalPrice', 'Total price'],
  ['depositPercent', 'Deposit percentage'],
  ['depositAmount', 'Deposit amount'],
  ['milestones', 'Bullet list of milestones and amounts'],
  ['supportMonths', 'Months of free support'],
  ['supportBasicPrice', 'Standard support plan price'],
  ['supportPriorityPrice', 'Priority support plan price'],
  ['dayRate', 'Day rate'],
  ['hosting', 'Hosting paragraph: your monthly fee if you host it, otherwise that the client hosts it'],
  ['paymentRule', 'When each stage is paid: before it starts, or when it is finished'],
  ['paymentMethods', 'How the client can pay: bank transfer, and card if switched on for the job'],
  ['vatNote', 'Whether VAT is added, from Settings → Tax and VAT'],
  ['date', "Today's date"],
] as const;

export type ContractPlaceholder = (typeof CONTRACT_PLACEHOLDERS)[number][0];

export function fillTemplate(template: string, values: Record<ContractPlaceholder, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in values ? values[key as ContractPlaceholder] : match
  );
}

export const DEFAULT_CONTRACT_TEMPLATE = `This agreement is made on {{date}} between:

- {{businessName}}, a sole trader of {{businessAddress}} ("the Developer"), and
- {{clientCompany}}, represented by {{clientName}} ({{clientEmail}}) ("the Client").

It covers the project "{{projectTitle}}" (reference {{projectReference}}). The Client confirms they are entering into this agreement for business purposes, not as a consumer.

## 1. The work

The Developer will design, build and deliver the following:

{{projectSummary}}

Anything not described above is outside the scope of this agreement. Changes to the scope are covered in section 5.

## 2. Price and milestones

The total price is {{totalPrice}}. The work is delivered and paid for in the following stages:

{{milestones}}

{{vatNote}}

## 3. Payment

- A deposit of {{depositPercent}}% ({{depositAmount}}) is due before any work starts. Work is not scheduled until the deposit has been received.
- {{paymentRule}} The Developer will show the amount due, and how to pay it, in the client portal.
- Payment is due within 14 days of the Developer requesting it.
- {{paymentMethods}}

## 4. Late payment

- If a payment is late, the Developer may pause all work on the project, including any hosting or support the Developer provides, until it is paid in full. Delivery dates move back by at least the length of the pause.
- Late payments carry statutory interest and fixed compensation under the Late Payment of Commercial Debts (Interest) Act 1998. Interest is charged at 8% a year above the Bank of England base rate, and fixed compensation is £40 for debts under £1,000, £70 for debts of £1,000 to £9,999.99, and £100 for debts of £10,000 or more. The Developer may also recover reasonable costs of collecting the debt.
- If any amount is more than 30 days overdue, the Developer may end this agreement by giving written notice. Section 10 then applies.

## 5. Changes to the work

The Client may ask for changes at any time. The Developer will confirm in writing whether the change affects the price or the timeline before doing the work. Changes outside the agreed scope are charged at {{dayRate}} per day (or part day, pro rata) unless a fixed price is agreed in writing.

## 6. Ownership of the work

- Ownership of the software, designs and other work created for this project (the "Deliverables") passes to the Client only once every amount due under this agreement has been paid in full.
- Until then, the Developer owns the Deliverables. The Client may use them for testing and review only, and the Developer may withhold the source code, credentials and handover until payment is complete.
- The Developer keeps ownership of their own pre-existing tools, code libraries and know-how used in the project, and grants the Client a permanent, non-exclusive licence to use them as part of the Deliverables once paid in full.
- Third-party and open-source software remains under its own licence terms.
- Unless the Client asks otherwise in writing, the Developer may describe the project and show screenshots in their portfolio, without revealing confidential information.

## 7. The Client's responsibilities

The Client will provide the information, content, access and feedback the Developer reasonably needs, on time. Delays caused by missing information move the timeline back by the same amount. The Client is responsible for the accuracy and legality of the content and data they provide.

## 8. Support after launch

- The Developer will fix defects in the delivered work, free of charge, for {{supportMonths}} months after the project is marked complete. A defect is where the software does not work as agreed in this document.
- Free support does not cover new features, changes to the agreed scope, problems caused by changes made by anyone else, third-party services, or hosting costs.
- After the free period the Client may buy extended support: a standard plan at {{supportBasicPrice}} per month or a priority plan at {{supportPriorityPrice}} per month, paid in advance.

## 9. Hosting

{{hosting}}

## 10. Ending the agreement

- Either party may end this agreement by giving 14 days' written notice.
- If the agreement ends early for any reason, the Client must pay for all work completed up to the end date, at the milestone prices or, for a milestone in progress, at the day rate for time spent. The deposit is non-refundable once work has started.
- Sections 4, 6, 11 and 12 continue to apply after the agreement ends.

## 11. Liability

- The Developer will carry out the work with reasonable skill and care.
- The Developer's total liability under this agreement is limited to the total price paid by the Client.
- The Developer is not liable for indirect or consequential loss, including loss of profit, revenue, data or business opportunity.
- Nothing in this agreement limits liability for death or personal injury caused by negligence, fraud, or anything else that cannot be limited by law.

## 12. Confidentiality and data protection

Both parties will keep the other's confidential information private and use it only for this project. Where the Developer processes personal data on the Client's behalf, the Developer will do so only on the Client's instructions and in line with UK GDPR and the Data Protection Act 2018.

## 13. General

- This document is the whole agreement between the parties for this project. Changes must be agreed in writing, which includes email.
- If any part of this agreement is found to be unenforceable, the rest still applies.
- Signing electronically has the same effect as signing on paper.
- This agreement is governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction.`;

// The Irish version: Irish late payment rules, Irish data protection law and Irish courts. Built from the UK text so the
// two stay in step; used automatically when the tax country is Ireland and the template hasn't been edited.
export const IRISH_CONTRACT_TEMPLATE = DEFAULT_CONTRACT_TEMPLATE.replace(
  /- Late payments carry statutory interest[^\n]*/,
  '- Late payments carry interest and compensation under the European Communities (Late Payment in Commercial Transactions) Regulations 2012. Interest is charged at 8% a year above the European Central Bank reference rate, and fixed compensation is €40 for debts under €1,000, €70 for debts of €1,000 to €9,999.99, and €100 for debts of €10,000 or more. The Developer may also recover reasonable costs of collecting the debt.'
)
  .replace('in line with UK GDPR and the Data Protection Act 2018', 'in line with the GDPR and the Data Protection Act 2018 (Ireland)')
  .replace('This agreement is governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction.', 'This agreement is governed by the law of Ireland, and the Irish courts have exclusive jurisdiction.');
