// 과제 · 할 일 목록: 같은 화면 틀을 kind별로 따로 쓴다 (마감순, 남은/완료/전체, 과목·검색 필터)
const ListFilter = {
  assignment: { status: 'open', course: '', q: '' },
  todo: { status: 'open', course: '', q: '' },
};
const LIST = {
  assignment: { title: '과제', noun: '과제', subj: '과제가', add: 'new-task', items: () => UI.assignments() },
  todo: { title: '할 일', noun: '할 일', subj: '할 일이', add: 'new-todo', items: () => UI.todos() },
};

function listView(kind) {
  return root => {
    const f = ListFilter[kind], L = LIST[kind];
    root.innerHTML = `
      <header class="page-head"><h1>${L.title}</h1>
        <div class="head-actions"><button class="btn primary" data-act="${L.add}">+ ${L.noun}</button></div></header>
      <div class="toolbar">
        <div class="seg">${[['open', `남은 ${L.noun}`], ['done', '완료'], ['all', '전체']].map(([v, l]) =>
          `<button data-act="tf-status" data-kind="${kind}" data-v="${v}" class="${f.status === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <select data-filter="course" aria-label="과목 필터"><option value="">모든 과목</option>${Store.courses().map(c =>
          `<option value="${c.id}" ${f.course === c.id ? 'selected' : ''}>${U.esc(c.name)}</option>`).join('')}</select>
        <input type="search" data-filter="q" placeholder="검색" value="${U.esc(f.q)}" aria-label="${L.noun} 검색">
      </div>
      <div class="task-groups" data-kind="${kind}"></div>`;
    Views.taskList(root.querySelector('.task-groups'));
  };
}

Views.tasks = listView('assignment');
Views.todos = listView('todo');

Views.taskList = el => {
  const kind = el.dataset.kind, f = ListFilter[kind], L = LIST[kind];
  const q = f.q.trim().toLowerCase(), now = new Date();
  const all = L.items();
  const list = all.filter(t =>
    (!f.course || t.courseId === f.course) &&
    (!q || `${t.title} ${t.memo || ''} ${Store.course(t.courseId)?.name || ''}`.toLowerCase().includes(q)));
  const open = list.filter(t => t.status !== 'done').sort(UI.byDue);
  const done = list.filter(t => t.status === 'done').sort((a, b) => (b.due || '').localeCompare(a.due || ''));
  const dated = open.filter(t => t.due), n = t => U.daysUntil(new Date(t.due));
  let html = '';
  if (f.status !== 'done') {
    html += UI.group('마감 지남', dated.filter(t => new Date(t.due) < now), 'over')
      + UI.group('오늘', dated.filter(t => new Date(t.due) >= now && n(t) === 0))
      + UI.group('내일', dated.filter(t => n(t) === 1))
      + UI.group('이번 주 (7일 이내)', dated.filter(t => n(t) >= 2 && n(t) <= 7))
      + UI.group('이후', dated.filter(t => n(t) > 7))
      + UI.group('기한 없음', open.filter(t => !t.due));
  }
  if (f.status !== 'open') html += UI.group('완료', done, 'done');
  el.innerHTML = html || `<section class="card">${UI.empty(
    all.length ? `조건에 맞는 ${L.subj} 없어요.` : `아직 ${L.subj} 없어요.`,
    all.length ? '' : `<button class="btn primary" data-act="${L.add}">+ ${L.noun} 추가</button>`)}</section>`;
};

Actions['tf-status'] = el => { ListFilter[el.dataset.kind].status = el.dataset.v; App.render(); };
