/**
 * Builds one static HTML file per public URL from src/index.html.
 * Output stays at the repo root so Vercel can serve it with no server.
 * Run: node build.mjs
 * There is no package.json on purpose: this stays a static Vercel site.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://revenueos.co.in';
const sourcePath = path.join(root, 'src', 'index.html');
const source = fs.readFileSync(sourcePath, 'utf8');

const pages = [
  {
    id: 'home',
    file: 'index.html',
    path: '/',
    crumb: null,
    expect: 'Fix how you sell.',
  },
  {
    id: 'gtm',
    file: 'gtm-audit/index.html',
    path: '/gtm-audit',
    title: 'GTM Audit & Execution | RevenueOS',
    description: 'We review how your business finds, answers and wins customers, show you where deals slip away, and build the fixes.',
    crumb: 'GTM Audit & Execution',
    expect: 'Find where revenue is leaking. Then fix it.',
    service: {
      name: 'GTM Audit and Execution',
      description: 'A review of how a business finds, answers and wins customers, followed by implementation of lead capture, CRM, follow-up automation and pipeline reporting.',
    },
  },
  {
    id: 'dashboards',
    file: 'client-dashboards/index.html',
    path: '/client-dashboards',
    title: 'Client Dashboards | RevenueOS',
    description: 'Custom dashboards that bring clients, tasks, calendars and essential business information into one clearer workspace, with role-based access.',
    crumb: 'Client Dashboards',
    expect: 'Make the moving parts easier to manage.',
    service: {
      name: 'Client Dashboards',
      description: 'Custom dashboards for client management, tasks, calendars, role-based access and operational reporting.',
    },
  },
  {
    id: 'work',
    file: 'work/index.html',
    path: '/work',
    title: 'Studies | RevenueOS',
    description: "We're a young studio, so instead of borrowed logos, here's how we think. These are self-initiated studies, not commissioned work.",
    crumb: 'Studies',
    expect: 'Studies',
  },
  {
    id: 'about',
    file: 'about/index.html',
    path: '/about',
    title: 'Studio | RevenueOS',
    description: 'RevenueOS is an independent studio that combines go-to-market work with practical business systems. You talk directly to the people auditing your business and building the fixes.',
    crumb: 'Studio',
    expect: 'Small details. Clear thinking. Work that makes sense.',
  },
  {
    id: 'contact',
    file: 'contact/index.html',
    path: '/contact',
    title: 'Start a project | RevenueOS',
    description: 'Tell us about your business and what you would like to improve.',
    crumb: 'Start a project',
    expect: 'Start a project',
  },
  {
    id: 'privacy',
    file: 'privacy/index.html',
    path: '/privacy',
    title: 'Privacy Policy | RevenueOS',
    description: 'How RevenueOS handles the information you share through this website.',
    crumb: 'Privacy Policy',
    expect: 'Privacy Policy',
  },
  {
    id: 'terms',
    file: 'terms/index.html',
    path: '/terms',
    title: 'Terms of Service | RevenueOS',
    description: 'Terms for using the RevenueOS website.',
    crumb: 'Terms of Service',
    expect: 'Terms of Service',
  },
];

function extractBalanced(html, regex, tagName) {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const re = new RegExp(regex.source, flags);
  const match = re.exec(html);
  if (!match) throw new Error(`Could not find <${tagName}> for ${regex}`);
  const start = match.index;
  const openToken = `<${tagName}`;
  const closeToken = `</${tagName}>`;
  let depth = 1;
  let i = start + match[0].length;
  while (depth > 0) {
    const nextOpen = html.indexOf(openToken, i);
    const nextClose = html.indexOf(closeToken, i);
    if (nextClose < 0) throw new Error(`Unclosed <${tagName}> at ${start}`);
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + openToken.length;
    } else {
      depth -= 1;
      i = nextClose + closeToken.length;
    }
  }
  return html.slice(start, i);
}

function extractAllPages(html) {
  const found = {};
  const re = /<div class="page" data-page="([^"]+)"[^>]*>/g;
  let match;
  while ((match = re.exec(html))) {
    const id = match[1];
    const start = match.index;
    let depth = 1;
    let i = start + match[0].length;
    while (depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose < 0) throw new Error(`Unclosed page ${id}`);
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        i = nextOpen + 4;
      } else {
        depth -= 1;
        i = nextClose + 6;
        if (depth === 0) found[id] = html.slice(start, i);
      }
    }
    re.lastIndex = start + match[0].length;
  }
  return found;
}

function showPage(html) {
  return html.replace(/^(<div class="page" data-page="[^"]+") hidden>/, '$1>');
}

function escAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function setBetween(html, pattern, value) {
  const re = new RegExp(pattern);
  if (!re.test(html)) throw new Error(`Missing head tag ${pattern}`);
  return html.replace(re, (_, open, close) => open + value + close);
}

function jsonLdScript(data) {
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

function serviceLd(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.service.name,
    serviceType: page.service.name,
    description: page.service.description,
    url: SITE + page.path,
    provider: {
      '@type': 'ProfessionalService',
      name: 'RevenueOS',
      url: `${SITE}/`,
    },
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
  };
}

function breadcrumbLd(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: page.crumb,
        item: SITE + page.path,
      },
    ],
  };
}

function applyMeta(head, page) {
  const canonical = SITE + page.path;
  let next = head;
  next = setBetween(next, '(<title>)[\\s\\S]*?(</title>)', escAttr(page.title));
  next = setBetween(next, '(<meta name="description" content=")[^"]*(")', escAttr(page.description));
  next = setBetween(next, '(<link rel="canonical" href=")[^"]*(")', canonical);
  next = setBetween(next, '(<meta property="og:url" content=")[^"]*(")', canonical);
  next = setBetween(next, '(<meta property="og:title" content=")[^"]*(")', escAttr(page.title));
  next = setBetween(next, '(<meta property="og:description" content=")[^"]*(")', escAttr(page.description));
  next = setBetween(next, '(<meta name="twitter:title" content=")[^"]*(")', escAttr(page.title));
  next = setBetween(next, '(<meta name="twitter:description" content=")[^"]*(")', escAttr(page.description));
  next = next.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '');
  const blocks = [];
  if (page.service) blocks.push(jsonLdScript(serviceLd(page)));
  blocks.push(jsonLdScript(breadcrumbLd(page)));
  next = next.replace('</head>', `${blocks.join('\n')}\n</head>`);
  return next;
}

function markCurrent(doc, pagePath) {
  if (pagePath === '/') return doc;
  const escaped = pagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`href="${escaped}"(?=[\\s>])`, 'g');
  return doc.replace(re, `href="${pagePath}" aria-current="page"`);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const FINDINGS = [
  { area: 'Inquiry response', text: 'Instagram and WhatsApp inquiries have no single owner. Many get their first reply the next day.', pri: 'High' },
  { area: 'Follow-up', text: 'Package quotes go out, but nobody is reminded to check back with people who go quiet.', pri: 'High' },
  { area: 'Lead sources', text: 'There is no record of which channel each client came from, so marketing spend can\u2019t be judged.', pri: 'Medium' },
  { area: 'Tools', text: 'Inquiries live in three places, and none of them is treated as the source of truth.', pri: 'Medium' },
  { area: 'Website', text: 'The contact form sends to one person\u2019s personal inbox.', pri: 'Medium' },
];

function auditInner(which) {
  const n = which === 'all' ? FINDINGS.length : Number(which);
  return `<div class="doc"><div class="doc-head"><div><span class="small">GTM audit, sample findings</span><p class="t">Halden Physiotherapy</p></div><span class="small">Concept study</span></div>` +
    FINDINGS.slice(0, n).map((f) => `<div class="find"><span class="area">${esc(f.area)}</span><p>${esc(f.text)}</p><span class="pri ${f.pri === 'High' ? 'high' : ''}">${esc(f.pri)}</span></div>`).join('') +
    `<p class="doc-foot"><b>Fix first:</b> route every inquiry, from every channel, into one shared list with a named owner and a same-day reply target.</p></div>`;
}

const flowArrow = '<div class="flow-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M3 12h17M14 6l6 6-6 6" stroke="currentColor" stroke-width="1.4"/></svg></div>';
const flowInner = `
<div class="flow">
<div class="flow-col"><h4>Where inquiries arrive</h4>
<div class="node leak">Website form<small>Goes to one personal inbox</small></div>
<div class="node leak">Instagram DMs<small>No owner</small></div>
<div class="node">WhatsApp<small>Front desk phone</small></div>
<div class="node leak">Phone calls<small>Not logged anywhere</small></div>
</div>${flowArrow}
<div class="flow-col"><h4>First response</h4>
<div class="node">Front desk<small>Replies between appointments</small></div>
<div class="node leak">Owner<small>Picks up whatever is left, often late</small></div>
</div>${flowArrow}
<div class="flow-col"><h4>Outcome</h4>
<div class="node ok">Consultation booked</div>
<div class="node leak">Went quiet<small>No follow-up</small></div>
</div>
</div>
<div class="flow-legend"><i aria-hidden="true"></i>Marked points are where inquiries get lost.</div>`;

const PEOPLE = {
  NK: { name: 'Neha Kapoor', role: 'Owner' },
  PS: { name: 'Priya Shah', role: 'Project manager' },
  AR: { name: 'Aarav Rao', role: 'Client lead' },
  RM: { name: 'Rohan Mehta', role: 'Designer' },
};
const CLIENTS = [
  { name: 'Desai Residence', stage: 'Proposal', owner: 'AR', last: '2 days ago', next: 'Follow up on revised quote', pm: 'PS' },
  { name: 'Lumen Dental Clinic', stage: 'Active', owner: 'PS', last: 'Today', next: 'Site visit on Thursday', pm: 'PS' },
  { name: 'Ostara Café', stage: 'Onboarding', owner: 'PS', last: 'Yesterday', next: 'Kickoff call on Wednesday', pm: 'PS' },
  { name: 'Verma Builders', stage: 'Lead', owner: 'AR', last: '5 days ago', next: 'Book first call', pm: null },
  { name: 'Seabreeze Villas', stage: 'Active', owner: 'RM', last: 'Today', next: 'Approve material samples', pm: 'PS' },
  { name: 'Kulkarni & Co. Office', stage: 'Lead', owner: null, last: 'New inquiry', next: 'Assign an owner', pm: null },
];
const TASKS = [
  { id: 1, t: 'Reply to website inquiry', client: 'Kulkarni & Co. Office', who: null, due: 'Overdue', late: true },
  { id: 2, t: 'Book first call', client: 'Verma Builders', who: 'AR', due: 'Overdue', late: true },
  { id: 3, t: 'Send revised quote', client: 'Desai Residence', who: 'AR', due: 'Today' },
  { id: 4, t: 'Upload second moodboard', client: 'Seabreeze Villas', who: 'RM', due: 'Today' },
  { id: 5, t: 'Share site-visit checklist', client: 'Lumen Dental Clinic', who: 'PS', due: 'Wed' },
  { id: 6, t: 'Prepare material board', client: 'Seabreeze Villas', who: 'RM', due: 'Thu' },
  { id: 7, t: 'Request floor plans', client: 'Ostara Café', who: 'PS', due: 'Done', done: true },
];
const EVENTS = [
  { day: 'Today', time: '11:30', t: 'Design review', client: 'Seabreeze Villas', who: 'RM' },
  { day: 'Today', time: '16:00', t: 'Quote walkthrough', client: 'Desai Residence', who: 'AR' },
  { day: 'Wed', time: '10:00', t: 'Kickoff call', client: 'Ostara Café', who: 'PS' },
  { day: 'Thu', time: '09:30', t: 'Site visit', client: 'Lumen Dental Clinic', who: 'PS' },
  { day: 'Fri', time: '15:00', t: 'Weekly team review', client: 'Internal', who: 'NK' },
];
const ACCESS = {
  owner: { who: 'Neha Kapoor, owner', can: ['Every client and their contact details', 'All tasks and who owns them', 'Team workload', 'Pipeline and reports'], cannot: ['Nothing is hidden from the owner'] },
};

const av = (id) => id ? `<span class="av" title="${esc(PEOPLE[id].name)}">${id}</span>` : `<span class="av empty" title="No owner">?</span>`;
const openTasks = () => TASKS.filter((t) => !t.done);
const stats = () => {
  const today = openTasks().filter((t) => t.due === 'Today').length;
  const late = openTasks().filter((t) => t.late).length;
  return `<div class="stats"><div class="stat"><b>${today}</b><span>Due today</span></div><div class="stat ${late ? 'warn' : ''}"><b>${late}</b><span>Overdue</span></div><div class="stat"><b>${EVENTS.length}</b><span>Meetings this week</span></div></div>`;
};
const attention = (n) => {
  const items = openTasks().filter((t) => t.late || t.due === 'Today').slice(0, n);
  return `<div class="panel"><div class="panel-h">Needs attention <span>${items.length} items</span></div>${items.map((t) => `<div class="li"><div class="t"><b>${esc(t.t)}</b><span>${esc(t.client)}</span></div><span class="due ${t.late ? 'late' : ''}">${esc(t.due)}</span>${av(t.who)}</div>`).join('')}</div>`;
};
const teamLoad = () => `<div class="panel"><div class="panel-h">Team <span>Open work</span></div>${['PS', 'AR', 'RM'].map((k) => {
  const n = openTasks().filter((t) => t.who === k).length;
  return `<div class="li"><div class="t"><b>${esc(PEOPLE[k].name)}</b><span>${esc(PEOPLE[k].role)}</span></div><span class="due">${n} open</span>${av(k)}</div>`;
}).join('')}</div>`;
const pipeline = () => {
  const stages = ['Lead', 'Proposal', 'Onboarding', 'Active'];
  const max = Math.max(...stages.map((s) => CLIENTS.filter((c) => c.stage === s).length));
  return `<div class="panel"><div class="panel-h">Clients by stage <span>${CLIENTS.length} total</span></div><div style="padding:6px 0">${stages.map((s) => {
    const n = CLIENTS.filter((c) => c.stage === s).length;
    return `<div class="bar"><span>${s}</span><i style="width:${Math.max(6, n / max * 100)}%"></i><em>${n}</em></div>`;
  }).join('')}</div></div>`;
};
const homeUi = () => `<div class="ui-head"><span class="ui-title">Good morning, Neha</span><span class="ui-sub">Tuesday</span></div>${stats()}<div class="cols">${attention(4)}${teamLoad()}</div>`;
const ownerUi = () => `<div class="ui-head"><span class="ui-title">Good morning, Neha</span><span class="ui-sub">Owner view</span></div>${stats()}<div class="cols">${attention(5)}<div class="stack">${pipeline()}${teamLoad()}</div></div>`;
const accessHtml = () => {
  const a = ACCESS.owner;
  return `<h3>${esc(a.who)}</h3><p class="small" style="margin-bottom:14px">What this role can see</p><ul>${a.can.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="small" style="margin-bottom:6px">Hidden from this role</p><ul class="no">${a.cannot.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
};

function hydrate(html) {
  let next = html.replace(/<div data-audit="([^"]+)"><\/div>/g, (_, which) => `<div data-audit="${which}">${auditInner(which)}</div>`);
  next = next.replace(/<div data-flow><\/div>/g, `<div data-flow>${flowInner}</div>`);
  next = next.replace('<div class="ui ui-pad" id="home-ui"></div>', `<div class="ui ui-pad" id="home-ui">${homeUi()}</div>`);
  next = next.replace('<div class="ui ui-pad role-panel" id="role-panel" role="tabpanel" aria-labelledby="r-owner" tabindex="0"></div>', `<div class="ui ui-pad role-panel" id="role-panel" role="tabpanel" aria-labelledby="r-owner" tabindex="0">${ownerUi()}</div>`);
  next = next.replace('<aside class="access" aria-live="polite" id="access"></aside>', `<aside class="access" aria-live="polite" id="access">${accessHtml()}</aside>`);
  return next;
}

function words(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function ldBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

const head = source.match(/<head>[\s\S]*?<\/head>/)[0];
const header = extractBalanced(source, /<header class="hdr"/, 'header');
const mnav = extractBalanced(source, /<nav class="mnav"/, 'nav');
const footer = extractBalanced(source, /<footer class="ftr"/, 'footer');
const script = source.match(/<script>\s*\/\* =+\s*SITE CONFIGURATION[\s\S]*?<\/script>/)[0];
const pageHtml = extractAllPages(source);

if (!pageHtml.home || !pageHtml.gtm || !pageHtml.dashboards || !pageHtml.contact || !pageHtml.privacy || !pageHtml.terms) {
  throw new Error(`Missing pages in source: ${Object.keys(pageHtml).join(', ')}`);
}

const workSection = extractBalanced(pageHtml.home, /<section class="sec rule work"/, 'section')
  .replace('<h2 class="h2" id="work-title">Studies</h2>', '<h1 class="h2" id="work-title">Studies</h1>');
const aboutSection = extractBalanced(pageHtml.home, /<section class="sec paper studio"/, 'section')
  .replace('<h2 class="h2" id="studio-title">Small details. Clear thinking. Work that makes sense.</h2>', '<h1 class="h2" id="studio-title">Small details. Clear thinking. Work that makes sense.</h1>');

const content = {
  home: pageHtml.home,
  gtm: showPage(pageHtml.gtm),
  dashboards: showPage(pageHtml.dashboards),
  work: `<div class="page" data-page="work">\n${workSection}\n</div>`,
  about: `<div class="page" data-page="about">\n${aboutSection}\n</div>`,
  contact: showPage(pageHtml.contact),
  privacy: showPage(pageHtml.privacy),
  terms: showPage(pageHtml.terms),
};

for (const stale of ['gtm-audit.html', 'client-dashboards.html', 'work.html', 'about.html', 'contact.html', 'privacy.html', 'terms.html']) {
  fs.rmSync(path.join(root, stale), { force: true });
}

const titles = new Set();
const canonicals = new Set();

for (const page of pages) {
  const pageHead = page.id === 'home' ? head : applyMeta(head, page);
  let doc = `<!DOCTYPE html>\n<html lang="en">\n<!-- Generated from src/index.html by build.mjs. Edit the source, then run node build.mjs. -->\n${pageHead}\n<body>\n<a class="skip" href="#content" id="skip">Skip to content</a>\n${header}\n${mnav}\n<main id="content" tabindex="-1">\n${content[page.id]}\n</main>\n${footer}\n${script}\n</body>\n</html>\n`;
  doc = markCurrent(hydrate(doc), page.path);
  const file = path.join(root, page.file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, doc);
  assertPage(doc, page, head);
  titles.add(doc.match(/<title>([^<]*)<\/title>/)[1]);
  canonicals.add(doc.match(/<link rel="canonical" href="([^"]+)"/)[1]);
}

if (titles.size !== pages.length) throw new Error(`Titles are not unique (${titles.size})`);
if (canonicals.size !== pages.length) throw new Error(`Canonicals are not unique (${canonicals.size})`);

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const llms = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');
const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
for (const page of pages) {
  const url = SITE + (page.path === '/' ? '/' : page.path);
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`sitemap missing ${url}`);
  if (!llms.includes(url)) throw new Error(`llms.txt missing ${url}`);
}
if (!robots.includes('Sitemap: https://revenueos.co.in/sitemap.xml')) throw new Error('robots.txt missing sitemap');
if (!robots.includes('Allow: /')) throw new Error('robots.txt missing Allow');
const google = fs.readFileSync(path.join(root, 'google9345a796b13910f7.html'), 'utf8');
if (!google.includes('google-site-verification: google9345a796b13910f7.html')) throw new Error('Google verification file changed');
const bing = fs.readFileSync(path.join(root, 'BingSiteAuth.xml'), 'utf8');
if (!bing.includes('C369415722311E4089C3F331A9E216CC')) throw new Error('Bing verification file changed');
const vercel = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
if (vercel.includes('google9345a796b13910f7.html')) throw new Error('vercel.json must not redirect the Google verification file');

console.log(`Built ${pages.length} HTML files.`);

function assertPage(doc, page, originalHead) {
  const body = doc.slice(doc.indexOf('<body'));
  const h1s = body.match(/<h1\b/g) || [];
  if (h1s.length !== 1) throw new Error(`${page.file} has ${h1s.length} h1 elements`);
  if (!body.includes(page.expect)) throw new Error(`${page.file} missing expected copy`);
  if (doc.includes('href="#/')) throw new Error(`${page.file} still has a hash route`);
  if (!doc.includes('name="msvalidate.01" content="C369415722311E4089C3F331A9E216CC"')) {
    throw new Error(`${page.file} missing Bing meta verification`);
  }
  if (!doc.includes('property="og:image" content="https://revenueos.co.in/og.png"')) {
    throw new Error(`${page.file} missing og:image`);
  }
  const blocks = ldBlocks(doc);
  if (page.id === 'home') {
    if (!originalHead.includes(doc.match(/<head>[\s\S]*?<\/head>/)[0].match(/<script type="application\/ld\+json">[\s\S]*<\/script>/)[0])) {
      throw new Error('Homepage JSON-LD changed');
    }
    const types = blocks.map((b) => b['@type']);
    if (!types.includes('ProfessionalService') || !types.includes('FAQPage')) {
      throw new Error(`Homepage JSON-LD types: ${types.join(', ')}`);
    }
    if (types.includes('BreadcrumbList')) throw new Error('Homepage should not add a breadcrumb');
  } else {
    const canonical = `${SITE}${page.path}`;
    const title = doc.match(/<title>([^<]*)<\/title>/)[1];
    if (title !== escAttr(page.title)) throw new Error(`${page.file} title mismatch: ${title}`);
    const description = doc.match(/<meta name="description" content="([^"]*)"/)[1];
    if (description !== escAttr(page.description)) throw new Error(`${page.file} description mismatch`);
    for (const attr of ['<link rel="canonical" href="', '<meta property="og:url" content="']) {
      if (!doc.includes(attr + canonical + '"')) throw new Error(`${page.file} missing ${attr}${canonical}`);
    }
    if (!doc.includes(`<meta property="og:title" content="${escAttr(page.title)}"`)) throw new Error(`${page.file} og:title`);
    if (!doc.includes(`<meta property="og:description" content="${escAttr(page.description)}"`)) throw new Error(`${page.file} og:description`);
    const crumb = blocks.find((b) => b['@type'] === 'BreadcrumbList');
    if (!crumb || crumb.itemListElement.length !== 2) throw new Error(`${page.file} breadcrumb`);
    if (crumb.itemListElement[1].item !== canonical || crumb.itemListElement[1].name !== page.crumb) {
      throw new Error(`${page.file} breadcrumb target`);
    }
    const service = blocks.find((b) => b['@type'] === 'Service');
    if (page.service) {
      if (!service || service.name !== page.service.name || service.url !== canonical) throw new Error(`${page.file} service schema`);
      if (service.provider.name !== 'RevenueOS' || service.areaServed.name !== 'India') throw new Error(`${page.file} service provider`);
    } else if (service) {
      throw new Error(`${page.file} should not include a Service schema`);
    }
    if (blocks.some((b) => b['@type'] === 'FAQPage' || b['@type'] === 'ProfessionalService')) {
      throw new Error(`${page.file} should not repeat the homepage JSON-LD`);
    }
  }
  if (page.service) {
    const answer = doc.match(/<p class="text answer">([\s\S]*?)<\/p>/);
    if (!answer) throw new Error(`${page.file} missing answer intro`);
    const count = words(answer[1]);
    if (count < 40 || count > 60) throw new Error(`${page.file} intro is ${count} words`);
    if (!answer[1].startsWith('RevenueOS is ')) throw new Error(`${page.file} intro shape`);
  }
  const foreign = [...doc.matchAll(/data-page="([^"]+)"/g)].map((m) => m[1]);
  if (foreign.length !== 1 || foreign[0] !== page.id) throw new Error(`${page.file} page ids ${foreign.join(',')}`);
}
