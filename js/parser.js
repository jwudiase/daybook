// 빠른 추가: "금 23:59 자료구조 과제2", "내일 14:00-16:00 동아리" 같은 문장을 해석
const Parser = (() => {
  const TYPES = [
    [/과제|레포트|리포트|보고서|숙제/, '과제'],
    [/퀴즈/, '퀴즈'],
    [/시험|중간고사|기말고사|중간|기말/, '시험'],
    [/발표|프레젠테이션/, '발표'],
    [/팀플|팀\s*프로젝트|조별/, '팀플'],
  ];
  const T = String.raw`(?:(오전|오후)\s*)?(?<!\d)(\d{1,2})(?::(\d{2})|\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?)`;
  const RANGE = new RegExp(T + String.raw`\s*[-~]\s*` + T);
  const ONE = new RegExp(T);

  function time([ap, h, cm, sm, half], prevAp) {
    h = +h;
    let m = cm != null ? +cm : sm != null ? +sm : half ? 30 : 0;
    if (h > 24 || m > 59) return null;
    ap = ap || prevAp;
    if (ap === '오후' && h < 12) h += 12;
    else if (ap === '오전' && h === 12) h = 0;
    else if (!ap && cm == null && h >= 1 && h <= 7) h += 12; // "3시"는 오후 3시로 본다
    if (h === 24) { h = 23; m = 59; }
    return U.fromMin(h * 60 + m);
  }

  function parse(text) {
    let s = ` ${text.trim()} `.replace(/까지/g, ' ').replace(/\s마감(?=\s)/g, ' ');
    const today = U.startOfDay(new Date());
    let date = null, start = null, end = null, m;
    const cut = str => { s = s.replace(str, ' '); };

    if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) {
      date = new Date(+m[1], m[2] - 1, +m[3]); cut(m[0]);
    } else if ((m = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || s.match(/(?<![\d:])(\d{1,2})[/.](\d{1,2})(?![\d:])/))) {
      date = new Date(today.getFullYear(), m[1] - 1, +m[2]);
      if (U.daysUntil(date) < -60) date.setFullYear(date.getFullYear() + 1);
      cut(m[0]);
    } else if ((m = s.match(/\s(오늘|내일|모레|글피)(?=\s)/))) {
      date = U.addDays(today, ['오늘', '내일', '모레', '글피'].indexOf(m[1])); cut(m[0]);
    } else if ((m = s.match(/\s(?:(다음\s*주|담주|이번\s*주)\s*)?([월화수목금토일])(?:요일)?(?=\s)/))) {
      const wd = U.DAYS.indexOf(m[2]);
      date = m[1]
        ? U.addDays(U.startOfWeek(today), (/이번/.test(m[1]) ? 0 : 7) + (wd + 6) % 7)
        : U.addDays(today, (wd - today.getDay() + 7) % 7);
      cut(m[0]);
    }

    if ((m = s.match(RANGE))) {
      const g1 = m.slice(1, 6), g2 = m.slice(6, 11);
      start = time(g1); end = time(g2, g1[0]);
      if (start && end && end <= start && U.toMin(end) < 720) end = U.fromMin(U.toMin(end) + 720);
      cut(m[0]);
    } else if ((m = s.match(ONE))) {
      start = time(m.slice(1, 6)); cut(m[0]);
    }
    if (!start || (end && end <= start)) end = null;

    const course = [...Store.courses()].sort((a, b) => b.name.length - a.name.length).find(c => s.includes(c.name)) || null;
    if (course) s = s.replace(course.name, ' ');
    const type = (TYPES.find(([re]) => re.test(s)) || [])[1] || null;
    let title = s.replace(/\s+/g, ' ').trim();
    if (!title && course) title = type || '과제';

    // 시간 범위 → 일정, 과제 종류 단어 → 과제, 나머지 → 할 일
    const kind = end ? 'event' : type ? 'task' : 'todo';
    return { kind, title, date: date && U.ymd(date), start, end, course, type };
  }

  // 날짜도 시간도 없으면 기한 없는 할 일
  function toTodo(p) {
    const date = p.date || (p.start ? U.ymd(new Date()) : '');
    return {
      kind: 'todo', title: p.title || p.course?.name || '새 할 일', courseId: p.course?.id || '', type: '할 일',
      due: date ? `${date}T${p.start || '23:59'}` : '',
      priority: 2, status: 'todo', estimate: '', subtasks: [], memo: '', createdAt: Date.now(),
    };
  }

  function toTask(p) {
    return {
      title: p.title || '새 과제', courseId: p.course?.id || '', type: p.type || (p.course ? '과제' : '기타'),
      due: `${p.date || U.ymd(new Date())}T${p.start || '23:59'}`,
      priority: 2, status: 'todo', estimate: '', subtasks: [], memo: '', createdAt: Date.now(),
    };
  }

  function toEvent(p) {
    const start = p.start || '09:00';
    return {
      title: [p.course?.name, p.title].filter(Boolean).join(' ') || '새 일정',
      date: p.date || U.ymd(new Date()), start,
      end: p.end || U.fromMin(Math.min(U.toMin(start) + 60, 23 * 60 + 59)),
      repeat: 'none', until: '', memo: '', taskId: '',
    };
  }

  return { parse, toTask, toTodo, toEvent };
})();
