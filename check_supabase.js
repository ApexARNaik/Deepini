const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lkbcqnzhiuinqgfledsc.supabase.co';
const supabaseAnonKey = 'sb_publishable_vRm_nsFn8m8M4reOSiHNbg_YAIx-PTI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

// Shim fetch to avoid node-fetch / websocket issues for this simple test
// Or just let it run.

async function test() {
  const componentData = {
    id: undefined,
    name: 'Test Component JS Client',
    price: null,
    purchase_source: null,
    datasheet_link: null,
    low_stock_threshold: null,
    notes: null,
    photo_url: null,
    custom_fields: {}
  };
  const { data, error } = await supabase.from('components').insert([componentData]).select().single();
  console.log('Error:', error);
  console.log('Data:', data);
}

test();
test();


