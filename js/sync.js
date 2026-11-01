// Supabase 로그인과 동기화. 서버에는 사용자마다 한 줄(daybook_state)에 전체 데이터를 JSON으로 둔다.
// 오프라인이어도 앱은 이 기기 데이터로 그대로 동작하고, 다시 연결되면 합쳐서 올린다.
const Sync = (() => {
  const SKEY = 'daybook.session';
  const enabled = () => !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);
  const base = () => CONFIG.supabaseUrl.replace(/\/+$/, '');

  let session = null;
  try { session = JSON.parse(localStorage.getItem(SKEY)); } catch { }
  let status = 'idle', message = '', lastSync = 0;
  let running = null, again = false, timer = null;
  const subs = new Set();

  function setStatus(s, msg = '') { status = s; message = msg; subs.forEach(f => f()); }
  function saveSession(s) {
    session = s;
    try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch { }
  }

  async function request(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
    const res = await fetch(base() + path, {
      method,
      headers: {
        apikey: CONFIG.supabaseKey,
        'Content-Type': 'application/json',
        ...(auth && session ? { Authorization: 'Bearer ' + session.access_token } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const err = new Error((data && (data.error_description || data.msg || data.message || data.error)) || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const toSession = d => ({
    access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    user: { id: d.user.id, email: d.user.email },
  });

  async function refresh() {
    try {
      const d = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false });
      saveSession(toSession(d));
    } catch (e) {
      if (e.status === 400 || e.status === 401) { saveSession(null); setStatus('signedout', '로그인이 만료됐어요. 다시 로그인해 주세요.'); }
      throw e;
    }
  }

  async function authed(path, opts) {
    if (session.expires_at * 1000 - 60000 < Date.now()) await refresh();
    try { return await request(path, opts); }
    catch (e) {
      if (e.status !== 401) throw e;
      await refresh();
      return request(path, opts);
    }
  }

  // 서버(jsonb)는 키 순서를 바꿔서 돌려주므로 순서와 무관하게 비교한다
  const same = (a, b) => U.canon(a) === U.canon(b);

  async function syncOnce() {
    const uid = session.user.id;
    for (let attempt = 0; attempt < 3; attempt++) {
      const rev = Store.revision;
      const rows = await authed(`/rest/v1/daybook_state?select=data,version&user_id=eq.${uid}`);
      const remote = rows[0];
      // 아직 아무것도 입력하지 않은 새 기기는 빈 학기를 서버에 올리지 않는다
      if (!remote && Store.state.pristine) return;
      const merged = !remote ? Store.forSync()
        : Store.state.pristine ? remote.data
        : Store.merge(Store.forSync(), remote.data);
      const { pristine, ...toSend } = merged;
      if (!remote) {
        try {
          await authed('/rest/v1/daybook_state', { method: 'POST', body: { user_id: uid, data: toSend, version: 1 }, headers: { Prefer: 'return=minimal' } });
        } catch (e) { if (e.status === 409) continue; throw e; }
      } else if (!same(toSend, remote.data)) {
        const updated = await authed(`/rest/v1/daybook_state?user_id=eq.${uid}&version=eq.${remote.version}`, {
          method: 'PATCH', body: { data: toSend, version: remote.version + 1, updated_at: new Date().toISOString() },
          headers: { Prefer: 'return=representation' },
        });
        if (!updated.length) continue; // 그 사이 다른 기기가 먼저 올림 → 다시 받아서 합치기
      }
      // 동기화하는 동안 이 기기에서 또 고쳤으면 덮어쓰지 않고 한 번 더 돈다
      if (Store.revision !== rev) { again = true; return; }
      Store.applySynced(merged);
      return;
    }
    throw new Error('여러 기기에서 동시에 저장하고 있어요. 잠시 후 다시 시도할게요.');
  }

  function syncNow() {
    if (!enabled() || !session) return Promise.resolve();
    if (running) { again = true; return running; }
    setStatus('syncing');
    running = syncOnce()
      .then(() => { lastSync = Date.now(); setStatus('ok'); })
      .catch(e => {
        if (!session) return;
        setStatus(navigator.onLine === false || e instanceof TypeError ? 'offline' : 'error', e.message);
      })
      .finally(() => {
        running = null;
        if (again) { again = false; schedule(300); }
      });
    return running;
  }

  function schedule(ms = 1500) {
    clearTimeout(timer);
    timer = setTimeout(syncNow, ms);
  }

  async function signIn(email, password) {
    const d = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false });
    saveSession(toSession(d));
    setStatus('idle');
    await syncNow();
  }

  // 반환값: true = 바로 로그인됨, false = 확인 메일을 눌러야 함
  async function signUp(email, password) {
    const d = await request('/auth/v1/signup', { method: 'POST', body: { email, password }, auth: false });
    if (d && d.access_token) { saveSession(toSession(d)); setStatus('idle'); await syncNow(); return true; }
    return false;
  }

  function signOut() {
    if (session) request('/auth/v1/logout', { method: 'POST' }).catch(() => { });
    saveSession(null);
    setStatus('signedout');
  }

  function start() {
    if (!enabled()) { setStatus('off'); return; }
    if (!session) setStatus('signedout');
    Store.subscribe(source => { if (source === 'local') schedule(); });
    syncNow();
    setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
    window.addEventListener('online', () => syncNow());
  }

  return {
    enabled, start, syncNow, signIn, signUp, signOut,
    subscribe(f) { subs.add(f); },
    get status() { return status; },
    get message() { return message; },
    get lastSync() { return lastSync; },
    get email() { return session?.user.email || ''; },
    get signedIn() { return !!session; },
  };
})();
