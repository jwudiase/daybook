// 과제: 마감순 목록, 상태·과목·검색 필터
const TaskFilter = { status: 'open', course: '', q: '' };

Views.tasks = root => {
  root.innerHTML = `
    <header class="page-head"><h1>과제</h1>
      <div class="head-actions"><button class="btn primary" data-act="new-task">+ 과제</button></div></header>
    <div class="toolbar">
      <div class="seg">${[['open', '남은 과제'], ['done', '완료'], ['all', '전체']].map(([v, l]) =>
        `<button data-act="tf-status" data-v="${v}" class="${TaskFilter.status === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <select data-filter="course" aria-label="과목 필터"><option value="">모든 과목</option>${Store.courses().map(c =>
        `<option value="${c.id}" ${TaskFilter.course === c.id ? 'selected' : ''}>${U.esc(c.name)}</option>`).join('')}</select>
      <input type="search" data-filter="q" placeholder="검색" value="${U.esc(TaskFilter.q)}" aria-label="과제 검색">
    </div>
    <div class="task-groups"></div>`;
  Views.taskList(root.querySelector('.task-groups'));
};

Views.taskList = el => {
  const q = TaskFilter.q.trim().toLowerCase(), now = new Date();
  const list = Store.state.tasks.filter(t =>
    (!TaskFilter.course || t.courseId === TaskFilter.course) &&
    (!q || `${t.title} ${t.memo || ''} ${Store.course(t.courseId)?.name || ''}`.toLowerCase().includes(q)));
  const open = list.filter(t => t.status !== 'done').sort(UI.byDue);
  const done = list.filter(t => t.status === 'done').sort((a, b) => b.due.localeCompare(a.due));
  const n = t => U.daysUntil(new Date(t.due));
  let html = '';
  if (TaskFilter.status !== 'done') {
    html += UI.group('마감 지남', open.filter(t => new Date(t.due) < now), 'over')
      + UI.group('오늘', open.filter(t => new Date(t.due) >= now && n(t) === 0))
      + UI.group('내일', open.filter(t => n(t) === 1))
      + UI.group('이번 주 (7일 이내)', open.filter(t => n(t) >= 2 && n(t) <= 7))
      + UI.group('이후', open.filter(t => n(t) > 7));
  }
  if (TaskFilter.status !== 'open') html += UI.group('완료', done, 'done');
  el.innerHTML = html || `<section class="card">${UI.empty(
    Store.state.tasks.length ? '조건에 맞는 과제가 없어요.' : '아직 과제가 없어요.',
    Store.state.tasks.length ? '' : '<button class="btn primary" data-act="new-task">+ 과제 추가</button>')}</section>`;
};

Actions['tf-status'] = el => { TaskFilter.status = el.dataset.v; App.render(); };
