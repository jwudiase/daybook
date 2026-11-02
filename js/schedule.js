// 날짜별 수업·일정 계산, 충돌 감지, 빈 시간 찾기, 과제 작업 시간 제안
const Sched = {
  inSemester(date) {
    const s = Store.semester(), k = U.ymd(date);
    return !!s && k >= s.start && k <= s.end;
  },

  classesOn(date) {
    const key = U.ymd(date), wd = date.getDay(), out = [];
    const ex = Store.state.exceptions.filter(e => e.date === key);
    if (Sched.inSemester(date)) {
      for (const c of Store.courses()) for (const sl of c.slots) {
        if (sl.day !== wd) continue;
        const mine = ex.filter(e => e.courseId === c.id);
        const cancelled = mine.some(e => e.type === 'cancel');
        // 온라인: 그날 정규 수업이 같은 시간에 온라인으로 진행 (메모에 링크 등)
        const online = !cancelled && mine.find(e => e.type === 'online');
        out.push({
          kind: 'class', id: c.id, title: c.name, start: sl.start, end: sl.end, color: c.color, cancelled,
          online: !!online, room: online ? ['온라인', online.memo].filter(Boolean).join(' · ') : sl.room || c.room,
        });
      }
    }
    for (const e of ex) {
      if (e.type !== 'makeup') continue;
      const c = Store.course(e.courseId);
      if (c) out.push({ kind: 'class', id: c.id, title: `${c.name} (보강)`, start: e.start, end: e.end, room: e.room || c.room, color: c.color });
    }
    return out;
  },

  eventsOn(date) {
    const key = U.ymd(date), wd = date.getDay();
    return Store.state.events
      .filter(e => e.date === key ||
        (e.repeat === 'weekly' && key > e.date && U.parseYmd(e.date).getDay() === wd && (!e.until || key <= e.until)))
      .map(e => ({ kind: 'event', id: e.id, title: e.title, start: e.start, end: e.end, color: e.taskId ? 'var(--work)' : 'var(--ev)' }));
  },

  itemsOn(date) {
    return [...Sched.classesOn(date), ...Sched.eventsOn(date)].sort((a, b) => a.start.localeCompare(b.start));
  },

  busyOn(date) { return Sched.itemsOn(date).filter(i => !i.cancelled); },

  tasksDueOn(date) {
    const k = U.ymd(date);
    return Store.state.tasks.filter(t => t.due.slice(0, 10) === k).sort((a, b) => a.due.localeCompare(b.due));
  },

  conflicts(date, start, end, excludeEventId) {
    const s = U.toMin(start), e = U.toMin(end);
    return Sched.busyOn(date).filter(i =>
      !(i.kind === 'event' && i.id === excludeEventId) && U.overlap(s, e, U.toMin(i.start), U.toMin(i.end)));
  },

  // 설정의 하루 활동 시간 안에서 수업·일정이 없는 구간 [시작분, 끝분] 목록
  freeSlots(date, minLen = 30) {
    const st = Store.state.settings, to = U.toMin(st.dayEnd);
    let cur = U.toMin(st.dayStart);
    if (U.sameDay(date, new Date())) cur = Math.max(cur, Math.ceil(U.nowMin() / 30) * 30);
    const busy = Sched.busyOn(date).map(i => [U.toMin(i.start), U.toMin(i.end)]).sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const [s, e] of busy) {
      if (s > cur) out.push([cur, Math.min(s, to)]);
      cur = Math.max(cur, e);
      if (cur >= to) break;
    }
    if (cur < to) out.push([cur, to]);
    return out.filter(([s, e]) => e - s >= minLen);
  },

  // 마감 전까지 하루 한 번, 최대 2시간씩 작업 시간을 제안
  suggestWork(task) {
    const due = new Date(task.due), need = Math.round((+task.estimate || 0) * 60);
    const today = U.startOfDay(new Date());
    const planned = Store.state.events
      .filter(e => e.taskId === task.id && e.date >= U.ymd(today))
      .reduce((sum, e) => sum + U.toMin(e.end) - U.toMin(e.start), 0);
    let left = need - planned;
    const blocks = [];
    for (let d = new Date(today); d <= due && left > 0; d = U.addDays(d, 1)) {
      let slots = Sched.freeSlots(d, 60);
      if (U.sameDay(d, due)) {
        const limit = due.getHours() * 60 + due.getMinutes() - 30;
        slots = slots.map(([s, e]) => [s, Math.min(e, limit)]).filter(([s, e]) => e - s >= 60);
      }
      const best = slots.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
      if (!best) continue;
      const len = Math.min(left, 120, best[1] - best[0]);
      blocks.push({ date: U.ymd(d), start: U.fromMin(best[0]), end: U.fromMin(best[0] + len) });
      left -= len;
    }
    return { need, planned, left, blocks };
  },
};
