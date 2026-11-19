(() => {
  "use strict";
  const TZ = "Europe/Minsk";            // college time zone (used for "today" and the lesson clock)
  const DATA_URL = "data/schedule.json";
  const C = ScheduleCore, app = document.getElementById("app");
  const DAYS = ["панядзелак", "аўторак", "серада", "чацвер", "пятніца", "субота", "нядзеля"];
  const DS = ["Пн", "Аў", "Ср", "Чц", "Пт", "Сб", "Нд"];
  const MON = ["студзеня", "лютага", "сакавіка", "красавіка", "траўня", "чэрвеня", "ліпеня", "жніўня", "верасня", "кастрычніка", "лістапада", "снежня"];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  let D = null, S = null, raw = "";
  const st = { tab: store.get("tab", "c"), q: "", date: null };
  const today = () => C.nowIn(TZ).date;
  const favs = () => store.get("fav", []);

  async function load() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      if (text === raw) return false;
      D = JSON.parse(text); raw = text; S = C.create(D); return true;
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
    return `<button class="chip${extra}" data-a="open" data-k="${kind}" data-id="${id}">${esc(name)}${f && !extra ? "" : ""}</button>`;
  }
  function listHtml() {
    const q = st.q.trim().toLowerCase();
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
    const fv = favs().map(f => f.split(":")).filter(([k, id]) => (k === "c" ? D.CLASSES[id] : D.TEACHERS[id]));
    app.innerHTML = `
      <header class="top"><h1>Расклад</h1><div class="sync">Абноўлена ${esc(D.EXPORT_DATE)} ${esc((D.EXPORT_TIME || "").slice(0, 5))}</div></header>
      ${fv.length ? `<section class="sec"><h2>Мой расклад</h2><div class="chips">${fv.map(([k, id]) => `<button class="chip fav" data-a="open" data-k="${k}" data-id="${id}">${esc(S.name(k, id))}<small>${k === "c" ? "група" : "настаўнік"}</small></button>`).join("")}</div></section>` : ""}
      <div class="seg" role="tablist"><button role="tab" aria-selected="${st.tab === "c"}" data-a="tab" data-t="c">Групы</button><button role="tab" aria-selected="${st.tab === "t"}" data-a="tab" data-t="t">Настаўнікі</button></div>
      <input class="search" type="search" placeholder="${st.tab === "c" ? "Знайсці групу" : "Знайсці настаўніка"}" value="${esc(st.q)}" autocomplete="off">
      <div id="list">${listHtml()}</div>`;
  }

  /* ---------- schedule ---------- */
  const titleOf = es => es.map(e => e.subject || "Урок скасаваны").filter((s, i, a) => s !== a[i - 1]).join(" / ");
  function meta(kind, L, entries, cls = "") {
    if (kind === "t") return entries.map(e => e.method ? "" : `<div class="mt">${esc([e.classes, e.group, e.room && "каб. " + e.room].filter(Boolean).join(" · "))}</div>`).join("");
    const multi = entries.length > 1;
    return entries.map(e => `<div class="mt">${esc((multi ? [e.group, e.teacher, e.room && "каб. " + e.room] : [e.teacher, e.room && "каб. " + e.room]).filter(Boolean).join(" · "))}</div>`).join("");
  }
  function lessonHtml(kind, L) {
    if (L.empty) return `<li class="gap">—</li>`;
    const time = `<div class="t"><b>${L.n}</b>${esc(L.start)}<br>${esc(L.end)}</div>`;
    if (L.cancelled) {
      const was = L.was.length ? `<div class="was">${esc(titleOf(L.was))}</div>` : "";
      return `<li class="les red">${time}<div class="w"><div class="ti">Урок скасаваны</div>${was}</div></li>`;
    }
    const method = L.entries[0].method;
    const tag = L.exchange ? `<span class="tag">замена</span>` : "";
    return `<li class="les ${L.tone}">${time}<div class="w"><div class="ti">${method ? "Метадычны час" : esc(titleOf(L.entries))}${tag}</div>${meta(kind, L, L.entries)}</div></li>`;
  }
  function entity(kind, id) {
    if (!(kind === "c" ? D.CLASSES[id] : D.TEACHERS[id])) { location.hash = "#/"; return; }
    st.date = st.date || startDate();
    const d = st.date, mon = C.mondayOf(d), t0 = today(), r = S.day(kind, id, d);
    const fav = favs().includes(kind + ":" + id);
    const strip = Array.from({ length: D.WEEKDAYNUM }, (_, i) => {
      const x = C.addDays(mon, i);
      return `<button class="day${+x === +d ? " sel" : ""}${+x === +t0 ? " today" : ""}" data-a="goto" data-d="${+x}">${S.hasExchange(kind, id, x) ? "<i></i>" : ""}<span>${DS[i]}</span><b>${x.getUTCDate()}</b></button>`;
    }).join("");
    const body = r.vacation ? `<p class="empty">Канікулы або выхадны</p>`
      : !r.lessons.length ? `<p class="empty">${r.period ? "Няма заняткаў" : "На гэтую дату няма актыўнага раскладу"}</p>`
      : `<ol class="les-list">${r.lessons.map(L => lessonHtml(kind, L)).join("")}</ol>`;
    app.innerHTML = `
      <header class="bar"><button class="ico" data-a="back" aria-label="Назад">‹</button>
        <div class="ttl"><h1>${kind === "c" ? "Група " : ""}${esc(S.name(kind, id))}</h1>${D.DUALWEEK && r.weekNum ? `<small>${r.weekNum === 1 ? "I" : "II"} тыдзень</small>` : ""}</div>
        <button class="ico${fav ? " on" : ""}" data-a="fav" data-k="${kind}" data-id="${id}" aria-pressed="${fav}" aria-label="${fav ? "Прыбраць з галоўнай" : "Захаваць на галоўную"}" title="${fav ? "Прыбраць з галоўнай" : "Захаваць на галоўную"}">${fav ? "★" : "☆"}</button></header>
      <nav class="week"><button class="arr" data-a="week" data-n="-7" aria-label="Мінулы тыдзень">‹</button>${strip}<button class="arr" data-a="week" data-n="7" aria-label="Наступны тыдзень">›</button></nav>
      <div class="dh"><h2>${DAYS[C.dow(d) - 1][0].toUpperCase() + DAYS[C.dow(d) - 1].slice(1)}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}</h2>${+d !== +t0 ? `<button data-a="today">Сёння</button>` : ""}</div>
      ${body}
      <div class="legend"><span style="--c:var(--ink)">звычайны</span><span style="--c:var(--red)">замена або адмена</span><span style="--c:var(--blue)">УПК</span></div>`;
  }

  /* ---------- routing & events ---------- */
  function render() {
    if (!D) return;
    const m = location.hash.match(/^#\/([ct])\/(\w+)/);
    if (m) entity(m[1], m[2]); else { st.date = null; home(); }
    if (!m) window.scrollTo(0, 0);
  }
  addEventListener("hashchange", render);
  app.addEventListener("input", e => {
    if (!e.target.classList.contains("search")) return;
    st.q = e.target.value; document.getElementById("list").innerHTML = listHtml();
  });
  app.addEventListener("click", e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a, m = location.hash.match(/^#\/([ct])\/(\w+)/);
    if (a === "retry") boot();
    else if (a === "open") { st.date = null; location.hash = `#/${b.dataset.k}/${b.dataset.id}`; }
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
  document.addEventListener("visibilitychange", async () => { if (!document.hidden && await load()) render(); });
  boot();
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
