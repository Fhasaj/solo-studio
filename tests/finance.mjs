// Money (bookkeeping, tax, VAT, bank import), CV and settings import/export, against a fresh running server.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(process.cwd() + '/package.json');

const BASE = (process.env.BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
const MAIL = process.env.MAIL_FILE;
let pass = 0, failed = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✓', m); } else { failed++; console.log('  ✗', m, typeof x === 'string' ? x : JSON.stringify(x)); } };
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
let admin = '';
const call = async (method, path, body, cookie = admin) => {
  const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { cookie, ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const buffer = Buffer.from(await res.arrayBuffer());
  let json; try { json = JSON.parse(buffer.toString()); } catch {}
  return { status: res.status, json, text: buffer.toString(), buffer, headers: res.headers };
};
const summary = async () => (await call('GET', '/api/admin/finance/summary')).json.data;
const settings = (values) => call('PUT', '/api/admin/settings', { values });
const today = new Date().toISOString().slice(0, 10);

console.log('Sign in');
let res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'test-admin-password-123' }) });
const pending = res.headers.get('set-cookie').split(';')[0];
const code = [...fs.readFileSync(MAIL, 'utf8').matchAll(/Your code is: (\d{6})/g)].at(-1)[1];
let r = await call('POST', '/api/auth/verify', { code }, pending);
admin = r.headers.get('set-cookie').split(',').map((c) => c.trim().split(';')[0]).find((c) => c.startsWith('admin_session='));
ok(admin, 'signed in');

console.log('CV');
r = await call('GET', '/cv', null, '');
ok(r.status === 404, 'CV is off by default');
await call('PUT', '/api/settings/sections', { key: 'cv', isVisible: true });
await settings({ ownerName: 'Alex Morgan', cvMarkdown: '# Alex Morgan\n\nDeveloper · [alex@example.com](mailto:alex@example.com) · [evil](javascript:alert(1))\n\n## Experience\n\n### Developer · 2020 to now\n\n- Built **things** for *people*\n- More things\n\n## Skills\n\n1. Go\n2. TypeScript\n\n---\n\nThanks.' });
r = await call('GET', '/cv', null, '');
ok(r.status === 200 && /<h1[^>]*>(<span>)?Alex Morgan/.test(r.text) && r.text.includes('<strong') && r.text.includes('href="mailto:alex@example.com"'), 'CV page renders the Markdown');
ok(!r.text.includes('javascript:alert'), 'unsafe links are dropped');
ok(r.text.includes('href="/cv.pdf"'), 'download link');
r = await call('GET', '/cv.pdf', null, '');
ok(r.status === 200 && r.headers.get('content-type') === 'application/pdf' && r.buffer.subarray(0, 5).toString() === '%PDF-' && r.buffer.length > 3000 && /Alex Morgan CV\.pdf/.test(r.headers.get('content-disposition')), 'PDF generated', `${r.status} ${r.buffer.length}`);
r = await call('GET', '/', null, '');
ok(r.text.includes('href="/cv"'), 'footer links the CV');

console.log('Settings export and import');
r = await call('GET', '/api/admin/settings');
const exported = r.json.data;
r = await call('PUT', '/api/admin/settings', { values: { ...exported, siteName: 'Imported Name', bogus: 'ignored' } });
ok(r.status === 200 && r.json.data.siteName === 'Imported Name', 'import applies known settings and ignores unknown ones');
r = await call('PUT', '/api/admin/settings', { values: { taxCountry: 'mars' } });
ok(r.status === 400, 'invalid choices rejected');

