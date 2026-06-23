import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

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
