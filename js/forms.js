// 입력 폼(모달) 모음
const Forms = (() => {
  const opts = (list, sel) => list.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<option value="${U.esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${U.esc(l)}</option>`;
  }).join('');
  const courseOpts = (sel, none = '없음') => `<option value="">${none}</option>` + opts(Store.courses().map(c => [c.id, c.name]), sel);
  const dayOpts = sel => opts([1, 2, 3, 4, 5, 6, 0].map(d => [d, U.DAYS[d]]), sel);
  const foot = (left = '', primary = '저장') => `<footer class="modal-foot">${left}<span class="spacer"></span>
    <button type="button" class="btn" data-close>취소</button><button type="submit" class="btn primary">${primary}</button></footer>`;
  const delBtn = '<button type="button" class="btn danger-text" data-del>삭제</button>';

  function task(input = {}) {
    const isNew = !input.id;
    const t = {
      id: U.uid(), title: '', courseId: '', type: '과제', due: U.ymd(U.addDays(new Date(), 7)) + 'T23:59',
      priority: 2, status: 'todo', estimate: '', subtasks: [], memo: '', createdAt: Date.now(), ...structuredClone(input),
    };
    const el = Modal.open(isNew ? '새 과제' : '과제 편집', `<form class="form">
      <label class="field"><span>제목</span><input name="title" required value="${U.esc(t.title)}" placeholder="예) 과제 2 – 연결 리스트 구현"></label>
      <div class="row">
        <label class="field"><span>과목</span><select name="courseId">${courseOpts(t.courseId)}</select></label>
        <label class="field"><span>종류</span><select name="type">${opts(Store.TASK_TYPES, t.type)}</select></label>
      </div>
      <div class="row">
        <label class="field"><span>마감일</span><input type="date" name="dueDate" required value="${t.due.slice(0, 10)}"></label>
        <label class="field"><span>마감 시간</span><input type="time" name="dueTime" required value="${t.due.slice(11, 16)}"></label>
      </div>
      <div class="row">
        <label class="field"><span>우선순위</span><select name="priority">${opts([[1, '낮음'], [2, '보통'], [3, '높음']], t.priority)}</select></label>
        <label class="field"><span>상태</span><select name="status">${opts([['todo', '할 일'], ['doing', '진행 중'], ['done', '제출 완료']], t.status)}</select></label>
        <label class="field"><span>예상 소요 (시간)</span><input type="number" name="estimate" min="0" step="0.5" value="${t.estimate}"></label>
      </div>
      <div class="field"><span>하위 작업</span><ul class="subtasks"></ul><input class="sub-in" placeholder="하위 작업 입력 후 Enter"></div>
      <label class="field"><span>메모</span><textarea name="memo" rows="3">${U.esc(t.memo)}</textarea></label>
      ${foot((isNew ? '' : delBtn) + '<button type="button" class="btn" data-plan>작업 시간 잡기</button>')}
    </form>`);
    const form = el.querySelector('form'), subsEl = el.querySelector('.subtasks');
    const drawSubs = () => {
      subsEl.innerHTML = t.subtasks.map((s, i) => `<li><label><input type="checkbox" data-i="${i}" ${s.done ? 'checked' : ''}><span>${U.esc(s.text)}</span></label>
        <button type="button" class="icon-btn" data-rm="${i}" aria-label="하위 작업 삭제">✕</button></li>`).join('');
    };
    drawSubs();
    subsEl.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { t.subtasks.splice(+rm.dataset.rm, 1); drawSubs(); }
    });
    subsEl.addEventListener('change', e => { if (e.target.dataset.i != null) t.subtasks[+e.target.dataset.i].done = e.target.checked; });
    el.querySelector('.sub-in').addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = e.target.value.trim();
      if (v) { t.subtasks.push({ id: U.uid(), text: v, done: false }); e.target.value = ''; drawSubs(); }
    });
    const collect = () => {
      const f = new FormData(form);
      return {
        ...t, title: f.get('title').trim(), courseId: f.get('courseId'), type: f.get('type'),
        due: `${f.get('dueDate')}T${f.get('dueTime')}`, priority: +f.get('priority'), status: f.get('status'),
        estimate: f.get('estimate') === '' ? '' : +f.get('estimate'), memo: f.get('memo'),
      };
    };
    form.addEventListener('submit', e => { e.preventDefault(); Store.upsert('tasks', collect()); Modal.close(); });
    el.querySelector('[data-del]')?.addEventListener('click', () => {
      if (!confirm('이 과제를 삭제할까요?')) return;
      Store.state.events = Store.state.events.filter(ev => ev.taskId !== t.id);
      Store.remove('tasks', t.id);
      Modal.close();
    });
    el.querySelector('[data-plan]').addEventListener('click', () => {
      if (form.reportValidity()) workPlan(Store.upsert('tasks', collect()));
    });
  }

  function workPlan(task) {
    if (!task.estimate) {
      const el = Modal.open('작업 시간 잡기', `<p class="muted">과제의 <b>예상 소요 시간</b>을 먼저 입력해 주세요.</p>
        <footer class="modal-foot"><span class="spacer"></span><button type="button" class="btn primary" data-back>과제로 돌아가기</button></footer>`);
      el.querySelector('[data-back]').onclick = () => Forms.task(task);
      return;
    }
    const p = Sched.suggestWork(task);
    const sum = p.blocks.reduce((s, b) => s + U.toMin(b.end) - U.toMin(b.start), 0);
    let body = `<p>예상 <b>${U.fmtDur(p.need)}</b> 중 ${U.fmtDur(p.planned)} 잡혀 있음 · 남은 시간 <b>${U.fmtDur(Math.max(p.left, 0))}</b></p>`;
    if (p.left <= 0) body += '<p class="muted">필요한 작업 시간이 이미 모두 캘린더에 있어요.</p>';
    else if (!p.blocks.length) body += '<p class="warn-text">마감 전까지 1시간 이상 비는 시간이 없어요.</p>';
    else {
      body += `<p class="small muted">마감 전 빈 시간에 하루 최대 2시간씩 넣었어요. 원하는 것만 고르세요.</p>
        <ul class="pick-list">${p.blocks.map((b, i) => `<li><label><input type="checkbox" data-i="${i}" checked>
        <span>${U.fmtShort(U.parseYmd(b.date))} ${b.start}–${b.end}</span><span class="muted">${U.fmtDur(U.toMin(b.end) - U.toMin(b.start))}</span></label></li>`).join('')}</ul>`;
      if (p.left > sum) body += `<p class="warn-text">빈 시간이 ${U.fmtDur(p.left - sum)} 모자라요.</p>`;
    }
    const el = Modal.open(`작업 시간 잡기 · ${task.title}`, `<form class="form">${body}${foot('', '캘린더에 추가')}</form>`);
    el.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const picked = [...el.querySelectorAll('input[data-i]:checked')].map(cb => p.blocks[+cb.dataset.i]);
      for (const b of picked) {
        Store.state.events.push({ id: U.uid(), title: `[작업] ${task.title}`, date: b.date, start: b.start, end: b.end, repeat: 'none', until: '', memo: '', taskId: task.id });
      }
      Store.commit();
      Modal.close();
      if (picked.length) App.toast(`작업 시간 ${picked.length}개를 캘린더에 넣었어요`);
    });
  }

  function course(input = {}) {
    const isNew = !input.id;
    const used = Store.courses().map(c => c.color);
    const c = {
      id: U.uid(), semesterId: Store.semester().id, name: '', color: Store.COLORS.find(x => !used.includes(x)) || Store.COLORS[0],
      professor: '', room: '', credits: 3, slots: [{ day: 1, start: '09:00', end: '10:15', room: '' }], ...structuredClone(input),
    };
    const slotRow = s => `<div class="slot-row"><select data-k="day" aria-label="요일">${dayOpts(s.day)}</select>
      <input type="time" data-k="start" value="${s.start}" required aria-label="시작"><span class="muted">–</span>
      <input type="time" data-k="end" value="${s.end}" required aria-label="끝">
      <input data-k="room" placeholder="강의실 (다를 때만)" value="${U.esc(s.room || '')}">
      <button type="button" class="icon-btn" data-rm aria-label="시간 삭제">✕</button></div>`;
    const el = Modal.open(isNew ? '과목 추가' : '과목 편집', `<form class="form">
      <label class="field"><span>과목명</span><input name="name" required value="${U.esc(c.name)}" placeholder="예) 자료구조"></label>
      <div class="field"><span>색상</span><div class="swatches">${Store.COLORS.map(x => `<label class="swatch" style="--c:${x}"><input type="radio" name="color" value="${x}" ${x === c.color ? 'checked' : ''} aria-label="${x}"><i></i></label>`).join('')}</div></div>
      <div class="row">
        <label class="field"><span>교수</span><input name="professor" value="${U.esc(c.professor)}"></label>
        <label class="field"><span>강의실</span><input name="room" value="${U.esc(c.room)}"></label>
        <label class="field narrow"><span>학점</span><input type="number" name="credits" min="0" max="9" value="${c.credits}"></label>
      </div>
      <div class="field"><span>수업 시간</span><div class="slots">${c.slots.map(slotRow).join('')}</div>
        <button type="button" class="btn small" data-add>+ 시간 추가</button></div>
      ${foot(isNew ? '' : delBtn)}
    </form>`);
    const form = el.querySelector('form'), slotsEl = el.querySelector('.slots');
    el.querySelector('[data-add]').onclick = () => {
      const last = slotsEl.lastElementChild;
      const v = k => last?.querySelector(`[data-k=${k}]`).value;
      slotsEl.insertAdjacentHTML('beforeend', slotRow({ day: 3, start: v('start') || '09:00', end: v('end') || '10:15' }));
    };
    slotsEl.addEventListener('click', e => { if (e.target.closest('[data-rm]')) e.target.closest('.slot-row').remove(); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form);
      const slots = [...slotsEl.querySelectorAll('.slot-row')].map(r => ({
        day: +r.querySelector('[data-k=day]').value, start: r.querySelector('[data-k=start]').value,
        end: r.querySelector('[data-k=end]').value, room: r.querySelector('[data-k=room]').value.trim(),
      }));
      if (slots.some(s => s.end <= s.start)) { alert('수업 끝 시간이 시작 시간보다 늦어야 해요.'); return; }
      Store.upsert('courses', {
        ...c, name: f.get('name').trim(), color: f.get('color'), professor: f.get('professor').trim(),
        room: f.get('room').trim(), credits: +f.get('credits') || 0, slots,
      });
      Modal.close();
    });
    el.querySelector('[data-del]')?.addEventListener('click', () => {
      if (!confirm(`'${c.name}' 과목을 삭제할까요?\n연결된 과제는 남고 과목 표시만 사라집니다.`)) return;
      const s = Store.state;
      s.exceptions = s.exceptions.filter(x => x.courseId !== c.id);
      s.tasks.forEach(t => { if (t.courseId === c.id) t.courseId = ''; });
      s.courses = s.courses.filter(x => x.id !== c.id);
      Store.commit();
      Modal.close();
    });
  }

  function exception(input = {}) {
    if (!Store.courses().length) { alert('먼저 과목을 추가해 주세요.'); return; }
    const isNew = !input.id;
    const x = { id: U.uid(), courseId: '', type: 'cancel', date: U.ymd(new Date()), start: '09:00', end: '10:15', room: '', memo: '', ...structuredClone(input) };
    const el = Modal.open(isNew ? '휴강 · 보강 등록' : '휴강 · 보강 편집', `<form class="form">
      <div class="row">
        <label class="field"><span>과목</span><select name="courseId" required>${courseOpts(x.courseId, '선택')}</select></label>
        <label class="field"><span>종류</span><select name="type">${opts([['cancel', '휴강'], ['makeup', '보강']], x.type)}</select></label>
        <label class="field"><span>날짜</span><input type="date" name="date" required value="${x.date}"></label>
      </div>
      <div class="row mk">
        <label class="field"><span>보강 시작</span><input type="time" name="start" value="${x.start}"></label>
        <label class="field"><span>보강 끝</span><input type="time" name="end" value="${x.end}"></label>
        <label class="field"><span>강의실</span><input name="room" value="${U.esc(x.room)}"></label>
      </div>
      <label class="field"><span>메모</span><input name="memo" value="${U.esc(x.memo)}"></label>
      ${foot(isNew ? '' : delBtn)}
    </form>`);
    const form = el.querySelector('form'), mk = el.querySelector('.mk');
    const typeSel = form.elements.type;
    const sync = () => { mk.hidden = typeSel.value !== 'makeup'; };
    typeSel.addEventListener('change', sync);
    sync();
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      if (f.type === 'makeup' && f.end <= f.start) { alert('보강 끝 시간이 시작 시간보다 늦어야 해요.'); return; }
      Store.upsert('exceptions', { ...x, ...f });
      Modal.close();
    });
    el.querySelector('[data-del]')?.addEventListener('click', () => { Store.remove('exceptions', x.id); Modal.close(); });
  }

  function event(input = {}) {
    const isNew = !input.id;
    const ev = { id: U.uid(), title: '', date: U.ymd(new Date()), start: '10:00', end: '11:00', repeat: 'none', until: '', memo: '', taskId: '', ...structuredClone(input) };
    const el = Modal.open(isNew ? '새 일정' : '일정 편집', `<form class="form">
      <label class="field"><span>제목</span><input name="title" required value="${U.esc(ev.title)}" placeholder="예) 동아리 회의"></label>
      <div class="row">
        <label class="field"><span>날짜</span><input type="date" name="date" required value="${ev.date}"></label>
        <label class="field"><span>시작</span><input type="time" name="start" required value="${ev.start}"></label>
        <label class="field"><span>끝</span><input type="time" name="end" required value="${ev.end}"></label>
      </div>
      <div class="row">
        <label class="field"><span>반복</span><select name="repeat">${opts([['none', '반복 안 함'], ['weekly', '매주']], ev.repeat)}</select></label>
        <label class="field until"><span>반복 종료일 (비우면 계속)</span><input type="date" name="until" value="${ev.until}"></label>
      </div>
      <label class="field"><span>메모</span><textarea name="memo" rows="2">${U.esc(ev.memo)}</textarea></label>
      <div class="warn-box" hidden></div>
      ${foot(isNew ? '' : delBtn)}
    </form>`);
    const form = el.querySelector('form'), warn = el.querySelector('.warn-box'), primary = el.querySelector('.btn.primary');
    const until = el.querySelector('.until');
    const syncRepeat = () => { until.style.visibility = form.repeat.value === 'weekly' ? 'visible' : 'hidden'; };
    form.repeat.addEventListener('change', syncRepeat);
    syncRepeat();
    let forced = false;
    form.addEventListener('input', e => {
      if (!['date', 'start', 'end'].includes(e.target.name)) return;
      forced = false; warn.hidden = true; primary.textContent = '저장';
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      if (f.end <= f.start) { alert('끝 시간이 시작 시간보다 늦어야 해요.'); return; }
      const hits = Sched.conflicts(U.parseYmd(f.date), f.start, f.end, ev.id);
      if (hits.length && !forced) {
        warn.innerHTML = `<b>시간이 겹쳐요</b><ul>${hits.map(i => `<li>${i.start}–${i.end} ${U.esc(i.title)}</li>`).join('')}</ul>`;
        warn.hidden = false; primary.textContent = '그래도 저장'; forced = true;
        return;
      }
      Store.upsert('events', { ...ev, ...f, title: f.title.trim(), until: f.repeat === 'weekly' ? f.until : '' });
      Modal.close();
    });
    el.querySelector('[data-del]')?.addEventListener('click', () => {
      if (ev.repeat === 'weekly' && !confirm('반복 일정 전체가 삭제됩니다. 계속할까요?')) return;
      Store.remove('events', ev.id);
      Modal.close();
    });
  }

  function semester(input = {}) {
    const isNew = !input.id;
    const s = { id: U.uid(), name: '', start: U.ymd(new Date()), end: U.ymd(U.addDays(new Date(), 112)), ...structuredClone(input) };
    const el = Modal.open(isNew ? '새 학기' : '학기 설정', `<form class="form">
      <label class="field"><span>학기 이름</span><input name="name" required value="${U.esc(s.name)}" placeholder="예) 2027-1학기"></label>
      <div class="row">
        <label class="field"><span>개강일</span><input type="date" name="start" required value="${s.start}"></label>
        <label class="field"><span>종강일</span><input type="date" name="end" required value="${s.end}"></label>
      </div>
      <p class="hint">시간표 수업은 개강일부터 종강일까지만 캘린더에 표시됩니다.</p>
      ${foot(!isNew && Store.state.semesters.length > 1 ? delBtn : '')}
    </form>`);
    const form = el.querySelector('form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      if (f.end < f.start) { alert('종강일이 개강일보다 늦어야 해요.'); return; }
      Store.upsert('semesters', { ...s, ...f, name: f.name.trim() });
      if (isNew) { Store.state.activeSemesterId = s.id; Store.commit(); }
      Modal.close();
    });
    el.querySelector('[data-del]')?.addEventListener('click', () => {
      if (!confirm(`'${s.name}' 학기와 그 학기의 과목을 삭제할까요?`)) return;
      const st = Store.state, ids = st.courses.filter(c => c.semesterId === s.id).map(c => c.id);
      st.courses = st.courses.filter(c => c.semesterId !== s.id);
      st.exceptions = st.exceptions.filter(x => !ids.includes(x.courseId));
      st.tasks.forEach(t => { if (ids.includes(t.courseId)) t.courseId = ''; });
      st.semesters = st.semesters.filter(x => x.id !== s.id);
      st.activeSemesterId = st.semesters[0].id;
      Store.commit();
      Modal.close();
    });
  }

  function quickAdd() {
    const el = Modal.open('빠른 추가', `<form class="form">
      <input class="qa-input" name="q" autocomplete="off" placeholder="예) 금 23:59 자료구조 과제2">
      <div class="qa-preview"></div>
      <p class="hint">날짜 <b>오늘·내일·모레·월~일·다음주 금·11/3</b> · 시간 <b>23:59·오후 3시</b><br>
      과목명이나 과제·퀴즈·시험·발표·팀플이 들어가면 <b>과제</b>로, 시간 범위(14:00-16:00)가 있으면 <b>일정</b>으로 저장돼요.</p>
      ${foot('<button type="button" class="btn" data-detail>자세히 편집</button>', '추가')}
    </form>`);
    const form = el.querySelector('form'), input = form.q, pv = el.querySelector('.qa-preview');
    let p = null, manual = null;
    const kind = () => manual || p.kind;
    const draw = () => {
      const q = input.value.trim();
      if (!q) { p = null; pv.innerHTML = ''; return; }
      p = Parser.parse(q);
      let info;
      if (kind() === 'task') {
        const t = Parser.toTask(p), d = new Date(t.due);
        info = `<b>${U.esc(t.title)}</b>${UI.courseTag(Store.course(t.courseId))}<span class="tag plain">${t.type}</span>
          <span>마감 ${U.fmtShort(d)} ${t.due.slice(11)}</span><span class="badge">${U.dday(d)}</span>`;
      } else {
        const e = Parser.toEvent(p), hits = Sched.conflicts(U.parseYmd(e.date), e.start, e.end);
        info = `<b>${U.esc(e.title)}</b><span>${U.fmtShort(U.parseYmd(e.date))} ${e.start}–${e.end}</span>
          ${hits.length ? `<span class="warn-text">겹침: ${hits.map(i => U.esc(i.title)).join(', ')}</span>` : ''}`;
      }
      pv.innerHTML = `<div class="seg">${[['task', '과제'], ['event', '일정']].map(([v, l]) => `<button type="button" data-k="${v}" class="${kind() === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="qa-info">${info}</div>`;
    };
    input.addEventListener('input', draw);
    pv.addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (b) { manual = b.dataset.k; draw(); input.focus(); }
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!p) return;
      if (kind() === 'task') Store.upsert('tasks', { id: U.uid(), ...Parser.toTask(p) });
      else Store.upsert('events', { id: U.uid(), ...Parser.toEvent(p) });
      Modal.close();
      App.toast(kind() === 'task' ? '과제를 추가했어요' : '일정을 추가했어요');
    });
    el.querySelector('[data-detail]').addEventListener('click', () => {
      const parsed = p || Parser.parse(input.value);
      if ((manual || parsed.kind) === 'task') task(Parser.toTask(parsed)); else event(Parser.toEvent(parsed));
    });
  }

  function freeTime() {
    const st = Store.state.settings;
    const el = Modal.open('빈 시간 찾기', `<div class="form">
      <div class="seg dur">${[60, 120, 180].map(m => `<button type="button" data-m="${m}" class="${m === 60 ? 'on' : ''}">${m / 60}시간 이상</button>`).join('')}</div>
      <div class="free-list"></div>
      <p class="hint">하루 활동 시간(${st.dayStart}–${st.dayEnd}) 중 수업·일정이 없는 시간입니다. 누르면 그 시간에 일정을 만들어요.</p>
    </div>`, { wide: true });
    const list = el.querySelector('.free-list');
    let dur = 60;
    const draw = () => {
      let html = '';
      for (let i = 0; i < 7; i++) {
        const d = U.addDays(U.startOfDay(new Date()), i), fs = Sched.freeSlots(d, dur);
        if (!fs.length) continue;
        html += `<div class="fl-day"><div class="fl-date">${i === 0 ? '오늘' : U.fmtShort(d)}</div><div class="chips">${fs.map(([s, e]) =>
          `<button type="button" class="chip" data-d="${U.ymd(d)}" data-s="${s}" data-e="${e}">${U.fromMin(s)}–${U.fromMin(e)} <span class="muted">${U.fmtDur(e - s)}</span></button>`).join('')}</div></div>`;
      }
      list.innerHTML = html || '<p class="muted">앞으로 7일 동안 조건에 맞는 빈 시간이 없어요.</p>';
    };
    draw();
    el.querySelector('.dur').addEventListener('click', e => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      dur = +b.dataset.m;
      el.querySelectorAll('.dur button').forEach(x => x.classList.toggle('on', x === b));
      draw();
    });
    list.addEventListener('click', e => {
      const c = e.target.closest('.chip');
      if (!c) return;
      const s = +c.dataset.s;
      event({ date: c.dataset.d, start: U.fromMin(s), end: U.fromMin(Math.min(s + dur, +c.dataset.e)) });
    });
  }

  return { task, workPlan, course, exception, event, semester, quickAdd, freeTime };
})();