console.log('Bookkeeping (UK, not VAT registered)');
await settings({ taxCountry: 'uk', otherIncome: '0', businessAddress: '1 Test Street, Leeds', vatRegistered: 'no', homeOfficeBand: 'none' });
r = await call('POST', '/api/admin/clients', { name: 'Bank Client', email: 'bank@example.com', company: 'Bank Ltd' });
const clientId = r.json.id;
r = await call('POST', '/api/admin/projects', { clientId, title: 'Big job', totalPrice: '60000' });
const projectId = r.json.id;
r = await call('POST', '/api/admin/milestones', { projectId, title: 'Everything', amount: '60000', requiresPayment: true });
const milestoneId = r.json.id;
await call('PATCH', '/api/admin/milestones', { id: milestoneId, action: 'request_payment' });
let job = (await call('GET', `/api/admin/projects?id=${projectId}`)).json.data;
const invoice = job.invoices[0];
ok(invoice.total === 6_000_000 && !invoice.data.vat && /Not registered for VAT/.test(invoice.data.notes), 'invoice without VAT while not registered');

const d = today.split('-').reverse().join('/');
const statement = `Account,12345678\n\nDate,Description,Amount,Balance\n${d},"BANK LTD ${job.milestones[0].paymentReference}",60000.00,60000\n${d},HETZNER ONLINE GMBH,-12.00,59988\n${d},TRAINLINE.COM,"-45.50",59942.50\n${d},Transfer to savings,-1000,58942.50\n`;
r = await call('POST', '/api/admin/finance/bank', { csv: statement });
ok(r.status === 200 && r.json.data.added === 4, 'statement imported (header found below account details)', r.json);
r = await call('POST', '/api/admin/finance/bank', { csv: statement });
ok(r.json.data.added === 0 && r.json.data.duplicates === 4, 're-importing adds nothing');
r = await call('GET', '/api/admin/finance/bank');
const lines = r.json.data;
const incoming = lines.find((l) => l.amount === 6_000_000);
const hetzner = lines.find((l) => /HETZNER/.test(l.description));
const train = lines.find((l) => /TRAINLINE/.test(l.description));
const transfer = lines.find((l) => /savings/.test(l.description));
ok(incoming.suggestions[0]?.id === invoice.id && incoming.suggestions[0].score === 3, 'payment matched to its invoice by reference and amount');
ok(hetzner.category === 'hosting' && train.category === 'travel', 'categories guessed from the description');
r = await call('PATCH', '/api/admin/finance/bank', { id: incoming.id, action: 'invoice', invoiceId: invoice.id });
job = (await call('GET', `/api/admin/projects?id=${projectId}`)).json.data;
ok(r.status === 200 && job.invoices[0].status === 'paid' && job.milestones[0].paidAt, 'matching the line marks the invoice and milestone paid');
await call('PATCH', '/api/admin/finance/bank', { id: hetzner.id, action: 'expense', category: 'hosting' });
await call('PATCH', '/api/admin/finance/bank', { id: train.id, action: 'expense', category: 'travel' });
await call('PATCH', '/api/admin/finance/bank', { id: transfer.id, action: 'transfer' });
r = await call('PATCH', '/api/admin/finance/bank', { id: transfer.id, action: 'expense', category: 'other' });
ok(r.status === 400, "a line can't be used twice");
r = await call('GET', '/api/admin/finance/bank');
ok(r.json.data.length === 0, 'nothing left to sort out');

r = await call('POST', '/api/admin/finance/expenses', { date: today, supplier: '=HYPERLINK("http://evil")', category: 'equipment', amount: '1000', vat: '0', businessPercent: '100' });
const laptopId = r.json.id;
r = await call('POST', '/api/admin/finance/expenses', { date: today, supplier: 'Phone', category: 'office', amount: '100', businessPercent: '50' });
r = await call('POST', '/api/admin/finance/expenses', { date: today, supplier: 'x', category: 'office', amount: '10', vat: '20' });
ok(r.status === 400, "VAT can't exceed the amount");
await call('POST', '/api/admin/finance/records', { kind: 'mileage', date: today, purpose: 'Client visit', distance: '100', vehicle: 'car' });
await call('POST', '/api/admin/finance/records', { kind: 'income', date: today, description: 'Consulting paid directly', amount: '500' });

