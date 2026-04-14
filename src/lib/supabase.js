import { createClient } from '@supabase/supabase-js'

// Debes crear un archivo .env en la raíz del proyecto (junto a package.json)
// y colocar ahí estas dos variables:
// VITE_SUPABASE_URL=tu_url_de_supabase
// VITE_SUPABASE_ANON_KEY=tu_anon_key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
