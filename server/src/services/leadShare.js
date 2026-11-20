import { supabase } from '../supabase.js';
import { sendMail } from './mailer.js';

// Share a student enquiry with a partner college (only if the student agreed to it).
export async function shareLead(leadId, collegeId, { force = false } = {}) {
  const { data: lead, error } = await supabase.from('leads').select('*, colleges:college_id(name)').eq('id', leadId).single();
  if (error) throw error;
  if (!lead.consent_share && !force) throw Object.assign(new Error('The student did not agree to share their details with the college'), { status: 409 });
  const { data: partner } = await supabase.from('college_partners').select('*, colleges(name)').eq('college_id', collegeId).maybeSingle();
  if (!partner?.is_active) throw Object.assign(new Error('This college is not an active lead partner'), { status: 409 });
  await supabase.from('leads').update({ shared_with: collegeId, shared_at: new Date().toISOString() }).eq('id', leadId);
  const lines = [
    `New student enquiry from StudyEarnstay for ${partner.colleges?.name || 'your institution'}`,
    '',
    `Name: ${lead.full_name}`, `Phone: ${lead.phone}`, lead.email ? `Email: ${lead.email}` : null,
    lead.city ? `City: ${lead.city}` : null, lead.course_interest ? `Course interest: ${lead.course_interest}` : null,
    lead.message ? `Message: ${lead.message}` : null, '',
    'The student agreed to be contacted by the college about admission.',
  ].filter((l) => l !== null);
  const mailed = await sendMail({ to: partner.contact_email, subject: `New enquiry: ${lead.full_name}`, text: lines.join('\n'), replyTo: lead.email || undefined })
    .catch((e) => { console.warn('[leadShare mail]', e.message); return false; });
  return { shared: true, mailed };
}

export async function autoShare(lead) {
  if (!lead?.consent_share || !lead.college_id) return;
  const { data: p } = await supabase.from('college_partners').select('auto_share, is_active').eq('college_id', lead.college_id).maybeSingle();
  if (p?.is_active && p.auto_share) await shareLead(lead.id, lead.college_id).catch((e) => console.warn('[autoShare]', e.message));
}
