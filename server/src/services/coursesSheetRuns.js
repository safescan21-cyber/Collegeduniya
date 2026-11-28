import { supabase } from '../supabase.js';
export { getUpload } from './sheetImport.js';

export async function startRunSafe(kind, params, startedBy) {
  const { data } = await supabase.from('import_runs').insert({ kind, params, started_by: startedBy }).select('id').single();
  return data?.id || null;
}