let s = await summary();
// Income 60,000 + 500; costs 12 + 45.50 + 1,000 + 50 (half of 100) + 45 mileage = 1,152.50
ok(s.income.turnover === 6_050_000 && s.deductions === 115_250 && s.profit === 5_934_750, 'income, expenses and profit', { turnover: s.income.turnover, deductions: s.deductions, profit: s.profit });
// Profit 59,347.50: income tax 7,540 + (46,777.50 − 37,700) × 40% = 11,171; Class 4 2,262 + 9,077.50 × 2% = 2,443.55
ok(near(s.estimate.incomeTax, 11_171, 0.01) && near(s.estimate.socialInsurance, 2_443.55, 0.01) && near(s.estimate.total, 13_614.55, 0.01), 'UK income tax and Class 4 estimate', s.estimate);
await settings({ otherIncome: '40000' });
s = await summary();
// With a £40,000 salary: tax on 99,347.50 (27,171) minus tax on the salary alone (5,486) = 21,685; Class 4 unchanged
ok(near(s.estimate.incomeTax, 21_685, 0.01) && near(s.estimate.socialInsurance, 2_443.55, 0.01), 'a salary pushes profit into higher bands', s.estimate.incomeTax);
await settings({ otherIncome: '0' });
await settings({ taxCountry: 'uk-scotland' });
s = await summary();
ok(s.estimate.incomeTax > 11_171 && s.estimate.notes.some((n) => /Scottish/.test(n)), 'Scottish rates give a higher estimate', s.estimate.incomeTax);
await settings({ taxCountry: 'uk' });
const quarter = s.quarters.find((q) => q.start <= today && q.end >= today);
ok(s.quarters.length === 4 && quarter && quarter.turnover === 6_050_000 && quarter.expenses.adminCosts === 6_200 && quarter.expenses.travelCosts === 9_050, 'MTD quarter in HMRC categories (cumulative)', quarter);

r = await call('GET', `/api/admin/finance/export?kind=quarter&year=${encodeURIComponent(s.year.label)}&quarter=${quarter.number}`);
ok(r.status === 200 && r.text.includes('turnover,60500.00') && r.text.includes('adminCosts,62.00'), 'quarter CSV for bridging software');
r = await call('GET', `/api/admin/finance/export?kind=transactions&year=${encodeURIComponent(s.year.label)}`);
ok(r.text.includes("'=HYPERLINK") && !/,=HYPERLINK/.test(r.text), 'spreadsheet formulas are neutralised in exports');

console.log('Receipts');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
let form = new FormData(); form.append('expenseId', String(laptopId)); form.append('file', new Blob([pdf]), 'laptop.pdf');
r = await call('POST', '/api/admin/finance/receipt', form);
ok(r.status === 200, 'receipt uploaded');
r = await call('GET', `/api/admin/finance/receipt?id=${laptopId}`);
ok(r.status === 200 && r.buffer.equals(pdf) && /sandbox/.test(r.headers.get('content-security-policy')), 'receipt comes back intact, sandboxed');
form = new FormData(); form.append('expenseId', String(laptopId)); form.append('file', new Blob(['<script>alert(1)</script>']), 'x.pdf');
r = await call('POST', '/api/admin/finance/receipt', form);
ok(r.status === 400, 'non-receipt files rejected');
r = await call('GET', `/api/admin/finance/receipt?id=${laptopId}`, null, '');
ok(r.status === 401, 'receipts need admin');

console.log('Tax rate overrides');
const ratesNow = (await call('GET', `/api/admin/finance/rates?year=${encodeURIComponent(s.year.label)}`)).json.data.rates;
const { country, year, checked, sources, ...editable } = ratesNow;
r = await call('PUT', '/api/admin/finance/rates', { year: s.year.label, json: JSON.stringify({ ...editable, personalAllowance: 20000 }) });
s = await summary();
ok(r.status === 200 && s.estimate.incomeTax < 11_171, 'an override changes the estimate', s.estimate.incomeTax);
r = await call('PUT', '/api/admin/finance/rates', { year: s.year.label, json: '{"bands": []}' });
ok(r.status === 400, 'incomplete rates rejected');
await call('DELETE', '/api/admin/finance/rates', { year: s.year.label });
s = await summary();
ok(near(s.estimate.incomeTax, 11_171, 0.01), 'back to built-in rates');

