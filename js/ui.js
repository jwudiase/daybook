// 화면 공통 부품: 모달, 과제 행, 배지, 주간 시간 격자
const Views = {};
const Actions = {};

const Modal = {
  open(title, body, { wide = false } = {}) {
    Modal.close();
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <header><h2>${U.esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="닫기">✕</button></header>
      <div class="modal-body">${body}</div></div>`;
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) Modal.close(); });
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', Modal.close));
    wrap.querySelector('input:not([type=checkbox]):not([type=radio]),select,textarea')?.focus();
    return wrap.querySelector('.modal');
  },
  close() { document.querySelector('.modal-backdrop')?.remove(); },
  isOpen() { return !!document.querySelector('.modal-backdrop'); },
};

const UI = {
  HOUR: 44,
  // 과제와 할 일은 같은 곳(tasks)에 저장하고 kind로 나눈다. kind가 없으면 과제.
  isTodo: t => t.kind === 'todo',
  assignments: () => Store.state.tasks.filter(t => t.kind !== 'todo'),
  todos: () => Store.state.tasks.filter(t => t.kind === 'todo'),
  // 기한 없는 할 일은 맨 뒤로
  byDue: (a, b) => (a.due || '9999').localeCompare(b.due || '9999'),

  courseTag(c) {
    return c ? `<span class="tag"><i class="dot" style="background:${c.color}"></i>${U.esc(c.name)}</span>` : '';
  },

  ddayBadge(t) {
    if (t.status === 'done') return '<span class="badge">완료</span>';
    if (!t.due) return '';
    const d = new Date(t.due), n = U.daysUntil(d), over = d < new Date();
    const cls = over ? 'over' : n <= 1 ? 'hot' : n <= 3 ? 'warm' : '';
    return `<span class="badge ${cls}">${over && n === 0 ? '마감 지남' : U.dday(d)}</span>`;
  },

  taskRow(t) {
    const c = Store.course(t.courseId), todo = UI.isTodo(t);
    const subs = t.subtasks?.length ? `<span class="small muted">☑ ${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}</span>` : '';
    const meta = todo
      ? `${UI.courseTag(c)}${t.memo ? `<span class="small muted memo-peek">${U.esc(t.memo.split('\n')[0])}</span>` : ''}`
      : `${UI.courseTag(c)}<span class="tag plain">${U.esc(t.type)}</span>${t.status === 'doing' ? '<span class="tag plain">진행 중</span>' : ''}${subs}`;
    const due = t.due
      ? `<span class="small muted">${U.fmtShort(new Date(t.due))} ${t.due.slice(11, 16)}</span>${UI.ddayBadge(t)}`
      : `<span class="small muted">기한 없음</span>${t.status === 'done' ? UI.ddayBadge(t) : ''}`;
    return `<li class="task-row ${todo ? 'is-todo' : ''} ${t.status === 'done' ? 'is-done' : ''}" data-task="${t.id}">
      <input type="checkbox" class="check" data-toggle-task="${t.id}" ${t.status === 'done' ? 'checked' : ''} aria-label="완료 표시">
      <div class="task-main">
        <div class="task-title">${t.priority === 3 ? '<span class="prio" title="우선순위 높음">!</span>' : ''}${U.esc(t.title)}</div>
        ${meta ? `<div class="task-meta">${meta}</div>` : ''}
      </div>
      <div class="task-due">${due}</div>
    </li>`;
  },

  group(label, list, cls = '') {
    return list.length ? `<div class="group ${cls}"><h4>${label}<span class="count">${list.length}</span></h4>
      <ul class="task-list">${list.map(UI.taskRow).join('')}</ul></div>` : '';
  },

  dueChip(t) {
    const c = Store.course(t.courseId);
    return `<div class="due-chip ${UI.isTodo(t) ? 'is-todo' : ''} ${t.status === 'done' ? 'is-done' : ''}" data-task="${t.id}" style="--c:${c?.color || 'var(--muted)'}" title="${U.esc(t.title)}">${t.due.slice(11, 16)} ${U.esc(t.title)}</div>`;
  },

  empty(msg, action = '') { return `<div class="empty"><p>${msg}</p>${action}</div>`; },

  // 수업·일정 항목을 격자 블록으로 변환
  toBlock(i) {
    return {
      start: i.start, end: i.end,
      title: i.cancelled ? `${i.title} (휴강)` : i.online ? `${i.title} (온라인)` : i.title,
      sub: i.kind === 'class' ? i.room || '' : '',
      color: i.color,
      cls: i.cancelled ? 'is-cancelled' : i.online ? 'is-online' : i.kind === 'event' ? 'is-event' : '',
      attrs: i.kind === 'class' ? `data-course="${i.id}"` : `data-event="${i.id}"`,
    };
  },

  range(items) {
    const st = Store.state.settings;
    let from = Math.floor(U.toMin(st.dayStart) / 60) * 60, to = Math.ceil(U.toMin(st.dayEnd) / 60) * 60;
    for (const i of items) {
      from = Math.min(from, Math.floor(U.toMin(i.start) / 60) * 60);
      to = Math.max(to, Math.ceil(U.toMin(i.end) / 60) * 60);
    }
    return { from, to: Math.min(to, 1440) };
  },

  // 겹치는 블록을 나란히 놓기 위한 칸(lane) 계산
  layout(items) {
    const sorted = items.map(x => ({ ...x })).sort((a, b) => a.start.localeCompare(b.start));
    let cluster = [], lanes = [], clusterEnd = -1;
    const flush = () => { cluster.forEach(x => { x.n = lanes.length; }); cluster = []; lanes = []; };
    for (const it of sorted) {
      const s = U.toMin(it.start), e = U.toMin(it.end);
      if (s >= clusterEnd) { flush(); clusterEnd = -1; }
      let lane = lanes.findIndex(le => le <= s);
      if (lane < 0) { lane = lanes.length; lanes.push(e); } else lanes[lane] = e;
      it.lane = lane;
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, e);
    }
    flush();
    return sorted;
  },

  // cols: [{ label, date?, items: [블록], allday? }]
  timeGrid(cols, { from, to, allday = false }) {
    const H = UI.HOUR, height = (to - from) / 60 * H, today = U.ymd(new Date());
    const hours = [];
    for (let m = from; m < to; m += 60) hours.push(m);
    const head = cols.map(c => `<div class="tg-h ${c.date === today ? 'is-today' : ''}">${c.label}</div>`).join('');
    const ad = allday ? `<div class="tg-row tg-allday"><div class="tg-gutter-cell">마감</div>${cols.map(c => `<div class="tg-ad-cell">${c.allday || ''}</div>`).join('')}</div>` : '';
    const body = cols.map(c => {
      const blocks = UI.layout(c.items).map(it => {
        const s = Math.max(U.toMin(it.start), from), e = Math.min(U.toMin(it.end), to);
        if (e <= s) return '';
        const top = (s - from) / 60 * H, h = Math.max((e - s) / 60 * H - 2, 18), w = 100 / it.n;
        return `<div class="tg-block ${it.cls || ''}" ${it.attrs || ''} style="top:${top}px;height:${h}px;left:calc(${it.lane * w}% + 2px);width:calc(${w}% - 4px);--c:${it.color || 'var(--muted)'}">
          <b>${U.esc(it.title)}</b><span>${it.start}–${it.end}${it.sub ? ' · ' + U.esc(it.sub) : ''}</span></div>`;
      }).join('');
      const nm = U.nowMin();
      const now = c.date === today && nm >= from && nm <= to ? `<div class="tg-now" style="top:${(nm - from) / 60 * H}px"></div>` : '';
      return `<div class="tg-col" ${c.date ? `data-date="${c.date}"` : ''} style="height:${height}px">${blocks}${now}</div>`;
    }).join('');
    return `<div class="tg" data-from="${from}" style="--cols:${cols.length};--hour:${H}px">
      <div class="tg-row tg-head"><div></div>${head}</div>${ad}
      <div class="tg-row tg-body"><div class="tg-gutter" style="height:${height}px">${hours.map(m => `<span style="top:${(m - from) / 60 * H}px">${m / 60}</span>`).join('')}</div>${body}</div>
    </div>`;
  },
};
