// 앱 시작: 화면 전환, 클릭 처리, 단축키
const App = (() => {
  const ROUTES = ['today', 'calendar', 'tasks', 'courses', 'settings'];
  const main = document.getElementById('main');

  const route = () => { const r = location.hash.slice(1); return ROUTES.includes(r) ? r : 'today'; };

  function applyTheme() {
    const t = Store.state.settings.theme, root = document.documentElement;
    if (t === 'system') delete root.dataset.theme; else root.dataset.theme = t;
  }

  function render() {
    const r = route();
    applyTheme();
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + r));
    Views[r](main);
  }

  // 왼쪽(폰은 아래) 메뉴의 저장·동기화 상태 표시
  function renderSyncStatus() {
    const el = document.querySelector('.side-foot');
    const s = Sync.status;
    const [cls, text] = !Sync.enabled() ? ['', '이 기기에 저장됨']
      : !Sync.signedIn ? ['warn', '동기화 꺼짐 · 로그인 필요']
      : s === 'syncing' ? ['', '동기화 중…']
      : s === 'ok' ? ['ok', '동기화됨']
      : s === 'offline' ? ['warn', '오프라인 · 이 기기에 저장됨']
      : s === 'error' ? ['err', '동기화 오류'] : ['', '연결됨'];
    el.className = `side-foot ${cls}`;
    el.textContent = text;
    el.title = Sync.message || '';
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  const common = {
    'new-task': el => Forms.task({ courseId: el.dataset.cid || '' }),
    'new-event': () => Forms.event(),
    'new-course': () => Forms.course(),
    'exception': el => Forms.exception({ courseId: el.dataset.cid || '' }),
    'edit-semester': () => Forms.semester(Store.semester()),
    'new-semester': () => Forms.semester(),
    'quick': () => Forms.quickAdd(),
    'free': () => Forms.freeTime(),
  };
  Object.assign(Actions, common);

  document.addEventListener('click', e => {
    if (e.target.closest('.modal-backdrop')) return;
    const t = e.target;
    const toggle = t.closest('[data-toggle-task]');
    if (toggle) {
      const task = Store.find('tasks', toggle.dataset.toggleTask);
      task.status = task.status === 'done' ? 'todo' : 'done';
      Store.commit();
      return;
    }
    const act = t.closest('[data-act]');
    if (act && Actions[act.dataset.act]) { Actions[act.dataset.act](act, e); return; }
    let el;
    if ((el = t.closest('[data-task]'))) return Forms.task(Store.find('tasks', el.dataset.task));
    if ((el = t.closest('[data-event]'))) return Forms.event(Store.find('events', el.dataset.event));
    if ((el = t.closest('[data-course]'))) return Forms.course(Store.course(el.dataset.course));
    if ((el = t.closest('[data-exception]'))) return Forms.exception(Store.find('exceptions', el.dataset.exception));
    if ((el = t.closest('[data-day]'))) { Cal.anchor = U.parseYmd(el.dataset.day); Cal.mode = 'week'; return render(); }
    const col = t.closest('.tg-col[data-date]');
    if (col) {
      const from = +col.closest('.tg').dataset.from;
      const min = from + Math.floor((e.clientY - col.getBoundingClientRect().top) / UI.HOUR * 2) * 30;
      Forms.event({ date: col.dataset.date, start: U.fromMin(min), end: U.fromMin(Math.min(min + 60, 1439)) });
    }
  });

  main.addEventListener('input', e => {
    if (e.target.dataset.filter === 'q') { TaskFilter.q = e.target.value; Views.taskList(main.querySelector('.task-groups')); }
  });
  main.addEventListener('change', e => {
    const f = e.target.dataset.filter, s = e.target.dataset.setting;
    if (f === 'course') { TaskFilter.course = e.target.value; Views.taskList(main.querySelector('.task-groups')); }
    if (f === 'semester') { Store.state.activeSemesterId = e.target.value; Store.commit(); }
    if (s) {
      Store.state.settings[s] = e.target.value;
      const st = Store.state.settings;
      if (st.dayEnd <= st.dayStart) { alert('끝 시간이 시작 시간보다 늦어야 해요.'); st.dayEnd = st.dayStart === '23:00' ? '23:59' : '22:00'; }
      Store.commit();
    }
    if (e.target.matches('[data-import]') && e.target.files[0]) Actions.import(e.target.files[0]);
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); Forms.quickAdd(); }
    else if (e.key === 'Escape') Modal.close();
  });

  main.addEventListener('submit', e => {
    if (e.target.matches('[data-login]')) { e.preventDefault(); Actions['sync-login'](); }
  });

  Store.subscribe(render);
  Sync.subscribe(() => {
    renderSyncStatus();
    // 로그인 칸에 입력 중일 때는 화면을 다시 그리지 않는다
    if (route() === 'settings' && Sync.signedIn) render();
  });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  // 시간이 흐르면 "진행 중"·현재 시각 선을 갱신
  setInterval(() => { if (!Modal.isOpen() && ['today', 'calendar'].includes(route())) render(); }, 60000);
  render();
  renderSyncStatus();
  Sync.start();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });

  return { render, toast };
})();