console.log('VAT');
ok(s.vatThreshold.sales === 6_050_000 && s.vatThreshold.percent === 67, 'rolling 12-month sales against the £90,000 threshold', s.vatThreshold);
await settings({ vatRegistered: 'yes', vatRegisteredFrom: today, vatNumber: 'GB123456789', vatScheme: 'invoice', vatQuarterEnds: 'mar' });
r = await call('POST', '/api/admin/projects', { clientId, title: 'VAT job', totalPrice: '1000' });
const vatProject = r.json.id;
r = await call('POST', '/api/admin/milestones', { projectId: vatProject, title: 'Stage', amount: '1000', requiresPayment: true });
await call('PATCH', '/api/admin/milestones', { id: r.json.id, action: 'request_payment' });
job = (await call('GET', `/api/admin/projects?id=${vatProject}`)).json.data;
const vatInvoice = job.invoices[0];
ok(vatInvoice.total === 120_000 && vatInvoice.data.vat.amount === 20_000 && vatInvoice.data.seller.vatNumber === 'GB123456789', 'UK client: 20% VAT added, VAT number shown', vatInvoice.data.vat);
r = await call('POST', '/api/admin/clients', { name: 'Paris Client', email: 'eu@example.com', country: 'EU', vatNumber: 'FR12345678901' });
r = await call('POST', '/api/admin/projects', { clientId: r.json.id, title: 'EU job', totalPrice: '500' });
const euProject = r.json.id;
r = await call('POST', '/api/admin/milestones', { projectId: euProject, title: 'Stage', amount: '500', requiresPayment: true });
await call('PATCH', '/api/admin/milestones', { id: r.json.id, action: 'request_payment' });
const euInvoice = (await call('GET', `/api/admin/projects?id=${euProject}`)).json.data.invoices[0];
ok(euInvoice.total === 50_000 && euInvoice.data.vat.amount === 0 && /Outside the scope of UK VAT/.test(euInvoice.data.notes), 'overseas business client: no UK VAT, with the right note');
await call('POST', '/api/admin/finance/expenses', { date: today, supplier: 'Software', category: 'office', amount: '120', vat: '20' });
s = await summary();
const period = s.vat.periods.find((p) => p.start <= today && p.end >= today);
const box = (key) => period.boxes.find((b) => b.key === key).amount;
ok(period && box('1') === 20_000 && box('4') === 2_000 && box('5') === 18_000 && box('6') === 200_000, 'VAT return boxes (invoices issued, purchases since registration)', period?.boxes);
r = await call('GET', `/portal/invoices/${vatInvoice.id}`, null, '');
ok(r.status === 307, 'invoices stay private');
await settings({ vatScheme: 'flat_rate', vatFlatRatePercent: '16.5' });
s = await summary();
const flat = s.vat.periods.find((p) => p.start <= today && p.end >= today);
// The Flat Rate Scheme here works on money received: only the £500 of other income so far, × 16.5% = 82.50
ok(flat.boxes.find((b) => b.key === '1').amount === 8_250 && flat.boxes.find((b) => b.key === '4').amount === 0, 'Flat Rate Scheme return', flat.boxes);
await settings({ vatScheme: 'invoice' });

