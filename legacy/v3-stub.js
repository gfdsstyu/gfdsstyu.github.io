// legacy v3 stub that forwards to v4 shell when present
(()=>{
  console.log('[gamlini v3 stub] loaded');
  try{ import('/main.v4.js').then(m=>m.default&&m.default()); }catch(e){ console.warn('v4 not available', e); }
})();
