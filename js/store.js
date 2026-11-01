// 데이터 저장소. 이 기기(localStorage)에 먼저 저장하고, 로그인하면 sync.js가 서버와 맞춘다.
// 동기화를 위해 저장할 때마다 바뀐 항목에 updatedAt을, 지운 항목은 deleted에 시각을 남긴다.
const Store = (() => {
  const KEY = 'daybook.v1';
  const COLORS = ['#5b7bd5', '#d0706a', '#4f9d7e', '#c99a3b', '#8a6cc7', '#3d9bb8', '#c46aa0', '#7a8a52'];
  const TASK_TYPES = ['과제', '퀴즈', '시험', '발표', '팀플', '기타'];
  const COLS = ['semesters', 'courses', 'exceptions', 'tasks', 'events', 'notes'];
  const TOMBSTONE_DAYS = 90;

  function newSemester() {
    const now = new Date(), y = now.getFullYear(), second = now.getMonth() >= 6;
    return {
      id: U.uid(),
      name: `${y}-${second ? 2 : 1}학기`,
      start: second ? `${y}-09-01` : `${y}-03-02`,
      end: second ? `${y}-12-20` : `${y}-06-20`,
    };
  }

  // pristine: 아직 아무것도 입력하지 않은 새 기기. 로그인하면 서버 내용을 그대로 받는다.
  function blank() {
    const sem = newSemester();
    return {
      version: 1, pristine: true,
      semesters: [sem], activeSemesterId: sem.id,
      courses: [], exceptions: [], tasks: [], events: [], notes: [],
      settings: { theme: 'system', dayStart: '09:00', dayEnd: '22:00' },
      settingsAt: 0, deleted: {},
    };
  }

  function migrate(s) {
    const b = blank();
    const out = { ...b, pristine: false, ...s, settings: { ...b.settings, ...(s.settings || {}) }, deleted: { ...(s.deleted || {}) } };
    if (!out.semesters.length) out.semesters = b.semesters;
    if (!out.semesters.some(x => x.id === out.activeSemesterId)) out.activeSemesterId = out.semesters[0].id;
    return out;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? migrate(JSON.parse(raw)) : blank();
    } catch { return blank(); }
  }

  function persist(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); }
    catch (e) { alert('저장에 실패했어요: ' + e.message); }
  }

  const itemKey = ({ updatedAt, ...rest }) => U.canon(rest);
  const settingsKey = s => U.canon([s.settings, s.activeSemesterId]);

  // 마지막 저장 때의 모습. 저장할 때 이것과 비교해서 바뀐 것·지운 것을 찾는다.
  let snap = {};
  function takeSnap() {
    snap = { settings: settingsKey(state) };
    for (const col of COLS) snap[col] = Object.fromEntries(state[col].map(it => [it.id, { key: itemKey(it), at: it.updatedAt || 0 }]));
  }

  // 기기 시계가 조금 어긋나도 "방금 한 수정"이 이기도록, 기존 시각보다 항상 뒤로 찍는다
  function stamp() {
    const now = Date.now();
    let changed = false;
    for (const col of COLS) {
      const prev = snap[col] || {};
      const ids = new Set();
      for (const it of state[col]) {
        ids.add(it.id);
        const p = prev[it.id];
        if (!p || p.key !== itemKey(it)) { it.updatedAt = Math.max(now, (p?.at || 0) + 1); changed = true; }
      }
      for (const id in prev) if (!ids.has(id)) { state.deleted[id] = Math.max(now, prev[id].at + 1); changed = true; }
    }
    if (snap.settings !== settingsKey(state)) { state.settingsAt = now; changed = true; }
    if (changed) state.pristine = false;
    return changed;
  }

  // 두 기기의 데이터를 합친다: 항목마다 더 최근에 고친 쪽, 지운 기록이 더 최근이면 삭제.
  function merge(a, b) {
    const deleted = { ...(a.deleted || {}) };
    for (const [id, t] of Object.entries(b.deleted || {})) deleted[id] = Math.max(deleted[id] || 0, t);
    const cutoff = Date.now() - TOMBSTONE_DAYS * 86400000;
    for (const id in deleted) if (deleted[id] < cutoff) delete deleted[id];
    const out = { ...a, deleted, pristine: false };
    for (const col of COLS) {
      const map = new Map();
      for (const it of [...(a[col] || []), ...(b[col] || [])]) {
        const cur = map.get(it.id);
        if (!cur || (it.updatedAt || 0) > (cur.updatedAt || 0)) map.set(it.id, it);
      }
      out[col] = [...map.values()].filter(it => !(deleted[it.id] >= (it.updatedAt || 0)));
    }
    const bNewer = (b.settingsAt || 0) > (a.settingsAt || 0);
    out.settings = { ...(bNewer ? b.settings : a.settings) };
    out.activeSemesterId = bNewer ? b.activeSemesterId : a.activeSemesterId;
    out.settingsAt = Math.max(a.settingsAt || 0, b.settingsAt || 0);
    return migrate(out);
  }

  let state = load();
  let revision = 0;
  takeSnap();
  const subs = new Set();
  const notify = source => subs.forEach(f => f(source));

  function commit() {
    stamp();
    takeSnap();
    revision++;
    persist(state);
    notify('local');
  }

  return {
    COLORS, TASK_TYPES,
    get state() { return state; },
    get revision() { return revision; },
    subscribe(f) { subs.add(f); },
    commit,
    upsert(col, item) {
      const arr = state[col], i = arr.findIndex(x => x.id === item.id);
      if (i >= 0) arr[i] = item; else arr.push(item);
      commit();
      return item;
    },
    remove(col, id) { state[col] = state[col].filter(x => x.id !== id); commit(); },
    find(col, id) { return state[col].find(x => x.id === id); },
    // 목표 메모: id는 'goal-day-날짜' 또는 'goal-week-그 주 월요일'. 비우면 지운다.
    note(id) { return state.notes.find(n => n.id === id)?.text || ''; },
    setNote(id, text) {
      const cur = state.notes.find(n => n.id === id);
      if (!text.trim()) { if (cur) this.remove('notes', id); }
      else if (!cur || cur.text !== text) this.upsert('notes', { id, text });
    },
    replaceAll(s) {
      const next = migrate(s);
      next.deleted = { ...state.deleted, ...next.deleted };
      state = next;
      commit();
    },
    // 전체 초기화: 모든 기기에서 지워지도록 삭제 기록을 남긴다
    clearAll() {
      for (const col of COLS) state[col] = [];
      const sem = newSemester();
      state.semesters = [sem];
      state.activeSemesterId = sem.id;
      commit();
    },
    merge,
    // 서버와 맞춘 결과를 이 기기에 반영 (사용자가 바꾼 게 아니므로 시각을 새로 찍지 않음)
    applySynced(next) {
      next = migrate(next);
      next.pristine = false;
      if (U.canon(next) === U.canon(state)) return false;
      state = next;
      takeSnap();
      revision++;
      persist(state);
      notify('sync');
      return true;
    },
    forSync() { const { pristine, ...rest } = state; return rest; },
    semester() { return state.semesters.find(s => s.id === state.activeSemesterId) || state.semesters[0]; },
    courses() { const id = this.semester().id; return state.courses.filter(c => c.semesterId === id); },
    course(id) { return id ? state.courses.find(c => c.id === id) : null; },
  };
})();
