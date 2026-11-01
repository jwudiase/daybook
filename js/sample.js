// 둘러보기용 샘플 데이터 (오늘 날짜 기준으로 만든다)
Actions.sample = () => {
  const st = Store.state, sem = Store.semester(), today = U.startOfDay(new Date());
  const day = n => U.ymd(U.addDays(today, n));
  const C = Store.COLORS;
  const mk = (name, color, professor, room, slots, credits = 3) => {
    const c = { id: U.uid(), semesterId: sem.id, name, color, professor, room, credits, slots: slots.map(([d, s, e]) => ({ day: d, start: s, end: e, room: '' })) };
    st.courses.push(c);
    return c;
  };
  const ds = mk('자료구조', C[0], '김교수', '공학관 301', [[1, '10:30', '11:45'], [3, '10:30', '11:45']]);
  const os = mk('운영체제', C[1], '이교수', '공학관 405', [[2, '13:30', '14:45'], [4, '13:30', '14:45']]);
  const pr = mk('확률과통계', C[2], '박교수', '자연관 210', [[2, '15:00', '16:50']]);
  const en = mk('영어회화', C[3], 'Smith', '어학관 102', [[5, '09:00', '10:50']], 2);
  const ps = mk('심리학의이해', C[4], '최교수', '인문관 501', [[3, '15:00', '16:15']]);

  const task = (title, c, type, offset, time, extra = {}) => st.tasks.push({
    id: U.uid(), title, courseId: c.id, type, due: `${day(offset)}T${time}`, priority: 2, status: 'todo',
    estimate: '', subtasks: [], memo: '', createdAt: Date.now(), ...extra,
  });
  task('과제2 – 연결 리스트 구현', ds, '과제', 2, '23:59', { estimate: 3, status: 'doing',
    subtasks: [{ id: U.uid(), text: '노드 클래스', done: true }, { id: U.uid(), text: '삽입·삭제', done: false }, { id: U.uid(), text: '보고서', done: false }] });
  task('3장 퀴즈', os, '퀴즈', 1, '13:30');
  task('중간고사', pr, '시험', 9, '15:00', { priority: 3, estimate: 6 });
  task('자기소개 발표', en, '발표', 4, '09:00', { estimate: 1.5 });
  task('관찰 레포트', ps, '과제', 6, '23:59', { estimate: 2 });
  task('과제1 – 배열', ds, '과제', -3, '23:59', { status: 'done' });

  const ws = U.startOfWeek(today);
  st.events.push(
    { id: U.uid(), title: '동아리 회의', date: U.ymd(U.addDays(ws, 2)), start: '18:30', end: '20:00', repeat: 'weekly', until: '', memo: '', taskId: '' },
    { id: U.uid(), title: '알바', date: U.ymd(U.addDays(ws, 5)), start: '12:00', end: '18:00', repeat: 'weekly', until: '', memo: '', taskId: '' },
    { id: U.uid(), title: '치과', date: day(3), start: '16:30', end: '17:30', repeat: 'none', until: '', memo: '', taskId: '' },
  );
  st.exceptions.push({ id: U.uid(), courseId: os.id, type: 'cancel', date: U.ymd(U.addDays(ws, 10)), start: '', end: '', room: '', memo: '학회 참석' });
  Store.commit();
  App.toast('샘플 데이터를 넣었어요');
};
