const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lkbcqnzhiuinqgfledsc.supabase.co';
const supabaseAnonKey = 'sb_publishable_vRm_nsFn8m8M4reOSiHNbg_YAIx-PTI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('Checking rooms table...');
  const { data, error } = await supabase.from('rooms').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Rooms:', data);
  }
}

check();
