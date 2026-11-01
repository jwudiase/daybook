// 캘린더: 주간(시간 격자) · 월간
const Cal = { mode: 'week', anchor: new Date() };

Views.calendar = root => {
  const a = Cal.anchor;
  let title, body;
  if (Cal.mode === 'week') {
    const ws = U.startOfWeek(a), days = [...Array(7)].map((_, i) => U.addDays(ws, i)), we = days[6];
    const cols = days.map(d => ({
      date: U.ymd(d),
      label: `${U.DAYS[d.getDay()]} <b>${d.getDate()}</b>`,
      items: Sched.itemsOn(d).map(UI.toBlock),
      allday: Sched.tasksDueOn(d).map(UI.dueChip).join(''),
    }));
    title = `${ws.getFullYear()}년 ${ws.getMonth() + 1}월 ${ws.getDate()}일 – ${we.getMonth() !== ws.getMonth() ? `${we.getMonth() + 1}월 ` : ''}${we.getDate()}일`;
    body = UI.timeGrid(cols, { ...UI.range(cols.flatMap(c => c.items)), allday: true });
  } else {
    const gs = U.startOfWeek(new Date(a.getFullYear(), a.getMonth(), 1)), today = new Date();
    title = `${a.getFullYear()}년 ${a.getMonth() + 1}월`;
    const cells = [...Array(42)].map((_, i) => {
      const d = U.addDays(gs, i);
      const chips = [
        ...Sched.tasksDueOn(d).map(UI.dueChip),
        ...Sched.eventsOn(d).map(e => `<div class="m-ev" data-event="${e.id}" style="--c:${e.color}">${e.start} ${U.esc(e.title)}</div>`),
      ];
      const cancels = Sched.classesOn(d).filter(c => c.cancelled).length;
      return `<div class="m-cell ${d.getMonth() !== a.getMonth() ? 'is-out' : ''} ${U.sameDay(d, today) ? 'is-today' : ''}" data-day="${U.ymd(d)}">
        <div class="m-num">${d.getDate()}${cancels ? '<span class="m-flag">휴강</span>' : ''}</div>
        ${chips.slice(0, 3).join('')}${chips.length > 3 ? `<div class="small muted">+${chips.length - 3}개</div>` : ''}</div>`;
    }).join('');
    body = `<div class="month"><div class="m-head">${[1, 2, 3, 4, 5, 6, 0].map(d => `<div>${U.DAYS[d]}</div>`).join('')}</div><div class="m-grid">${cells}</div></div>`;
  }
  root.innerHTML = `
    <header class="page-head">
      <div class="cal-nav">
        <button class="icon-btn" data-act="cal-move" data-dir="-1" aria-label="이전">‹</button>
        <button class="btn small" data-act="cal-today">오늘</button>
        <button class="icon-btn" data-act="cal-move" data-dir="1" aria-label="다음">›</button>
        <h1>${title}</h1>
      </div>
      <div class="head-actions">
        <div class="seg">${[['week', '주'], ['month', '월']].map(([v, l]) => `<button data-act="cal-mode" data-mode="${v}" class="${Cal.mode === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <button class="btn" data-act="free">빈 시간 찾기</button>
        <button class="btn primary" data-act="new-event">+ 일정</button>
      </div>
    </header>
    <section class="card flush">${body}</section>
    ${Cal.mode === 'week' ? '<p class="hint">빈 칸을 누르면 그 시간에 일정이 만들어져요. 맨 위 줄은 그날 마감되는 과제입니다.</p>' : '<p class="hint">날짜를 누르면 그 주로 이동해요.</p>'}`;
};

Actions['cal-move'] = el => {
  const dir = +el.dataset.dir, a = Cal.anchor;
  Cal.anchor = Cal.mode === 'week' ? U.addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1);
  App.render();
};
Actions['cal-today'] = () => { Cal.anchor = new Date(); App.render(); };
Actions['cal-mode'] = el => { Cal.mode = el.dataset.mode; App.render(); };
