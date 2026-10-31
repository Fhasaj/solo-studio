/*
 * @name: Expense categories
 * @description: Categories for business costs, each mapped to its HMRC Making Tax Digital heading. Shared by the server
 * and the admin pages.
 * */

// Each maps to the HMRC (Making Tax Digital / SA103) and Revenue (Form 11) headings
export const EXPENSE_CATEGORIES = [
  { key: 'cost_of_sales', label: 'Materials and cost of sales', hmrc: 'costOfGoods', allowable: true },
  { key: 'subcontractors', label: 'Subcontractors', hmrc: 'otherExpenses', allowable: true },
  { key: 'staff', label: 'Staff costs', hmrc: 'staffCosts', allowable: true },
  { key: 'travel', label: 'Travel (trains, parking, hotels)', hmrc: 'travelCosts', allowable: true },
  { key: 'premises', label: 'Premises (rent, power, insurance)', hmrc: 'premisesRunningCosts', allowable: true },
  { key: 'repairs', label: 'Repairs and maintenance', hmrc: 'maintenanceCosts', allowable: true },
  { key: 'office', label: 'Phone, internet, software and office', hmrc: 'adminCosts', allowable: true },
  { key: 'hosting', label: 'Hosting and domains', hmrc: 'adminCosts', allowable: true },
  { key: 'equipment', label: 'Equipment (computers, phones)', hmrc: 'otherExpenses', allowable: true },
  { key: 'advertising', label: 'Advertising and marketing', hmrc: 'advertisingCosts', allowable: true },
  { key: 'professional', label: 'Accountant, legal and insurance', hmrc: 'professionalFees', allowable: true },
  { key: 'bank_charges', label: 'Bank and payment charges', hmrc: 'financeCharges', allowable: true },
  { key: 'interest', label: 'Loan interest', hmrc: 'interestOnBankOtherLoans', allowable: true },
  { key: 'training', label: 'Training and books', hmrc: 'otherExpenses', allowable: true },
  { key: 'bad_debts', label: 'Bad debts', hmrc: 'badDebt', allowable: true },
  { key: 'other', label: 'Other business costs', hmrc: 'otherExpenses', allowable: true },
  // Recorded for completeness but not deductible
  { key: 'entertainment', label: 'Client entertainment (not allowable)', hmrc: 'businessEntertainmentCosts', allowable: false },
  { key: 'personal', label: 'Personal (not allowable)', hmrc: '', allowable: false },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['key'];
