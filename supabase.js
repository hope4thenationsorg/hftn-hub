import { createClient } from '@supabase/supabase-js'
// NOTE: this file is a full drop-in replacement for your existing supabase.js.
// Everything above the "needs tracker" section is unchanged from your original file.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)

// ── DB helpers — house entries ─────────────────────────────────────────────
export async function loadEntry(house, year, month) {
  const { data, error } = await supabase
    .from('house_entries')
    .select('*')
    .eq('house', house)
    .eq('year', year)
    .eq('month', month)
    .single()
  if (error || !data) return null
  return data
}
export async function saveEntry(house, year, month, fields) {
  const payload = { house, year, month, ...fields, updated_at: new Date().toISOString() }
  const { error } = await supabase
    .from('house_entries')
    .upsert(payload, { onConflict: 'house,year,month' })
  return !error
}
export async function loadAllForMonth(year, month) {
  const { data, error } = await supabase
    .from('house_entries')
    .select('*')
    .eq('year', year)
    .eq('month', month)
  if (error || !data) return {}
  const result = {}
  data.forEach(row => { result[row.house] = row })
  return result
}
export async function getMonthsWithData(house, year) {
  const { data, error } = await supabase
    .from('house_entries')
    .select('month')
    .eq('house', house)
    .eq('year', year)
  if (error || !data) return []
  return data.map(r => r.month)
}

// ── DB helpers — needs tracker ─────────────────────────────────────────────
function computeStatus(needed, raised) {
  if (raised >= needed && needed > 0) return 'fulfilled'
  if (raised > 0) return 'partial'
  return 'open'
}

export async function loadNeeds() {
  const { data, error } = await supabase
    .from('needs')
    .select('*')
    .order('date_logged', { ascending: false })
  if (error || !data) return []
  return data
}

export async function addNeed(fields) {
  const status = computeStatus(Number(fields.amount_needed) || 0, Number(fields.amount_raised) || 0)
  const payload = { ...fields, status, updated_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('needs')
    .insert(payload)
    .select()
    .single()
  if (error) return null
  return data
}

export async function updateNeed(id, fields) {
  const status = computeStatus(Number(fields.amount_needed) || 0, Number(fields.amount_raised) || 0)
  const payload = { ...fields, status, updated_at: new Date().toISOString() }
  const { error } = await supabase
    .from('needs')
    .update(payload)
    .eq('id', id)
  return !error
}

export async function deleteNeed(id) {
  const { error } = await supabase
    .from('needs')
    .delete()
    .eq('id', id)
  return !error
}
