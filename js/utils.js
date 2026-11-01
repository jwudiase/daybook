// 날짜·문자열 공통 도구
const U = {
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
  pad(n) { return String(n).padStart(2, '0'); },
  ymd(d) { return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`; },
  parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; },
  // 한 주는 월요일부터 시작
  startOfWeek(d) { const x = U.startOfDay(d); return U.addDays(x, -((x.getDay() + 6) % 7)); },
  sameDay(a, b) { return U.ymd(a) === U.ymd(b); },
  toMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; },
  fromMin(m) { return `${U.pad(Math.floor(m / 60))}:${U.pad(m % 60)}`; },
  nowMin() { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); },
  DAYS: ['일', '월', '화', '수', '목', '금', '토'],
  fmtDate(d) { return `${d.getMonth() + 1}월 ${d.getDate()}일 (${U.DAYS[d.getDay()]})`; },
  fmtShort(d) { return `${d.getMonth() + 1}/${d.getDate()} (${U.DAYS[d.getDay()]})`; },
  fmtDur(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return [h && `${h}시간`, m && `${m}분`].filter(Boolean).join(' ') || '0분';
  },
  daysUntil(date) { return Math.round((U.startOfDay(date) - U.startOfDay(new Date())) / 86400000); },
  dday(date) { const n = U.daysUntil(date); return n === 0 ? 'D-Day' : n > 0 ? `D-${n}` : `D+${-n}`; },
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  overlap(aS, aE, bS, bE) { return aS < bE && bS < aE; },
  // 키 순서와 무관한 JSON 문자열 (데이터 비교용)
  canon(v) {
    if (Array.isArray(v)) return '[' + v.map(U.canon).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + U.canon(v[k])).join(',') + '}';
    }
    return JSON.stringify(v);
  },
};
