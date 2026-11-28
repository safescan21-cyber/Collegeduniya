// "Future scope" for a course: the usual job roles and next studies for its subject area.
// General guidance by subject, not a promise — no salaries or placement numbers (those must come from official reports).

type Scope = { area: string; jobs: string[]; sectors: string[] };

const AREAS: [RegExp, Scope][] = [
  [/comput|software|informati|data science|artificial|machine learning|cyber|informatik|情報/i,
    { area: 'Computing', jobs: ['Software developer', 'Data analyst / data scientist', 'Cloud or DevOps engineer', 'Cyber-security analyst', 'AI / ML engineer'], sectors: ['IT services', 'Product companies', 'Banking & fintech', 'Start-ups', 'Research labs'] }],
  [/electric|electronic|elektro|communication engineering|telecom|vlsi|semiconductor/i,
    { area: 'Electrical & electronics', jobs: ['Electronics / hardware engineer', 'Embedded systems engineer', 'Power or energy engineer', 'Telecom engineer', 'Test & automation engineer'], sectors: ['Semiconductors', 'Power & renewables', 'Automotive', 'Telecom', 'Industrial automation'] }],
  [/mechanic|maschinenbau|automotive|aerospace|aeronaut|mechatronic|manufactur|industrial engineering/i,
    { area: 'Mechanical & manufacturing', jobs: ['Design / R&D engineer', 'Production or quality engineer', 'Automotive engineer', 'Maintenance engineer', 'Project engineer'], sectors: ['Automotive', 'Aerospace', 'Manufacturing', 'Energy', 'Consulting'] }],
  [/civil|bauingenieur|construction|structural|architect|urban|planning/i,
    { area: 'Civil & built environment', jobs: ['Site / structural engineer', 'Architect', 'Urban planner', 'Project manager', 'Surveyor'], sectors: ['Construction', 'Infrastructure', 'Government works', 'Real estate', 'Consulting'] }],
  [/chemical|chemie|chemistry|process engineering|biotech|bioengineer|pharma/i,
    { area: 'Chemistry, biotech & pharma', jobs: ['Process / chemical engineer', 'Lab scientist', 'Quality control analyst', 'Regulatory affairs associate', 'Research associate'], sectors: ['Pharmaceuticals', 'Chemicals', 'Food processing', 'Biotech', 'Research institutes'] }],
  [/medic|medizin|mbbs|surgery|dentist|nursing|pflege|health|public health|physiother|pharmacy/i,
    { area: 'Health & medicine', jobs: ['Doctor / dentist (after licensing)', 'Nurse', 'Public-health officer', 'Clinical research associate', 'Hospital administrator'], sectors: ['Hospitals', 'Public health', 'Clinical research', 'Health-tech', 'NGOs'] }],
  [/business|management|mba|betriebswirt|commerce|marketing|finance|account|econom|banking|logistic|supply chain/i,
    { area: 'Business & economics', jobs: ['Business / financial analyst', 'Marketing executive', 'Accountant or auditor', 'Supply-chain manager', 'Management consultant'], sectors: ['Banking & finance', 'Consulting', 'FMCG & retail', 'E-commerce', 'Government'] }],
  [/law|jura|legal|llb|llm/i,
    { area: 'Law', jobs: ['Lawyer (after bar licensing)', 'Corporate legal associate', 'Compliance officer', 'Legal researcher', 'Policy analyst'], sectors: ['Law firms', 'Companies', 'Courts', 'Government', 'NGOs'] }],
  [/math|statistic|actuar|physics|physik/i,
    { area: 'Maths & physics', jobs: ['Data scientist', 'Quantitative / risk analyst', 'Actuary', 'Research scientist', 'Teacher or lecturer'], sectors: ['Finance & insurance', 'Technology', 'Research', 'Education', 'Defence & space'] }],
  [/biolog|life science|environment|agri|forestry|ecolog|geo|earth|marine/i,
    { area: 'Life & earth sciences', jobs: ['Research scientist', 'Environmental consultant', 'Agricultural scientist', 'Lab analyst', 'Conservation officer'], sectors: ['Research', 'Agriculture & food', 'Environment', 'Government', 'NGOs'] }],
  [/design|art|fashion|media|film|music|animation|journalism|communication/i,
    { area: 'Design, media & arts', jobs: ['Designer (UI/UX, graphic, product)', 'Content creator / journalist', 'Animator or editor', 'Brand / communications executive', 'Art director'], sectors: ['Media & advertising', 'Tech product teams', 'Publishing', 'Entertainment', 'Freelance'] }],
  [/psycholog|sociolog|social|politic|international relations|history|philosoph|languag|linguist|literature|education|teach/i,
    { area: 'Humanities & social sciences', jobs: ['Researcher or policy analyst', 'Counsellor (psychology, after licensing)', 'Teacher or lecturer', 'HR / people executive', 'Content or communications writer'], sectors: ['Education', 'Government & policy', 'NGOs', 'Media', 'Corporate HR'] }],
  [/hotel|hospitality|tourism|culinary/i,
    { area: 'Hospitality & tourism', jobs: ['Hotel operations manager', 'Event manager', 'Travel consultant', 'Food & beverage manager'], sectors: ['Hotels', 'Airlines & travel', 'Events', 'Restaurants'] }],
];

const NEXT: Record<string, string> = {
  UG: 'Next: a master’s degree, a professional certification, or a job straight away.',
  Bachelor: 'Next: a master’s degree, a professional certification, or a job straight away.',
  PG: 'Next: a senior or specialist role, a PhD, or research.',
  Master: 'Next: a senior or specialist role, a PhD, or research.',
  PhD: 'Next: research, university teaching, or R&D roles in industry.',
};

export function careerScope(courseName: string, level?: string | null): (Scope & { next: string | null }) | null {
  const hit = AREAS.find(([re]) => re.test(courseName));
  if (!hit) return null;
  const lv = level || '';
  const next = NEXT[lv] || (/master|m\.?sc|m\.?a\b|mba|pg/i.test(courseName) ? NEXT.PG : /bachelor|b\.?sc|b\.?a\b|b\.?tech|ug/i.test(courseName) ? NEXT.UG : /phd|doctor/i.test(courseName) ? NEXT.PhD : null);
  return { ...hit[1], next };
}
