/* ─── Footer clock ─────────────────────────────────────── */
const clockEl = document.getElementById('footerTime');
function updateClock() {
  if (!clockEl) return;
  clockEl.textContent = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
}
updateClock();
setInterval(updateClock, 60_000);

/* ─── Nav scroll shadow ────────────────────────────────── */
const nav = document.getElementById('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });
}
