// Checks that nothing in the admin or the client portal is reachable without a valid session,
// and that the public pages search engines need are served. Run against a running server:
//   BASE_URL=http://localhost:3000 npm run test:auth
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const ADMIN_PAGES = [
  '/admin', '/admin/Bookings', '/admin/Clients', '/admin/Clients/1', '/admin/Jobs', '/admin/Jobs/1',
  '/admin/CaseStudies', '/admin/CaseStudies/new', '/admin/CaseStudies/1', '/admin/Services', '/admin/Testimonals',
  '/admin/Settings', '/admin/preview/work/1', '/admin/invoices/1', '/admin/Faqs', '/admin/Industries',
];

const ADMIN_APIS = [
  ['GET', '/api/admin/summary'], ['GET', '/api/admin/settings'], ['PUT', '/api/admin/settings'],
  ['GET', '/api/admin/case-studies'], ['GET', '/api/admin/case-studies?id=1'], ['POST', '/api/admin/case-studies'],
  ['PUT', '/api/admin/case-studies'], ['PATCH', '/api/admin/case-studies'], ['DELETE', '/api/admin/case-studies'],
  ['POST', '/api/admin/upload'], ['GET', '/api/admin/bookings'], ['PATCH', '/api/admin/bookings'],
  ['GET', '/api/admin/clients'], ['POST', '/api/admin/clients'], ['PUT', '/api/admin/clients'], ['PATCH', '/api/admin/clients'], ['DELETE', '/api/admin/clients'],
  ['GET', '/api/admin/projects'], ['GET', '/api/admin/projects?id=1'], ['POST', '/api/admin/projects'], ['PUT', '/api/admin/projects'], ['PATCH', '/api/admin/projects'], ['DELETE', '/api/admin/projects'],
  ['POST', '/api/admin/milestones'], ['PATCH', '/api/admin/milestones'], ['DELETE', '/api/admin/milestones'],
  ['POST', '/api/admin/updates'], ['DELETE', '/api/admin/updates'],
  ['POST', '/api/admin/contracts'], ['PUT', '/api/admin/contracts'], ['PATCH', '/api/admin/contracts'], ['DELETE', '/api/admin/contracts'],
  ['POST', '/api/content/services'], ['PUT', '/api/content/services'], ['POST', '/api/content/faqs'], ['PUT', '/api/content/industries'], ['PATCH', '/api/content/testimonials'], ['DELETE', '/api/content/testimonials'],
  ['PUT', '/api/settings/sections'],
  ['GET', '/api/admin/bank'], ['POST', '/api/admin/bank'], ['PUT', '/api/admin/bank'],
  ['POST', '/api/admin/invoices'], ['PATCH', '/api/admin/invoices'], ['GET', '/api/admin/address-search?q=OX1'],
  ['PUT', '/api/admin/handover'], ['DELETE', '/api/admin/handover'],
  // Outside the proxy (large uploads), guarded inside the route
  ['POST', '/api/upload/handover'],
];

const PORTAL_PAGES = ['/portal', '/portal/projects/1', '/portal/contracts/1', '/portal/invoices/1'];
const PORTAL_APIS = [['POST', '/api/portal/payment'], ['POST', '/api/portal/sign'], ['POST', '/api/portal/support'], ['POST', '/api/portal/checkout'], ['GET', '/api/portal/handover/1']];

const PUBLIC_PAGES = [['/', 200], ['/work', 200], ['/book', 200], ['/privacy', 200], ['/robots.txt', 200], ['/sitemap.xml', 200], ['/admin/login', 200], ['/portal/login', 200], ['/work/does-not-exist', 404], ['/blog', 404], ['/services/custom-business-systems', 200], ['/industries/construction-and-trades', 200], ['/services/nope', 404], ['/llms.txt', 200], ['/indexnow.txt', 200]];

// No cookie, an expired admin token, and well-formed but forged tokens
const SESSIONS = {
  none: '',
  expired: 'admin_session=admin.1000000000.AAAA; client_session=client-1.1000000000.AAAA',
  forged: 'admin_session=admin.9999999999.forgedsignature; client_session=client-1.9999999999.forgedsignature; admin_pending=admin-pending.9999999999.forged; bank_unlock=bank-unlock.9999999999.forged',
};

let failures = 0;
const fail = (message) => {
  failures++;
  console.error(`  ✗ ${message}`);
};

async function request(method, path, cookie) {
  return fetch(BASE + path, {
    method,
    redirect: 'manual',
    headers: { ...(cookie ? { cookie } : {}), ...(method === 'GET' ? {} : { 'content-type': 'application/json' }) },
    body: method === 'GET' ? undefined : JSON.stringify({ id: 1, projectId: 1, values: { heroHeadline: 'pwned' }, key: 'blog', isVisible: true }),
  });
}

for (const [label, cookie] of Object.entries(SESSIONS)) {
  console.log(`\nSession: ${label}`);
  for (const path of ADMIN_PAGES) {
    const res = await request('GET', path, cookie);
    const location = res.headers.get('location') ?? '';
    if (![307, 308].includes(res.status) || !location.includes('/admin/login')) fail(`GET ${path} → ${res.status} ${location}`);
  }
  for (const [method, path] of ADMIN_APIS) {
    const res = await request(method, path, cookie);
    if (res.status !== 401) fail(`${method} ${path} → ${res.status}`);
  }
  for (const path of PORTAL_PAGES) {
    const res = await request('GET', path, cookie);
    const location = res.headers.get('location') ?? '';
    if (![307, 308].includes(res.status) || !location.includes('/portal/login')) fail(`GET ${path} → ${res.status} ${location}`);
  }
  for (const [method, path] of PORTAL_APIS) {
    const res = await request(method, path, cookie);
    if (res.status !== 401) fail(`${method} ${path} → ${res.status}`);
  }
}

console.log('\nSign-in code step and Stripe webhook');
for (const [label, cookie] of Object.entries(SESSIONS)) {
  const res = await request('POST', '/api/auth/verify', cookie);
  // 429 (rate limited) is also a refusal
  if (![401, 429].includes(res.status)) fail(`POST /api/auth/verify (${label} session) → ${res.status}`);
}
const webhook = await fetch(BASE + '/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=forged' }, body: '{}' });
if (![400, 503].includes(webhook.status)) fail(`unsigned Stripe webhook → ${webhook.status}`);

console.log('\nPublic pages');
for (const [path, expected] of PUBLIC_PAGES) {
  const res = await request('GET', path, '');
  if (res.status !== expected) fail(`GET ${path} → ${res.status}, expected ${expected}`);
}

const robots = await (await request('GET', '/robots.txt', '')).text();
if (!/Disallow: \/admin/.test(robots)) fail('robots.txt does not disallow /admin');
const login = await (await request('GET', '/admin/login', '')).text();
if (!/<meta name="robots" content="noindex/.test(login)) fail('/admin/login is missing noindex');

const total = (ADMIN_PAGES.length + ADMIN_APIS.length + PORTAL_PAGES.length + PORTAL_APIS.length + 1) * Object.keys(SESSIONS).length + PUBLIC_PAGES.length + 3;
console.log(failures ? `\n${failures} of ${total} checks failed` : `\nAll ${total} checks passed`);
process.exit(failures ? 1 : 0);
