// 과목: 학기, 주간 시간표, 과목 목록, 휴강·보강
Views.courses = root => {
  const st = Store.state, sem = Store.semester(), courses = Store.courses();
  const days = [1, 2, 3, 4, 5];
  if (courses.some(c => c.slots.some(s => s.day === 6))) days.push(6);
  if (courses.some(c => c.slots.some(s => s.day === 0))) days.push(0);
  const cols = days.map(d => ({
    label: U.DAYS[d],
    items: courses.flatMap(c => c.slots.filter(s => s.day === d).map(s => ({
      start: s.start, end: s.end, title: c.name, sub: s.room || c.room, color: c.color, attrs: `data-course="${c.id}"`,
    }))),
  }));
  const all = cols.flatMap(c => c.items);
  const range = all.length
    ? { from: Math.floor(Math.min(...all.map(i => U.toMin(i.start))) / 60) * 60, to: Math.ceil(Math.max(...all.map(i => U.toMin(i.end))) / 60) * 60 }
    : { from: 9 * 60, to: 18 * 60 };
  const credits = courses.reduce((s, c) => s + (+c.credits || 0), 0);
  const ids = courses.map(c => c.id);
  const exs = st.exceptions.filter(x => ids.includes(x.courseId)).sort((a, b) => a.date.localeCompare(b.date));
  const todayKey = U.ymd(new Date());

  const semPicker = st.semesters.length > 1
    ? `<select data-filter="semester" aria-label="학기 선택">${st.semesters.map(s => `<option value="${s.id}" ${s.id === sem.id ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}</select>`
    : '';

  const cards = courses.map(c => {
    const mine = st.tasks.filter(t => t.courseId === c.id && t.status !== 'done');
    const openTodos = mine.filter(UI.isTodo).length, openTasks = mine.length - openTodos;
    const slots = c.slots.slice().sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7))
      .map(s => `${U.DAYS[s.day]} ${s.start}–${s.end}`).join(' · ');
    return `<div class="course-card" style="--c:${c.color}">
      <div class="cc-head"><b>${U.esc(c.name)}</b><span class="small muted">${c.credits}학점</span></div>
      <div class="small muted">${[c.professor, c.room].filter(Boolean).map(U.esc).join(' · ') || '&nbsp;'}</div>
      <div class="small">${slots || '수업 시간 없음'}</div>
      <div class="cc-foot"><span class="small muted">남은 과제 ${openTasks}개${openTodos ? ` · 할 일 ${openTodos}개` : ''}</span>
        <span><button class="btn small" data-act="new-task" data-cid="${c.id}">+ 과제</button>
        <button class="btn small" data-act="exception" data-cid="${c.id}">휴강·보강</button>
        <button class="btn small" data-course="${c.id}">편집</button></span></div>
    </div>`;
  }).join('');

  root.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${sem.start.replaceAll('-', '.')} – ${sem.end.replaceAll('-', '.')} · ${courses.length}과목 ${credits}학점</p>
        <h1>${U.esc(sem.name)}</h1></div>
      <div class="head-actions">${semPicker}
        <button class="btn" data-act="edit-semester">학기 설정</button>
        <button class="btn" data-act="new-semester">새 학기</button>
        <button class="btn primary" data-act="new-course">+ 과목</button>
      </div>
    </header>
    ${courses.length ? `<section class="card flush">${UI.timeGrid(cols, range)}</section>
      <div class="course-grid">${cards}</div>`
      : `<section class="card">${UI.empty('아직 과목이 없어요. 이번 학기 수업을 추가해 보세요.', '<button class="btn primary" data-act="new-course">+ 첫 과목 추가</button>')}</section>`}
    <section class="card">
      <div class="card-head"><h3>휴강 · 보강</h3><button class="btn small" data-act="exception">+ 등록</button></div>
      ${exs.length ? `<ul class="plain-list">${exs.map(x => {
        const c = Store.course(x.courseId), d = U.parseYmd(x.date);
        return `<li data-exception="${x.id}" class="${x.date < todayKey ? 'is-past' : ''}">
          <span class="badge ${x.type === 'cancel' ? '' : 'now'}">${x.type === 'cancel' ? '휴강' : '보강'}</span>
          ${UI.courseTag(c)}<span>${U.fmtShort(d)}${x.type === 'makeup' ? ` ${x.start}–${x.end}` : ''}</span>
          <span class="muted small">${U.esc(x.memo || '')}</span></li>`;
      }).join('')}</ul>` : '<p class="muted small">등록된 휴강·보강이 없어요.</p>'}
    </section>`;
};
