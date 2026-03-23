import { copy } from "./copy";

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

export const envError =
  !env.supabaseUrl || !env.supabaseAnonKey
    ? copy.errors.missingEnv
    : null;
