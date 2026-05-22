window.CL = window.CL || {};
window.CL.affiliate = {
  async track(affiliateName, articleId) {
    await window.CL.supabase
      .from('affiliate_clicks')
      .insert({ affiliate_name: affiliateName, article_id: articleId || null });
  },
  trackRead(articleId) {}
};

(function () {
  const btn = document.createElement('a');
  btn.href = 'https://www.bsmkweb.cc/register?ref=1216493484';
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.onclick = () => window.CL.affiliate.track('binance', null);
  btn.innerHTML = `
    <div style="position:fixed;bottom:24px;right:24px;z-index:999;background:#F0B90B;color:#000;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;padding:10px 16px;border-radius:6px;box-shadow:0 4px 20px rgba(240,185,11,0.4);cursor:pointer;display:flex;align-items:center;gap:8px;text-decoration:none;transition:transform .15s">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L7.5 4.5 12 9l4.5-4.5L12 0zM0 12l4.5-4.5L9 12l-4.5 4.5L0 12zm15 0l4.5-4.5L24 12l-4.5 4.5L15 12zm-3 3l-4.5 4.5L12 24l4.5-4.5L12 15z"/></svg>
      Trade on Binance
    </div>`;
  btn.onmouseenter = () => btn.firstElementChild.style.transform = 'scale(1.05)';
  btn.onmouseleave = () => btn.firstElementChild.style.transform = 'scale(1)';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(btn));
})();
