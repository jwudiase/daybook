// 설정: 동기화(로그인), 테마, 하루 활동 시간, 백업·복원
Views.syncCard = () => {
  if (!Sync.enabled()) {
    return `<section class="card setting"><div><h3>PC · 폰 동기화</h3>
      <p class="muted small">서버 연결 정보가 아직 없어요. <code>js/config.js</code>에 Supabase 주소와 키를 넣으면 켜집니다.</p></div></section>`;
  }
  if (!Sync.signedIn) {
    return `<section class="card">
      <h3>PC · 폰 동기화</h3>
      <p class="muted small">PC와 폰에서 같은 계정으로 로그인하면 내용이 자동으로 맞춰져요. 이 기기에 있는 데이터는 그대로 올라갑니다.</p>
      ${Sync.message ? `<p class="warn-text">${U.esc(Sync.message)}</p>` : ''}
      <form class="login" data-login>
        <input type="email" name="email" placeholder="이메일" autocomplete="username" required>
        <input type="password" name="password" placeholder="비밀번호 (6자 이상)" autocomplete="current-password" minlength="6" required>
        <button class="btn primary" type="submit">로그인</button>
        <button class="btn" type="button" data-act="sync-signup">처음이면 가입</button>
      </form>
    </section>`;
  }
  const label = { syncing: '동기화 중…', ok: '동기화됨', offline: '오프라인 · 연결되면 다시 맞춰요', error: '동기화 오류', idle: '대기 중' }[Sync.status] || '';
  const when = Sync.lastSync ? ` · 마지막 ${new Date(Sync.lastSync).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '';
  return `<section class="card setting">
    <div><h3>PC · 폰 동기화</h3>
      <p class="muted small">${U.esc(Sync.email)} 계정으로 연결됨 · ${label}${when}</p>
      ${Sync.status === 'error' ? `<p class="warn-text">${U.esc(Sync.message)}</p>` : ''}</div>
    <div class="inline"><button class="btn" data-act="sync-now">지금 동기화</button><button class="btn" data-act="sync-logout">로그아웃</button></div>
  </section>`;
};

Views.settings = root => {
  const st = Store.state, s = st.settings;
  root.innerHTML = `
    <header class="page-head"><h1>설정</h1></header>
    ${Views.syncCard()}
    <section class="card setting">
      <div><h3>테마</h3><p class="muted small">시스템 설정을 따르거나 직접 고를 수 있어요.</p></div>
      <div class="seg">${[['system', '시스템'], ['light', '라이트'], ['dark', '다크']].map(([v, l]) =>
        `<button data-act="theme" data-v="${v}" class="${s.theme === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    </section>
    <section class="card setting">
      <div><h3>하루 활동 시간</h3><p class="muted small">빈 시간 찾기와 작업 시간 제안은 이 범위 안에서만 계산해요.</p></div>
      <div class="inline"><input type="time" data-setting="dayStart" value="${s.dayStart}" aria-label="시작">
        <span class="muted">–</span><input type="time" data-setting="dayEnd" value="${s.dayEnd}" aria-label="끝"></div>
    </section>
    <section class="card setting">
      <div><h3>백업</h3><p class="muted small">${Sync.signedIn ? '서버에도 저장되지만, 가끔 백업 파일을 따로 받아 두면 더 안전해요.' : '데이터는 이 기기에만 저장돼요. 앱을 지우거나 기록을 지우기 전에 백업해 두세요.'}<br>
        과제 ${st.tasks.length}개 · 일정 ${st.events.length}개 · 과목 ${st.courses.length}개</p></div>
      <div class="inline"><button class="btn" data-act="export">백업 파일 저장</button>
        <label class="btn">백업 불러오기<input type="file" accept="application/json,.json" data-import hidden></label></div>
    </section>
    <section class="card setting">
      <div><h3>샘플 데이터</h3><p class="muted small">예시 과목·과제·일정을 넣어 기능을 둘러볼 수 있어요. 기존 데이터에 더해집니다.</p></div>
      <button class="btn" data-act="sample">샘플 넣기</button>
    </section>
    <section class="card setting">
      <div><h3>전체 초기화</h3><p class="muted small">모든 학기·과목·과제·일정을 지웁니다.${Sync.signedIn ? ' 연결된 다른 기기에서도 지워져요.' : ''} 되돌릴 수 없어요.</p></div>
      <button class="btn danger-text" data-act="reset">초기화</button>
    </section>
    <p class="hint">단축키: <kbd>Ctrl</kbd> <kbd>K</kbd> 빠른 추가 · <kbd>Esc</kbd> 창 닫기</p>`;
};

Actions.theme = el => { Store.state.settings.theme = el.dataset.v; Store.commit(); };
Actions.export = () => {
  const blob = new Blob([JSON.stringify(Store.state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `daybook-backup-${U.ymd(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
Actions.reset = () => {
  if (confirm('정말 모든 데이터를 지울까요?') && confirm('되돌릴 수 없습니다. 계속할까요?')) { Store.clearAll(); App.toast('초기화했어요'); }
};

const loginValues = () => {
  const f = document.querySelector('[data-login]');
  return f.reportValidity() ? [f.email.value.trim(), f.password.value] : null;
};
Actions['sync-login'] = async () => {
  const v = loginValues();
  if (!v) return;
  try { await Sync.signIn(...v); App.toast('로그인했어요'); }
  catch (e) { alert('로그인 실패: ' + (/invalid/i.test(e.message) ? '이메일 또는 비밀번호가 맞지 않아요.' : /confirm/i.test(e.message) ? '가입 확인 메일의 링크를 먼저 눌러 주세요.' : e.message)); }
  App.render();
};
Actions['sync-signup'] = async () => {
  const v = loginValues();
  if (!v) return;
  try {
    const done = await Sync.signUp(...v);
    if (done) App.toast('가입하고 로그인했어요');
    else alert('확인 메일을 보냈어요. 메일의 링크를 누른 뒤(열리는 페이지가 오류여도 괜찮아요) 여기서 로그인하세요.');
  } catch (e) { alert('가입 실패: ' + e.message); }
  App.render();
};
Actions['sync-now'] = () => Sync.syncNow();
Actions['sync-logout'] = () => {
  if (confirm('로그아웃할까요? 이 기기의 데이터는 그대로 남고, 동기화만 멈춥니다.')) Sync.signOut();
};
Actions.import = file => {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!Array.isArray(data.tasks) || !Array.isArray(data.courses)) throw new Error('형식이 맞지 않아요');
      if (!confirm('지금 데이터를 백업 파일 내용으로 바꿀까요?')) return;
      Store.replaceAll(data);
      App.toast('백업을 불러왔어요');
    } catch (e) { alert('불러오기 실패: ' + e.message); }
  };
  r.readAsText(file);
};
