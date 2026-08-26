

// Let's just simulate the EXACT logic from api.ts
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://lkbcqnzhiuinqgfledsc.supabase.co';
const supabasePublishableKey = 'sb_publishable_vRm_nsFn8m8M4reOSiHNbg_YAIx-PTI';
const supabase = createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false } });

async function test() {
  const { data: locs, error: locErr } = await supabase.from("component_locations").select(`
    *,
    spatial_hotspots(
      *,
      spatial_photos(
        *,
        rooms(*)
      )
    )
  `);
  
  if (locErr) {
    console.log("Error hint:", locErr.hint);
    console.log("Error details:", locErr.details);
  } else {
    console.log("Success:", locs);
  }
}
test();



