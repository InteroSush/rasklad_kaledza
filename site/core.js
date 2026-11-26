/* Schedule logic. Mirrors the rules of the original nikasoft viewer:
   red = replacement/cancelled lesson, blue = УПК-type lesson (subject id starts with "u"), black = regular. */
(function (root) {
  "use strict";
  const DAY = 864e5, p2 = n => String(n).padStart(2, "0");
  const civil = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
  const fmt = d => `${p2(d.getUTCDate())}.${p2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  const parseDMY = s => civil(+s.slice(6, 10), +s.slice(3, 5), +s.slice(0, 2));
  const addDays = (d, n) => new Date(d.getTime() + n * DAY);
  const dow = d => d.getUTCDay() || 7;
  const mondayOf = d => addDays(d, 1 - dow(d));
  const arr = v => (v == null ? [] : [].concat(v));
  const isExam = n => /^экзамен/i.test(n || "");
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();

  function nowIn(tz) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return { date: civil(+p.year, +p.month, +p.day), minutes: (+p.hour % 24) * 60 + +p.minute };
  }

  function create(D, bells) {
    bells = bells || {};
    const periods = Object.entries(D.PERIODS || {}).map(([id, p]) => ({ id, b: parseDMY(p.b), e: parseDMY(p.e), fwm: p.fwm ? parseDMY(p.fwm) : null }));
    const pc = new Map();
    const getPeriod = d => {
      if (!pc.has(+d)) pc.set(+d, (periods.find(p => d >= p.b && d <= p.e) || {}).id || null);
      return pc.get(+d);
    };
    function weekNum(monday) {
      if (!D.DUALWEEK) return 0;
      for (let i = 0; i < 6; i++) {
        const p = getPeriod(addDays(monday, i));
        if (p) { const f = periods.find(x => x.id === p).fwm; return f ? (Math.floor(Math.round(Math.abs(monday - f) / DAY) / 7) & 1) + 1 : 0; }
      }
      return 0;
    }
    function dayInfo(date) {
      const ds = fmt(date), h = (D.HOLIDAY_TRANSFER || {})[ds];
      const i = { ds, daynum: dow(date), period: getPeriod(date), weekNum: weekNum(mondayOf(date)), vacation: false };
      if (h && h.type === "vacation") i.vacation = true;
      if (h && h.type === "transfer") { i.daynum = h.daynum; if (h.weeknum) i.weekNum = h.weeknum; i.period = h.period; }
      i.off = i.daynum > D.WEEKDAYNUM;
      return i;
    }
    // base schedule lookup: key = day + 2-digit lesson, retried with week number prefix
    function base(table, info, id, n) {
      const m = info.period && table[info.period] && table[info.period][id];
      if (!m) return null;
      let k = info.daynum + p2(n);
      for (;;) {
        if (m[k]) return m[k];
        if (info.weekNum > 0 && k.length === 3) k = info.weekNum + k; else return null;
      }
    }
    const subj = id => D.SUBJECTS[id] || null;
    const classEntries = r => arr(r.s).map((s, i) => ({
      subject: subj(s), upk: subj(s) === "УПК", exam: isExam(subj(s)),
      teacher: r.t ? clean(D.TEACHERS[arr(r.t)[i]]) : "", room: r.r ? clean(D.ROOMS[arr(r.r)[i]]) : "",
      group: r.g && arr(r.g)[i] != null && D.CLASSGROUPS[arr(r.g)[i]] || "" }));
    const teacherEntries = r => r.s === "M" ? [{ method: true }] : [{
      subject: subj(r.s), exam: isExam(subj(r.s)), classes: arr(r.c).map(c => D.CLASSES[c]).join(", "),
      room: r.r ? clean(D.ROOMS[arr(r.r)[0]]) : "", group: arr(r.g).filter(g => g !== "-1" && g !== -1).map(g => D.CLASSGROUPS[g]).join(", ") }];

    function lesson(kind, id, info, n) {
      const isC = kind === "c", entries = isC ? classEntries : teacherEntries;
      const ex = ((isC ? D.CLASS_EXCHANGE : D.TEACH_EXCHANGE)[id] || {})[info.ds];
      const e = ex && ex[n], b = base(isC ? D.CLASS_SCHEDULE : D.TEACH_SCHEDULE, info, id, n);
      const L = { n, tone: "ink", exchange: !!e, cancelled: false, entries: [], was: [] };
      if (e) {
        if (arr(e.s)[0] === "F") { L.cancelled = true; if (b) L.was = entries(b); }
        else L.entries = entries(e);
      } else if (b) L.entries = entries(b);
      // "УПК" is only a filler used by the timetable author: pretend such lessons do not exist
      const allUpk = es => es.length > 0 && es.every(x => x.upk);
      if (allUpk(L.entries) || (L.cancelled && allUpk(L.was))) { L.entries = []; L.was = []; L.cancelled = false; L.exchange = false; }
      const exam = L.entries.some(x => x.exam);
      L.tone = L.cancelled ? "purple" : exam ? "orange" : L.exchange ? "yellow" : "ink";
      L.empty = !L.entries.length && !L.cancelled;
      const official = D.LESSON_TIMES_BY_DAY && D.LESSON_TIMES_BY_DAY[info.daynum], custom = (bells.times || {})[info.daynum];
      const t = (official && official[n]) || (custom ? custom[n] : D.LESSON_TIMES[n]) || [];
      L.start = t[0] || ""; L.end = t[1] || "";
      return L;
    }
    function hasExchange(kind, id, date) {
      const info = dayInfo(date);
      return !info.vacation && !!((kind === "c" ? D.CLASS_EXCHANGE : D.TEACH_EXCHANGE)[id] || {})[info.ds];
    }
    function day(kind, id, date) {
      const info = dayInfo(date), out = { ...info, date, lessons: [], marks: {}, exchange: hasExchange(kind, id, date) };
      if (info.vacation || info.off) return out;
      const all = [];
      for (let n = D.FIRSTLESSONNUM || 1; n <= D.LESSONSINDAY; n++) all.push(lesson(kind, id, info, n));
      const used = all.filter(l => !l.empty);
      if (used.length) out.lessons = all.slice(all.indexOf(used[0]), all.indexOf(used[used.length - 1]) + 1);
      for (const x of bells.extras || []) {   // e.g. information hour between two lessons
        const L = out.lessons;
        if (x.day !== info.daynum || !L.length || !(L[0].n <= x.after && L[L.length - 1].n >= x.after + 1)) continue;
        L.splice(L.findIndex(q => q.n === x.after) + 1, 0, { info: true, text: x.text, start: x.start, end: x.end, empty: false, entries: [], was: [], tone: "ink" });
      }
      out.marks = { exam: out.lessons.some(l => l.tone === "orange") };
      return out;
    }
    const nat = (a, b) => a.name.localeCompare(b.name, "ru", { numeric: true });
    // Rooms: an index built from every teacher's lesson (exchanges included); a cancelled lesson frees its room.
    const rooms = [...new Set(Object.values(D.ROOMS || {}).map(clean).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
    const rcache = new Map();
    function roomIndex(date) {
      if (rcache.has(+date)) return rcache.get(+date);
      const idx = new Map();
      for (const tid of Object.keys(D.TEACHERS)) {
        for (const L of day("t", tid, date).lessons) {
          if (L.info || L.empty || L.cancelled) continue;
          for (const e of L.entries) {
            if (e.method || !e.room) continue;
            const m = idx.get(e.room) || {};
            (m[L.n] = m[L.n] || []).push({ subject: e.subject, classes: e.classes, group: e.group, teacher: clean(D.TEACHERS[tid]), tone: L.tone });
            idx.set(e.room, m);
          }
        }
      }
      rcache.set(+date, idx);
      return idx;
    }
    function roomDay(name, date) {
      const info = dayInfo(date), out = { ...info, date, lessons: [], marks: {} };
      if (info.vacation || info.off || !info.period) return out;
      const m = roomIndex(date).get(name) || {};
      const official = D.LESSON_TIMES_BY_DAY && D.LESSON_TIMES_BY_DAY[info.daynum], custom = (bells.times || {})[info.daynum];
      for (let n = D.FIRSTLESSONNUM || 1; n <= D.LESSONSINDAY; n++) {
        if (custom && !custom[n] && !(official && official[n])) continue;   // no such lesson slot on this weekday
        const t = (official && official[n]) || (custom ? custom[n] : D.LESSON_TIMES[n]) || [];
        const items = m[n] || [];
        out.lessons.push({ n, start: t[0] || "", end: t[1] || "", items, free: !items.length, empty: !items.length, cancelled: false,
          tone: items.some(i => i.tone === "orange") ? "orange" : items.some(i => i.tone === "yellow") ? "yellow" : "ink" });
      }
      out.marks = { exam: out.lessons.some(l => l.tone === "orange") };
      return out;
    }
    return {
      day, hasExchange, roomDay, rooms,
      exists: (kind, id) => kind === "c" ? !!D.CLASSES[id] : kind === "t" ? !!D.TEACHERS[id] : rooms.includes(id),
      classes: Object.entries(D.CLASSES).map(([id, name]) => ({ id, name, course: (D.CLASS_COURSES || {})[id] || "" })).sort(nat),
      teachers: Object.entries(D.TEACHERS).map(([id, n]) => ({ id, name: clean(n) })).sort(nat),
      name: (kind, id) => kind === "c" ? D.CLASSES[id] : kind === "t" ? clean(D.TEACHERS[id]) : id,
    };
  }
  root.ScheduleCore = { create, civil, fmt, addDays, dow, mondayOf, nowIn };
})(typeof self !== "undefined" ? self : globalThis);
