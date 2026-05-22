// Requires: Supabase CDN loaded, config.js loaded before this file
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let isProUser = false;
let _authListenerRegistered = false;

async function initAuth() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await _loadProStatus();
  }
  _updateNavUI();

  if (_authListenerRegistered) return;
  _authListenerRegistered = true;

  _supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    isProUser = false;
    if (currentUser) await _loadProStatus();
    _updateNavUI();
    document.dispatchEvent(new CustomEvent('authChanged', { detail: { currentUser, isProUser } }));
  });
}

async function _loadProStatus() {
  const { data } = await _supabase
    .from('users')
    .select('is_pro')
    .eq('id', currentUser.id)
    .single();
  isProUser = data?.is_pro ?? false;
}

function _updateNavUI() {
  const loginBtn = document.getElementById('nav-login-btn');
  const logoutBtn = document.getElementById('nav-logout-btn');
  const proLabel = document.getElementById('nav-pro-label');

  if (!loginBtn) return;

  if (currentUser) {
    loginBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (proLabel) {
      proLabel.textContent = isProUser ? 'PRO' : '';
      proLabel.classList.toggle('hidden', !isProUser);
    }
  } else {
    loginBtn.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (proLabel) proLabel.classList.add('hidden');
  }
}

async function sendMagicLink(email) {
  const { error } = await _supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  });
  return error;
}

async function signOut() {
  await _supabase.auth.signOut();
}

function openLoginModal() {
  document.getElementById('auth-modal')?.classList.remove('hidden');
}

function closeLoginModal() {
  document.getElementById('auth-modal')?.classList.add('hidden');
}

window.CL = window.CL || {};
window.CL.auth = { initAuth, sendMagicLink, signOut, openLoginModal, closeLoginModal };
window.CL.supabase = _supabase;
window.CL.getUser = () => currentUser;
window.CL.isPro = () => isProUser;
