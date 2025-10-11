import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://tljijdvhswycixtmxtnp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsamlqZHZoc3d5Y2l4dG14dG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMzQ2MDMsImV4cCI6MjA3NTYxMDYwM30.MBDeY_kS3_W7AJUOnyPVTPIk7AEL8C-DJVzk35JjJjY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);