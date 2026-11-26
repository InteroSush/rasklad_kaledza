(() => {
  "use strict";
  const TZ = "Europe/Minsk";            // college time zone (used for "today" and the lesson clock)
  const DATA_URL = "data/schedule.json", BELLS_URL = "data/bells.json", ROOMS_URL = "data/rooms.json";
  const C = ScheduleCore, app = document.getElementById("app");
  const DAYS = ["панядзелак", "аўторак", "серада", "чацвер", "пятніца", "субота", "нядзеля"];
  const DS = ["Пн", "Аў", "Ср", "Чц", "Пт", "Сб", "Нд"];
  const MON = ["студзеня", "лютага", "сакавіка", "красавіка", "траўня", "чэрвеня", "ліпеня", "жніўня", "верасня", "кастрычніка", "лістапада", "снежня"];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  let D = null, S = null, raw = "", roomCfg = {};
  const st = { tab: store.get("tab", "c"), q: "", date: null };
  const today = () => C.nowIn(TZ).date;
  const favs = () => store.get("fav", []);

  async function load() {
    try {
      const opt = u => fetch(u, { cache: "no-cache" }).catch(() => null);
      const [res, bres, rres] = await Promise.all([fetch(DATA_URL, { cache: "no-cache" }), opt(BELLS_URL), opt(ROOMS_URL)]);
      if (!res.ok) throw new Error(res.status);
      const text = await res.text(), btext = bres && bres.ok ? await bres.text() : "{}", rtext = rres && rres.ok ? await rres.text() : "{}";
      if (text + btext + rtext === raw) return false;
      let bells = {}; try { bells = JSON.parse(btext); } catch {}
      try { roomCfg = JSON.parse(rtext); } catch { roomCfg = {}; }
      D = JSON.parse(text); raw = text + btext + rtext; S = C.create(D, bells); return true;
    } catch (e) {
      if (!D) app.innerHTML = `<p class="msg">Не атрымалася загрузіць расклад.<br><br><button class="chip" data-a="retry">Паўтарыць</button></p>`;
      return false;
    }
  }

  function startDate() {
    let d = today();
    while (C.dow(d) > D.WEEKDAYNUM) d = C.addDays(d, 1);
    return d;
  }
  function step(d, dir) {
    do { d = C.addDays(d, dir); } while (C.dow(d) > D.WEEKDAYNUM);
    return d;
  }

  /* ---------- home ---------- */
  function chip(kind, id, name, extra = "") {
    const f = favs().includes(kind + ":" + id);
    return `<button class="chip${extra}" data-a="open" data-k="${kind}" data-id="${esc(id)}">${esc(name)}</button>`;
  }
  function roomGroups() {
    const cfg = roomCfg.groups || [], out = cfg.map(g => ({ name: g.name, rooms: [] })), rest = [];
    for (const r of S.rooms) {
      let i = cfg.findIndex(g => (g.rooms || []).includes(r));
      if (i < 0) i = cfg.findIndex(g => g.pattern && new RegExp(g.pattern).test(r));
      (i >= 0 ? out[i].rooms : rest).push(r);
    }
    if (rest.length) out.push({ name: roomCfg.undefined || "Ня вызначаныя", rooms: rest });
    return out.filter(g => g.rooms.length);
  }
  function listHtml() {
    const q = st.q.trim().toLowerCase();
    if (st.tab === "r") {
      const gs = roomGroups().map(g => ({ ...g, rooms: g.rooms.filter(r => r.toLowerCase().includes(q)) })).filter(g => g.rooms.length);
      return gs.length ? gs.map(g => `<div class="sec"><h2>${esc(g.name)}</h2><div class="chips">${g.rooms.map(r => chip("r", r, r)).join("")}</div></div>`).join("") : `<p class="empty">Кабінет не знойдзены</p>`;
    }
    if (st.tab === "t") {
      const items = S.teachers.filter(t => t.name.toLowerCase().includes(q));
      return items.length ? `<ul class="tlist">${items.map(t => `<li><button data-a="open" data-k="t" data-id="${t.id}">${esc(t.name)}</button></li>`).join("")}</ul>` : `<p class="empty">Нікога не знойдзена</p>`;
    }
    const items = S.classes.filter(c => c.name.toLowerCase().includes(q));
    if (!items.length) return `<p class="empty">Групу не знойдзена</p>`;
    const courses = [...new Set(items.map(c => c.course))].sort();
    return courses.map(cr => `<div class="sec"><h2>${cr ? cr + " курс" : "Іншыя"}</h2><div class="chips">${items.filter(c => c.course === cr).map(c => chip("c", c.id, c.name)).join("")}</div></div>`).join("");
  }
  function home() {
    const fv = favs().map(f => f.split(":")).filter(([k, id]) => S.exists(k, id));
    app.innerHTML = `
      <header class="top"><div><h1>Расклад</h1><div class="sync">Абноўлена ${esc(D.EXPORT_DATE)} ${esc((D.EXPORT_TIME || "").slice(0, 5))}</div></div>
        <div class="btns"><button class="ico" data-a="tools" aria-label="Інструменты" title="Інструменты"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg></button>
        <button class="ico" data-a="menu" aria-label="Выгляд" title="Выгляд"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg></button></div></header>
      ${fv.length ? `<section class="sec"><h2>Мой расклад</h2><div class="chips">${fv.map(([k, id]) => `<button class="chip fav" data-a="open" data-k="${k}" data-id="${esc(id)}">${esc(S.name(k, id))}<small>${k === "c" ? "група" : k === "t" ? "настаўнік" : "кабінет"}</small></button>`).join("")}</div></section>` : ""}
      <div class="seg" role="tablist"><button role="tab" aria-selected="${st.tab === "c"}" data-a="tab" data-t="c">Групы</button><button role="tab" aria-selected="${st.tab === "t"}" data-a="tab" data-t="t">Настаўнікі</button><button role="tab" aria-selected="${st.tab === "r"}" data-a="tab" data-t="r">Кабінеты</button></div>
      <input class="search" type="search" placeholder="${{ c: "Знайсці групу", t: "Знайсці настаўніка", r: "Знайсці кабінет" }[st.tab] || ""}" value="${esc(st.q)}" autocomplete="off">
      <div id="list">${listHtml()}</div>`;
  }

  /* ---------- schedule ---------- */
  const titleOf = es => es.map(e => e.subject || "Урок скасаваны").filter((s, i, a) => s !== a[i - 1]).join(" / ");
  const roomLink = r => (r ? `<a class="rl" href="#/r/${encodeURIComponent(r)}">каб. ${esc(r)}</a>` : "");
  function meta(kind, L, entries) {
    const line = parts => `<div class="mt">${parts.filter(Boolean).join(" · ")}</div>`;
    if (kind === "t") return entries.map(e => (e.method ? "" : line([esc(e.classes), esc(e.group), roomLink(e.room)]))).join("");
    const multi = entries.length > 1;
    return entries.map(e => line(multi ? [esc(e.group), esc(e.teacher), roomLink(e.room)] : [esc(e.teacher), roomLink(e.room)])).join("");
  }
  let nowMin = null;   // minutes since midnight (college time zone) when viewing today, else null
  const hm = s => { const [h, m] = String(s).split(":").map(Number); return h * 60 + m; };
  let nowL = null;
  // The "current" lesson is highlighted from the end of the previous slot (the break) until its own end;
  // the first lesson of the day is highlighted 10 minutes before it starts. Cancelled lessons are never highlighted.
  function findNow(rows, min) {
    for (let i = 0; i < rows.length; i++) {
      const L = rows[i];
      if (L.cancelled || L.empty || !L.start || !L.end) continue;
      const p = rows[i - 1], from = p && p.end ? hm(p.end) : hm(L.start) - 10;
      if (min >= from && min < hm(L.end)) return L;
    }
    return null;
  }
  const nowCls = L => (L === nowL ? " now" : "");
  function lessonHtml(kind, L) {
    if (L.info) return `<li class="les info${nowCls(L)}"><div class="t">${esc(L.start)}<br>${esc(L.end)}</div><div class="w"><div class="ti">${esc(L.text)}</div></div></li>`;
    if (L.empty) return `<li class="gap">—</li>`;
    const time = `<div class="t"><b>${L.n}</b>${esc(L.start)}<br>${esc(L.end)}</div>`;
    if (L.cancelled) {
      const was = L.was.length ? `<div class="mt was">${esc(titleOf(L.was))}</div>` : "";
      return `<li class="les cancelled"><div class="t"><b>${L.n}</b></div><div class="w"><div class="ti"><i class="dot purple"></i>Урок скасаваны</div>${was}</div></li>`;
    }
    const method = L.entries[0].method;
        return `<li class="les ${L.tone}${nowCls(L)}">${time}<div class="w"><div class="ti"><i class="dot ${L.tone}"></i>${method ? "Метадычная гадзіна" : esc(titleOf(L.entries))}</div>${meta(kind, L, L.entries)}</div></li>`;
  }
  // Room schedule row: top line = group · teacher, bottom line = subject; free slots say "Вольны"
  function roomRow(L) {
    const time = `<div class="t"><b>${L.n}</b>${esc(L.start)}<br>${esc(L.end)}</div>`;
    if (L.free) return `<li class="les free">${time}<div class="w"><div class="ti">Вольны</div></div></li>`;
    const items = L.items.map(i => `<div class="it"><div class="ti"><i class="dot ${i.tone}"></i>${esc([i.classes + (i.group ? " (" + i.group + ")" : ""), i.teacher].filter(Boolean).join(" · "))}</div><div class="mt">${esc(i.subject || "")}</div></div>`).join("");
    return `<li class="les${nowCls(L)}">${time}<div class="w">${items}</div></li>`;
  }
  const marks = m => (m.exam ? `<span class="mk"><i class="orange"></i></span>` : "");
  function entity(kind, id) {
    if (!S.exists(kind, id)) { location.hash = "#/"; return; }
    const get = (x) => (kind === "r" ? S.roomDay(id, x) : S.day(kind, id, x));
    st.date = st.date || startDate();
    const d = st.date, mon = C.mondayOf(d), nw = C.nowIn(TZ), t0 = nw.date, r = get(d);
    nowMin = +d === +t0 ? nw.minutes : null;
    nowL = nowMin === null ? null : findNow(r.lessons, nowMin);
    const fav = favs().includes(kind + ":" + id);
    const strip = Array.from({ length: D.WEEKDAYNUM }, (_, i) => {
      const x = C.addDays(mon, i);
      return `<button class="day${+x === +d ? " sel" : ""}${+x === +t0 ? " today" : ""}" data-a="goto" data-d="${+x}">${marks(get(x).marks)}<span>${DS[i]}</span><b>${x.getUTCDate()}</b></button>`;
    }).join("");
    const body = r.vacation ? `<p class="empty">Канікулы або выхадны</p>`
      : !r.lessons.length ? `<p class="empty">${r.period ? "Няма заняткаў" : "На гэтую дату няма актыўнага раскладу"}</p>`
      : `<ol class="les-list">${r.lessons.map(L => (kind === "r" ? roomRow(L) : lessonHtml(kind, L))).join("")}</ol>`;
    app.innerHTML = `
      <header class="bar"><button class="ico" data-a="back" aria-label="Назад">‹</button>
        <div class="ttl"><h1>${kind === "c" ? "Група " : kind === "r" ? "Кабінет " : ""}${esc(S.name(kind, id))}</h1>${D.DUALWEEK && r.weekNum ? `<small>${r.weekNum === 1 ? "I" : "II"} тыдзень</small>` : ""}</div>
        <button class="ico${fav ? " on" : ""}" data-a="fav" data-k="${kind}" data-id="${esc(id)}" aria-pressed="${fav}" aria-label="${fav ? "Прыбраць з галоўнай" : "Захаваць на галоўную"}" title="${fav ? "Прыбраць з галоўнай" : "Захаваць на галоўную"}">${fav ? "★" : "☆"}</button></header>
      <nav class="week"><button class="arr" data-a="week" data-n="-7" aria-label="Мінулы тыдзень">‹</button>${strip}<button class="arr" data-a="week" data-n="7" aria-label="Наступны тыдзень">›</button></nav>
      <div class="dh"><h2>${DAYS[C.dow(d) - 1][0].toUpperCase() + DAYS[C.dow(d) - 1].slice(1)}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}</h2>${+d !== +t0 ? `<button data-a="today">Сёння</button>` : ""}</div>
      ${kind === "r" && r.lessons.length ? `<div class="occ">${r.lessons.map(L => `<span class="${L.free ? "" : "on"}" title="${L.free ? "вольны" : "заняты"}">${L.n}</span>`).join("")}</div>` : ""}
      ${body}
      <div class="legend"><span style="--c:var(--ink)">звычайны</span><span style="--c:var(--yel)">мог змяніцца</span><span style="--c:var(--pur)">скасаваны</span><span style="--c:var(--org)">экзамен</span></div>`;
  }

  /* ---------- appearance menu ---------- */
  const THEMES = [["sage", "Шалфей", "l"], ["sand", "Пясок", "l"], ["mist", "Туман", "l"], ["atrament", "Атрамант", "l"],
    ["night", "Ноч", "d"], ["graphite", "Графіт", "d"], ["navy", "Мора", "d"], ["oled", "OLED", "d"]];
  const FS = [85, 92, 100, 110, 120, 135, 150];
  const menu = document.getElementById("menu"), root = document.documentElement;
  const curTheme = () => { const t = store.get("theme", "auto"); return THEMES.some(x => x[0] === t) ? t : "auto"; };
  const curFs = () => (FS.includes(store.get("fs", 100)) ? store.get("fs", 100) : 100);
  function syncMeta() {
    const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute("content", bg));
  }
  function applyTheme(t) { if (t === "auto") delete root.dataset.theme; else root.dataset.theme = t; syncMeta(); }
  const thumb = ([id, name]) => `<button class="th${curTheme() === id ? " sel" : ""}" data-m="theme" data-t="${id}"><span class="sw" data-theme="${id}"><i class="l1"></i><i class="l2"></i><i class="dt"></i></span><span class="nm">${name}</span></button>`;
  function menuHtml() {
    const i = FS.indexOf(curFs());
    return `<div class="ov" data-m="close"><div class="sheet" role="dialog" aria-label="Выгляд">
      <div class="sh-h"><h2>Выгляд</h2><button class="ico" data-m="close" aria-label="Закрыць">✕</button></div>
      <button class="auto${curTheme() === "auto" ? " sel" : ""}" data-m="theme" data-t="auto">Аўтаматычна <small>як на прыладзе</small></button>
      <h3>Светлыя</h3><div class="grid">${THEMES.filter(t => t[2] === "l").map(thumb).join("")}</div>
      <h3>Цёмныя</h3><div class="grid">${THEMES.filter(t => t[2] === "d").map(thumb).join("")}</div>
      <h3>Памер шрыфта</h3><div class="fs"><button data-m="fs" data-d="-1" aria-label="Паменшыць" ${i <= 0 ? "disabled" : ""}>−</button><span>${FS[i]}%</span><button data-m="fs" data-d="1" aria-label="Павялічыць" ${i >= FS.length - 1 ? "disabled" : ""}>+</button></div>
    </div></div>`;
  }
  function paintMenu() {
    const y = (menu.querySelector(".sheet") || {}).scrollTop || 0;
    menu.innerHTML = menuHtml(); menu.querySelector(".sheet").scrollTop = y;
  }
  const openMenu = () => paintMenu();
  const openTools = () => {
    menu.innerHTML = `<div class="ov" data-m="close"><div class="sheet" role="dialog" aria-label="Інструменты">
      <div class="sh-h"><h2>Інструменты</h2><button class="ico" data-m="close" aria-label="Закрыць">✕</button></div>
      <button class="tool" data-m="go" data-h="#/f/list">Вольныя - спіс <span>›</span></button>
      <button class="tool" data-m="go" data-h="#/f/search">Вольныя - пошук <span>›</span></button></div></div>`;
  };
  const closeMenu = () => { menu.innerHTML = ""; };
  menu.addEventListener("click", e => {
    const b = e.target.closest("[data-m]"); if (!b) return;
    const m = b.dataset.m;
    if (m === "go") { closeMenu(); location.hash = b.dataset.h; return; }
    if (m === "close") { if (b.classList.contains("ov") && e.target !== b) return; closeMenu(); }
    else if (m === "theme") { store.set("theme", b.dataset.t); applyTheme(b.dataset.t); paintMenu(); }
    else if (m === "fs") {
      const n = Math.min(FS.length - 1, Math.max(0, FS.indexOf(curFs()) + +b.dataset.d));
      store.set("fs", FS[n]); root.style.fontSize = FS[n] + "%"; paintMenu();
    }
  });
  addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncMeta);
  applyTheme(curTheme()); root.style.fontSize = curFs() + "%";

  /* ---------- free rooms ---------- */
  const fs = { sel: new Set(), bld: "all", cls: false };
  const isClassroom = r => new RegExp(roomCfg.classroomPattern || "^\\d+\\D?$").test(r);
  const dayTitle = d => { const w = DAYS[C.dow(d) - 1]; return `${w[0].toUpperCase() + w.slice(1)}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
  function freeHead(title, d, t0) {
    const mon = C.mondayOf(d);
    const strip = Array.from({ length: D.WEEKDAYNUM }, (_, i) => { const x = C.addDays(mon, i);
      return `<button class="day${+x === +d ? " sel" : ""}${+x === +t0 ? " today" : ""}" data-a="goto" data-d="${+x}"><span>${DS[i]}</span><b>${x.getUTCDate()}</b></button>`; }).join("");
    return `<header class="bar"><button class="ico" data-a="back" aria-label="Назад">‹</button><div class="ttl"><h1>${title}</h1></div></header>
      <nav class="week"><button class="arr" data-a="week" data-n="-7" aria-label="Мінулы тыдзень">‹</button>${strip}<button class="arr" data-a="week" data-n="7" aria-label="Наступны тыдзень">›</button></nav>
      <div class="dh"><h2>${dayTitle(d)}</h2>${+d !== +t0 ? `<button data-a="today">Сёння</button>` : ""}</div>`;
  }
  const roomHref = r => `#/r/${encodeURIComponent(r)}`;
  const noSlots = fd => `<p class="empty">${fd.vacation ? "Канікулы або выхадны" : fd.period ? "Няма заняткаў" : "На гэтую дату няма актыўнага раскладу"}</p>`;
  function freePage(kind) {
    st.date = st.date || startDate();
    const d = st.date, nw = C.nowIn(TZ), t0 = nw.date, fd = S.freeDay(d), groups = roomGroups();
    nowMin = +d === +t0 ? nw.minutes : null; nowL = nowMin === null ? null : findNow(fd.slots, nowMin);
    if (kind === "list") {
      const rows = fd.slots.map(s => {
        const gs = groups.map(g => ({ g, rs: g.rooms.filter(r => fd.free.get(r).has(s.n)) })).filter(x => x.rs.length);
        const inner = gs.length ? gs.map(x => `<div class="fg"><div class="fl">${esc(x.g.name)}</div><div class="chs">${x.rs.map(r => `<a class="rc" href="${roomHref(r)}">${esc(r)}</a>`).join("")}</div></div>`).join("") : `<div class="mt">Вольных няма</div>`;
        return `<li class="les${s === nowL ? " now" : ""}"><div class="t"><b>${s.n}</b>${esc(s.start)}<br>${esc(s.end)}</div><div class="w">${inner}</div></li>`;
      }).join("");
      app.innerHTML = freeHead("Вольныя - спіс", d, t0) + (fd.slots.length ? `<ol class="les-list">${rows}</ol><p class="nt">Вольныя па раскладзе: заняткі па-за раскладам не ўлічваюцца.</p>` : noSlots(fd));
      return;
    }
    // search
    const nums = store.get("nums", false), have = new Set(fd.slots.map(s => s.n));
    const sel = [...fs.sel].filter(n => have.has(n));
    const N = fd.slots.length;
    const shown = groups.filter(g => fs.bld === "all" || g.name === fs.bld).map(g => ({
      name: g.name, rooms: g.rooms.filter(r => (!fs.cls || isClassroom(r)) && sel.every(n => fd.free.get(r).has(n))) })).filter(g => g.rooms.length);
    const cell = (r, s) => `<span class="cell${sel.includes(s.n) ? " s" : ""}">${fd.free.get(r).has(s.n) ? (nums ? `<b>${s.n}</b>` : `<i class="fd"></i>`) : `<i class="bd"></i>`}</span>`;
    const head = !nums ? `<div class="frow fh"><span></span>${fd.slots.map(s => `<span class="hn${sel.includes(s.n) ? " s" : ""}">${s.n}</span>`).join("")}</div>` : "";
    const body = shown.length ? shown.map(g => `${groups.length > 1 && fs.bld === "all" ? `<h3 class="gh">${esc(g.name)}</h3>` : ""}${g.rooms.map(r => `<div class="frow"><a class="rn" href="${roomHref(r)}">${esc(r)}</a>${fd.slots.map(s => cell(r, s)).join("")}</div>`).join("")}`).join("")
      : `<p class="empty">${sel.length ? "Няма кабінетаў, вольных ва ўсе абраныя ўрокі" : "Кабінетаў не знойдзена"}</p>`;
    app.innerHTML = freeHead("Вольныя - пошук", d, t0) + (!N ? noSlots(fd) : `<div class="fx" style="--n:${N}">
      <div class="fsel">${fd.slots.map(s => `<button class="${sel.includes(s.n) ? "on" : ""}" data-a="fsel" data-n="${s.n}" aria-pressed="${sel.includes(s.n)}">${s.n}</button>`).join("")}</div>
      <div class="seg2" role="group">${[["all", "Усе"], ...groups.map(g => [g.name, g.name.replace(/^На /, "")])].map(([v, n]) => `<button class="${fs.bld === v ? "on" : ""}" data-a="fb" data-b="${esc(v)}">${esc(n)}</button>`).join("")}</div>
      <div class="acts"><button data-a="freset">Скід</button><button class="${fs.cls ? "on" : ""}" data-a="fcls" aria-pressed="${fs.cls}">Толькі класы</button><button class="${nums ? "on" : ""}" data-a="fnums" aria-pressed="${nums}">Лічбы</button></div>
      <div class="ftab">${head}${body}</div></div>`);
  }

  /* ---------- routing & events ---------- */
  function render() {
    if (!D) return;
    const m = location.hash.match(/^#\/([ctr])\/(.+)$/);
    const f = location.hash.match(/^#\/f\/(list|search)$/);
    if (m) entity(m[1], decodeURIComponent(m[2]));
    else if (f) freePage(f[1]); else { st.date = null; home(); }
    if (!m && !f) window.scrollTo(0, 0);
  }
  addEventListener("hashchange", render);
  app.addEventListener("input", e => {
    if (!e.target.classList.contains("search")) return;
    st.q = e.target.value; document.getElementById("list").innerHTML = listHtml();
  });
  app.addEventListener("click", e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a;
    if (a === "retry") boot();
    else if (a === "fsel") { const n = +b.dataset.n; fs.sel.has(n) ? fs.sel.delete(n) : fs.sel.add(n); render(); }
    else if (a === "fb") { fs.bld = b.dataset.b; render(); }
    else if (a === "fcls") { fs.cls = !fs.cls; render(); }
    else if (a === "fnums") { store.set("nums", !store.get("nums", false)); render(); }
    else if (a === "freset") { fs.sel.clear(); fs.cls = false; render(); }
    else if (a === "menu") openMenu();
    else if (a === "tools") openTools();
    else if (a === "open") { st.date = null; location.hash = `#/${b.dataset.k}/${encodeURIComponent(b.dataset.id)}`; }
    else if (a === "back") { history.length > 1 ? history.back() : (location.hash = "#/"); }
    else if (a === "tab") { st.tab = b.dataset.t; st.q = ""; store.set("tab", st.tab); home(); }
    else if (a === "goto") { st.date = new Date(+b.dataset.d); render(); }
    else if (a === "week") { st.date = C.addDays(st.date, +b.dataset.n); if (C.dow(st.date) > D.WEEKDAYNUM) st.date = C.addDays(st.date, -1); render(); }
    else if (a === "today") { st.date = startDate(); render(); }
    else if (a === "fav") {
      const key = b.dataset.k + ":" + b.dataset.id, f = favs();
      store.set("fav", f.includes(key) ? f.filter(x => x !== key) : [...f, key]); render();
    }
  });
  let sx = 0, sy = 0;
  app.addEventListener("touchstart", e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  app.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (st.date && Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) { st.date = step(st.date, dx < 0 ? 1 : -1); render(); }
  }, { passive: true });

  async function boot() { await load(); render(); }
  const inEntity = () => /^#\/([ctr]|f)\//.test(location.hash);
  document.addEventListener("visibilitychange", async () => { if (!document.hidden) { const changed = await load(); if (changed || inEntity()) render(); } });
  setInterval(() => { if (!document.hidden && D && inEntity()) render(); }, 60000);   // moves the "current lesson" highlight
  boot();
  if ("serviceWorker" in navigator) {
    const had = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
