// Who runs the site. Filled from web/.env.local so nothing here is invented — empty values are simply not shown.
const e = (v: string | undefined) => (v || '').trim();
export const ORG = {
  brand: 'Collegeolo',
  tagline: 'Study, Earn & Stay',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.collegeolo.com').replace(/\/$/, ''),
  legalName: e(process.env.NEXT_PUBLIC_ORG_LEGAL_NAME),          // registered business name, e.g. "XYZ Ventures (Proprietorship)"
  founder: e(process.env.NEXT_PUBLIC_ORG_FOUNDER) || 'Sonu Kumar Giri',   // your name, as you want it shown
  founderLinkedin: e(process.env.NEXT_PUBLIC_ORG_FOUNDER_LINKEDIN) || 'https://www.linkedin.com/in/SonuKumarGiri',
  founderPhoto: e(process.env.NEXT_PUBLIC_ORG_FOUNDER_PHOTO),     // e.g. /founder.jpg in web/public
  founderRole: e(process.env.NEXT_PUBLIC_ORG_FOUNDER_ROLE) || 'Founder',
  founderNote: e(process.env.NEXT_PUBLIC_ORG_FOUNDER_NOTE),       // a few lines in your own words
  started: e(process.env.NEXT_PUBLIC_ORG_STARTED),                // e.g. 2026
  address: e(process.env.NEXT_PUBLIC_ORG_ADDRESS),
  city: e(process.env.NEXT_PUBLIC_ORG_CITY),
  email: e(process.env.NEXT_PUBLIC_CONTACT_EMAIL) || 'hello@collegeolo.com',
  phone: e(process.env.NEXT_PUBLIC_CONTACT_PHONE),
  grievanceOfficer: e(process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER),
  grievanceEmail: e(process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL) || e(process.env.NEXT_PUBLIC_CONTACT_EMAIL) || 'hello@collegeolo.com',
  social: e(process.env.NEXT_PUBLIC_ORG_SOCIAL).split(',').map((s) => s.trim()).filter(Boolean),   // profile URLs, comma separated
  policyDate: e(process.env.NEXT_PUBLIC_POLICY_DATE) || '21 November 2026',
};

export const orgJsonLd = () => ({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${ORG.url}/#org`, name: ORG.brand, slogan: ORG.tagline, ...(ORG.legalName ? { legalName: ORG.legalName } : {}), url: ORG.url,
      logo: `${ORG.url}/icon.png`, email: ORG.email, ...(ORG.social.length ? { sameAs: ORG.social } : {}),
      ...(ORG.founder ? { founder: { '@id': `${ORG.url}/founder#person` } } : {}),
      ...(ORG.address ? { address: { '@type': 'PostalAddress', streetAddress: ORG.address, addressCountry: 'IN' } } : {}),
      contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: ORG.email, ...(ORG.phone ? { telephone: ORG.phone } : {}), availableLanguage: ['English', 'Hindi'] }] },
    ...(ORG.founder ? [{ '@type': 'Person', '@id': `${ORG.url}/founder#person`, name: ORG.founder, jobTitle: ORG.founderRole, url: `${ORG.url}/founder`,
      worksFor: { '@id': `${ORG.url}/#org` }, ...(ORG.founderLinkedin ? { sameAs: [ORG.founderLinkedin] } : {}) }] : []),
    { '@type': 'WebSite', '@id': `${ORG.url}/#site`, url: ORG.url, name: ORG.brand, publisher: { '@id': `${ORG.url}/#org` }, inLanguage: 'en-IN',
      potentialAction: { '@type': 'SearchAction', target: `${ORG.url}/colleges?q={q}`, 'query-input': 'required name=q' } },
  ],
});
