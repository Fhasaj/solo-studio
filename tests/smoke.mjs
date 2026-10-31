import fs from 'fs';
const BASE = (process.env.BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
const MAIL = process.env.MAIL_FILE;
let pass = 0, failed = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✓', m); } else { failed++; console.log('  ✗', m, x); } };
const get = async (p, cookie = '') => { const r = await fetch(BASE + p, { headers: { cookie }, redirect: 'manual' }); return { status: r.status, text: await r.text() }; };
const call = async (method, p, body, cookie) => { const r = await fetch(BASE + p, { method, headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => ({})), headers: r.headers }; };

console.log('Fresh install');
let r = await get('/');
ok(r.status === 200, 'homepage loads on an empty database');
ok(!/>\s*(undefined|null|NaN)\s*</.test(r.text), 'no empty setting shows up as "undefined" on the page');
ok(r.text.includes('Your Name') && r.text.includes('Custom software for small and medium businesses'), 'placeholder profile and headline');
ok(r.text.includes('Do I own the code?') && r.text.includes('"@type":"FAQPage"'), 'example FAQs seeded');
ok(r.text.includes('Custom business systems') && r.text.includes('/industries/construction-and-trades'), 'example services and industries seeded');
for (const p of ['/services/custom-business-systems', '/industries/construction-and-trades', '/work', '/book', '/privacy', '/llms.txt', '/sitemap.xml', '/robots.txt', '/portal/login', '/admin/login']) {
  r = await get(p);
  ok(r.status === 200 && !/>\s*(undefined|null|NaN)\s*</.test(r.text), `${p} loads`, r.status);
}
r = await get('/cv'); ok(r.status === 404, 'no CV page');
r = await get('/blog'); ok(r.status === 404, 'no blog');

console.log('Admin setup');
let res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'test-admin-password-123' }) });
const pending = res.headers.get('set-cookie').split(';')[0];
const code = fs.readFileSync(MAIL, 'utf8').match(/Your code is: (\d{6})/)[1];
r = await call('POST', '/api/auth/verify', { code }, pending);
const admin = r.headers.get('set-cookie').split(',').map((c) => c.trim().split(';')[0]).find((c) => c.startsWith('admin_session='));
ok(admin, 'signs in with password + emailed code');
r = await call('PUT', '/api/admin/settings', { values: { siteName: 'Acme Dev', ownerName: 'Alex Morgan', town: 'Leeds', region: 'West Yorkshire', areaServed: 'United Kingdom, Ireland', freelancingSince: '2018', aboutHeading: "Hi, I'm Alex", aboutText: 'Ten years building software for small firms.', qualifications: 'BSc Computer Science | University of Leeds', githubUrl: 'https://github.com/example', siteTitle: 'Software for Leeds businesses', siteDescription: 'Custom software for small businesses in Leeds.' } }, admin);
ok(r.status === 200, 'profile saved');
r = await get('/');
ok(r.text.includes('Acme Dev') && r.text.includes("Hi, I&#x27;m Alex") && r.text.includes('Since 2018') && r.text.includes('<title>Software for Leeds businesses | Acme Dev</title>'), 'homepage, title and about follow the settings');
ok(r.text.includes('"addressLocality":"Leeds"') && r.text.includes('"name":"University of Leeds"') && r.text.includes('"name":"Ireland"') && r.text.includes('https://github.com/example'), 'structured data follows the settings');
r = await get('/llms.txt');
ok(r.text.startsWith('# Acme Dev') && r.text.includes('based in Leeds'), 'llms.txt follows the settings');
r = await get('/services/custom-business-systems');
ok(r.text.includes('| Acme Dev</title>'), 'sub-page titles use the brand');
r = await call('GET', '/api/admin/case-studies', undefined, admin);
const example = (await (await fetch(BASE + '/api/admin/case-studies', { headers: { cookie: admin } })).json()).data;
ok(example.length === 1 && example[0].status === 'draft', 'one example case study, as a draft');
r = await call('PATCH', '/api/admin/case-studies', { id: example[0].id, status: 'published' }, admin);
ok(r.status === 400, 'example cannot be published until its placeholders are replaced');

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
