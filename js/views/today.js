// 오늘: 오늘 수업·일정, 마감, 비는 시간
Views.today = root => {
  const now = new Date(), nm = U.nowMin(), sem = Store.semester();
  const items = Sched.itemsOn(now);
  const open = Store.state.tasks.filter(t => t.status !== 'done').sort(UI.byDue);
  const n = t => U.daysUntil(new Date(t.due));
  const over = open.filter(t => new Date(t.due) < now);
  const today = open.filter(t => new Date(t.due) >= now && n(t) === 0);
  const week = open.filter(t => n(t) >= 1 && n(t) <= 7);
  const later = open.filter(t => n(t) > 7).length;
  const free = Sched.freeSlots(now, 30);
  const weekNo = Sched.inSemester(now)
    ? Math.round((U.startOfWeek(now) - U.startOfWeek(U.parseYmd(sem.start))) / (7 * 86400000)) + 1 : null;
  const firstRun = !Store.state.courses.length && !Store.state.tasks.length && !Store.state.events.length;

  const timeline = items.length ? `<ul class="timeline">${items.map(i => {
    const s = U.toMin(i.start), e = U.toMin(i.end);
    const st = i.cancelled ? 'is-cancelled' : e <= nm ? 'is-past' : s <= nm ? 'is-now' : '';
    const attr = i.kind === 'class' ? `data-course="${i.id}"` : `data-event="${i.id}"`;
    return `<li class="tl-item ${st}" ${attr} style="--c:${i.color}">
      <div class="tl-time">${i.start}<span>${i.end}</span></div>
      <div class="tl-body"><div class="tl-title">${U.esc(i.title)}${i.cancelled ? '<span class="badge">휴강</span>' : ''}${st === 'is-now' ? '<span class="badge now">진행 중</span>' : ''}</div>
      <div class="small muted">${i.kind === 'class' ? U.esc(i.room || '수업') : '일정'}</div></div></li>`;
  }).join('')}</ul>` : UI.empty('오늘은 수업도 일정도 없어요.');

  const dues = UI.group('마감 지남', over, 'over') + UI.group('오늘 마감', today) + UI.group('7일 이내', week);
  const freeHtml = free.length
    ? `<div class="chips">${free.map(([s, e]) => `<button class="chip" data-act="free-today" data-s="${s}" data-e="${e}">${U.fromMin(s)}–${U.fromMin(e)} <span class="muted">${U.fmtDur(e - s)}</span></button>`).join('')}</div>`
    : '<p class="muted small">오늘 남은 빈 시간이 없어요.</p>';

  root.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${U.esc(sem.name)}${weekNo ? ` · ${weekNo}주차` : ''}</p><h1>${U.fmtDate(now)}</h1></div>
      <div class="head-actions">
        <button class="btn" data-act="new-event">+ 일정</button>
        <button class="btn primary" data-act="new-task">+ 과제</button>
      </div>
    </header>
    ${firstRun ? `<section class="card welcome">
      <h3>처음 오셨네요</h3>
      <p class="muted">① 과목 탭에서 이번 학기 시간표를 넣고 ② 과제 마감을 추가하면 이 화면에 오늘 할 일이 모입니다.
      어디서든 <kbd>Ctrl</kbd> <kbd>K</kbd>로 빠르게 추가할 수 있어요.</p>
      <div class="head-actions"><a class="btn primary" href="#courses">시간표 입력하기</a><button class="btn" data-act="sample">샘플 데이터로 둘러보기</button></div>
    </section>` : ''}
    <div class="grid-2">
      <section class="card"><h3>오늘 일정</h3>${timeline}</section>
      <section class="card"><h3>마감</h3>${dues || UI.empty('7일 안에 마감되는 과제가 없어요.')}
        ${later ? `<a class="more-link" href="#tasks">그 이후 ${later}개 더 보기 →</a>` : ''}</section>
    </div>
    <section class="card"><h3>오늘 비는 시간</h3>${freeHtml}</section>`;
};

Actions['free-today'] = el => {
  const s = +el.dataset.s, e = +el.dataset.e;
  Forms.event({ date: U.ymd(new Date()), start: U.fromMin(s), end: U.fromMin(Math.min(s + 60, e)) });
};
