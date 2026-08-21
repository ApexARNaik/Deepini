fetch('https://lkbcqnzhiuinqgfledsc.supabase.co/rest/v1/rooms?select=*', {
  headers: {
    'apikey': 'sb_publishable_vRm_nsFn8m8M4reOSiHNbg_YAIx-PTI'
  }
}).then(r => r.json()).then(console.log).catch(console.error);