console.log('Ireland');
await settings({ taxCountry: 'ie', vatRegistered: 'no' });
s = await summary();
ok(/^\d{4}$/.test(s.year.label) && s.year.start.endsWith('-01-01') && s.quarters.length === 0, 'calendar tax year, no MTD quarters');
const p = s.profit / 100;
const prsi = Math.max((p * 4.2375) / 100, 650);
ok(s.estimate.usc > 0 && near(s.estimate.socialInsurance, prsi, 0.01) && s.estimate.socialInsuranceLabel === 'PRSI (Class S)', 'USC and PRSI estimated', s.estimate);
r = await call('POST', '/api/admin/contracts', { projectId });
job = (await call('GET', `/api/admin/projects?id=${projectId}`)).json.data;
const contract = job.contracts.find((c) => c.id === r.json.id);
ok(/law of Ireland/.test(contract.body) && /European Communities \(Late Payment/.test(contract.body) && !/England and Wales/.test(contract.body), 'contracts switch to the Irish template');
ok(s.deadlines.some((d) => /Form 11/.test(d.label)), 'Irish deadlines');
await settings({ taxCountry: 'uk' });

console.log('Search');
r = await call('GET', '/api/admin/search?q=Bank');
ok(r.json.data.some((x) => x.group === 'Clients' && x.title === 'Bank Client') && r.json.data.some((x) => x.group === 'Pages' && x.href === '/admin/Money/Bank'), 'finds clients and pages');
r = await call('GET', '/api/admin/search?q=INV-');
ok(r.json.data.some((x) => x.group === 'Invoices'), 'finds invoices by number');
r = await call('GET', '/api/admin/search?q=VAT number');
ok(r.json.data.some((x) => x.group === 'Settings' && x.href.startsWith('/admin/Settings#tax')), 'finds settings and links to their section');
r = await call('GET', '/api/admin/search?q=%25');
ok(r.status === 200 && !r.json.data.some((x) => x.group === 'Clients'), 'a bare % is searched for literally, not as a wildcard');
r = await call('GET', '/api/admin/search?q=Bank', null, '');
ok(r.status === 401, 'search needs admin');

console.log('Account');
r = await call('GET', '/api/admin/summary');
ok(Array.isArray(r.json.data.attention) && Array.isArray(r.json.data.activity) && r.json.data.activity.length > 0 && r.json.data.finance.yearLabel, 'dashboard has attention items and activity');
r = await call('GET', '/api/admin/account');
ok(r.json.data.password.source === 'env' && r.json.data.logins.length >= 1 && r.json.data.email.includes('••••'), 'account shows sign-ins and the masked code address');
await call('POST', '/api/admin/account', { action: 'send-code' });
const accountCode = () => [...fs.readFileSync(MAIL, 'utf8').matchAll(/Your code is: (\d{6})/g)].at(-1)[1];
r = await call('POST', '/api/admin/account', { action: 'change-password', current: 'wrong', next: 'correct horse battery staple', code: accountCode() });
ok(r.status === 400 && r.json.field === 'current', 'wrong current password rejected');
r = await call('POST', '/api/admin/account', { action: 'change-password', current: 'test-admin-password-123', next: 'short', code: accountCode() });
ok(r.status === 400 && r.json.field === 'next', 'weak password rejected');
const oldSession = admin;
r = await call('POST', '/api/admin/account', { action: 'change-password', current: 'test-admin-password-123', next: 'correct horse battery staple', code: accountCode() });
const newSession = r.headers.get('set-cookie')?.split(';')[0];
ok(r.status === 200 && newSession?.startsWith('admin_session='), 'password changed, this browser stays signed in');
r = await call('GET', '/api/admin/summary', null, oldSession);
ok(r.status === 401, 'every other session is signed out');
admin = newSession;
r = await call('GET', '/api/admin/summary');
ok(r.status === 200, 'new session works');
r = await call('POST', '/api/auth/login', { password: 'test-admin-password-123' }, '');
ok(r.status === 401, 'ADMIN_PASSWORD from the server no longer works');
r = await call('POST', '/api/auth/login', { password: 'correct horse battery staple' }, '');
ok(r.status === 200, 'the new password works');
ok(fs.readFileSync(MAIL, 'utf8').includes('Your admin password was changed'), 'you get an email when the password changes');
r = await call('POST', '/api/admin/account', { action: 'sign-out-everywhere' });
const afterSignOut = r.headers.get('set-cookie')?.split(';')[0];
r = await call('GET', '/api/admin/summary', null, admin);
ok(r.status === 401, 'sign out everywhere ends other sessions');
r = await call('GET', '/api/admin/summary', null, afterSignOut);
ok(r.status === 200, '…but keeps this one');

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
