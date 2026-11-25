(function () {
  "use strict";
  var SKILLS = window.SKILLS || [];
  var FREELANCE = window.FREELANCE || [];
  var SITE = window.SITE || { name: "Zero2Gig", apiPath: "/api/vet" };
  var app = document.getElementById("app");
  var KEY = "skillroute-v2";

  // Points rules
  var FIRST_TRY = 10, SECOND_TRY = 5, PASS_BONUS = 50;
  function multiplier(streak) { return streak >= 5 ? 2 : streak >= 3 ? 1.5 : streak >= 2 ? 1.2 : 1; }

  // ---------- storage ----------
  // ---------- accounts (Supabase) ----------
  var sb = (window.supabase && SITE.supabaseUrl && SITE.supabaseKey) ? window.supabase.createClient(SITE.supabaseUrl, SITE.supabaseKey, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true } }) : null;
  var user = null;
  var OWNER = "skillroute-owner";

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} scheduleSync(); }
  function summary(d) {
    var pts = 0, done = 0;
    Object.keys(d).forEach(function (k) { var c = d[k]; if (c && typeof c === "object") { pts += totalPts(c); if (c.done) done++; } });
    return { pts: pts, done: done };
  }
  function scheduleSync() {
    if (!sb || !user) return;
    clearTimeout(scheduleSync.t);
    scheduleSync.t = setTimeout(pushProgress, 800);
  }
  function pushProgress() {
    if (!sb || !user) return Promise.resolve();
    var d = load(), sm = summary(d);
    return sb.from("progress").upsert({ user_id: user.id, data: d, total_points: sm.pts, classes_done: sm.done, updated_at: new Date().toISOString() })
      .then(function (r) { if (r.error) console.error("Sync failed", r.error); });
  }
  function better(a, b) {
    if (!a) return b; if (!b) return a;
    var pa = totalPts(a), pb = totalPts(b);
    if (pa !== pb) return pa > pb ? a : b;
    return (a.step || 0) >= (b.step || 0) ? a : b;
  }
  function pullAndMerge() {
    var owner = localStorage.getItem(OWNER);
    var local = (!owner || owner === user.id) ? load() : {};
    return sb.from("progress").select("data").eq("user_id", user.id).maybeSingle().then(function (r) {
      var remote = (r.data && r.data.data) || {}, merged = {};
      Object.keys(local).concat(Object.keys(remote)).forEach(function (k) { merged[k] = better(local[k], remote[k]); });
      try { localStorage.setItem(KEY, JSON.stringify(merged)); localStorage.setItem(OWNER, user.id); } catch (e) {}
      return pushProgress();
    });
  }
  function setUser(u) {
    user = u || null;
    if (!user) return Promise.resolve();
    return pullAndMerge().catch(function (e) { console.error(e); });
  }
  function displayName() { var m = (user && user.user_metadata) || {}; return user ? (m.full_name || m.name || (user.email || "").split("@")[0]) : ""; }
  function avatarHTML(cls) {
    var m = (user && user.user_metadata) || {}, pic = m.avatar_url || m.picture;
    return pic ? '<img class="' + cls + '" src="' + esc(pic) + '" alt="" referrerpolicy="no-referrer">' : esc(displayName().charAt(0).toUpperCase());
  }
  function cls(sid, i) { var d = load(); return d[sid + ":" + i] || { step: 0, answers: {}, points: 0, streak: 0, best: 0, done: false }; }
  function saveCls(sid, i, c) { var d = load(); d[sid + ":" + i] = c; save(d); }

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function find(id) { for (var i = 0; i < SKILLS.length; i++) if (SKILLS[i].id === id) return SKILLS[i]; return null; }
  function totalPts(c) { return Math.round(c.points + (c.review && c.review.passed ? PASS_BONUS : 0)); }
  function skillStats(s) {
    var pts = 0, done = 0;
    s.modules.forEach(function (_, i) { var c = cls(s.id, i); pts += totalPts(c); if (c.done) done++; });
    return { pts: pts, done: done, pct: Math.round(done / s.modules.length * 100) };
  }
  function allStats() {
    var pts = 0, done = 0, best = 0;
    SKILLS.forEach(function (s) { s.modules.forEach(function (_, i) { var c = cls(s.id, i); pts += totalPts(c); if (c.done) done++; best = Math.max(best, c.best || 0); }); });
    return { pts: pts, done: done, best: best };
  }
  function toast(t) { var el = document.getElementById("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove("show"); }, 1800); }
  function popAt(el, text) {
    var r = el.getBoundingClientRect(); var p = document.createElement("div");
    p.className = "pop"; p.textContent = text; p.style.left = (r.right - 64) + "px"; p.style.top = (r.top + r.height / 2 - 16) + "px";
    document.body.appendChild(p); setTimeout(function () { p.remove(); }, 900);
  }
  function setTitle(t) { document.title = t ? t + " | " + SITE.name : SITE.name + ": learn a digital skill from zero"; }
  var ICONS = {
    frontend: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M10 9l-2 2 2 2M14 9l2 2-2 2"/>',
    backend: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6"/>',
    uiux: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M9.5 7h5M9.5 11h5M9.5 15h2.5"/>',
    "graphic-design": '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
    "digital-marketing": '<path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z"/><path d="M15 9a4 4 0 010 6M18 6a8 8 0 010 12"/>',
    "content-writing": '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    "data-analysis": '<path d="M5 20V10M11 20V4M17 20v-7M22 20H2"/>',
    "ai-automation": '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 14h.01M15 14h.01M2 14h2M20 14h2"/><circle cx="12" cy="3" r="1"/>',
    home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
    learn: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z"/><path d="M4 19a2 2 0 012-2h13"/>',
    board: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4a3 3 0 003 3M17 6h3a3 3 0 01-3 3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'
  };
  function svg(name, size) { return '<svg viewBox="0 0 24 24" width="' + (size || 22) + '" height="' + (size || 22) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>"; }
  function ico(s, size) { return svg(s.id, size); }
  function totals() {
    var q = 0, c = 0, r = 0;
    SKILLS.forEach(function (s) { c += s.modules.length; r += (s.resources || []).length; s.modules.forEach(function (m) { q += m.questions.length; }); });
    return { skills: SKILLS.length, classes: c, questions: q, resources: r };
  }
  function nextClass(s) { for (var i = 0; i < s.modules.length; i++) if (!cls(s.id, i).done) return i; return 0; }
  function isComplete(s) { return skillStats(s).done === s.modules.length; }
  function getLast() { try { return JSON.parse(localStorage.getItem("z2g-last")); } catch (e) { return null; } }
  function nav(active) {
    var links = [["#/", "Skills", "home"], ["#/learn", "My learning", "learn"], ["#/leaderboard", "Leaderboard", "board"]];
    return '<header class="nav"><div class="wrap"><a class="logo" href="#/"><span class="logo-mark">' + LOGO_SVG + "</span>" + esc(SITE.name) + "</a>" +
      '<nav class="nav-links" aria-label="Main">' + links.map(function (l) { return '<a href="' + l[0] + '"' + (active === l[2] ? ' aria-current="page"' : "") + ">" + l[1] + "</a>"; }).join("") + "</nav>" +
      '<div class="nav-r">' + themeBtn() + '<span class="pts-pill" title="Total points"><span class="coin"></span>' + allStats().pts + "</span>" +
      (sb ? (user ? '<a class="avatar" href="#/account" title="My account">' + avatarHTML("av-img") + "</a>" : '<a class="btn" href="#/login">Log in</a>') : "") +
      "</div></div></header>" +
      '<nav class="tabbar" aria-label="Main">' + links.concat([[user || !sb ? "#/account" : "#/login", user ? "Account" : "Log in", "user"]]).map(function (l) {
        return '<a href="' + l[0] + '"' + (active === l[2] ? ' aria-current="page"' : "") + ">" + svg(l[2], 22) + "<span>" + l[1] + "</span></a>";
      }).join("") + "</nav>";
  }
  function footer() {
    return '<footer class="site-foot"><div class="foot-grid">' +
      '<div><a class="logo" href="#/"><span class="logo-mark">' + LOGO_SVG + "</span>" + esc(SITE.name) + '</a><p>Learn a digital skill from zero, one interactive class at a time.</p></div>' +
      "<div><h4>Learn</h4>" + SKILLS.slice(0, 4).map(function (s) { return '<a href="#/skill/' + s.id + '">' + esc(s.title) + "</a>"; }).join("") + "</div>" +
      "<div><h4>More skills</h4>" + SKILLS.slice(4).map(function (s) { return '<a href="#/skill/' + s.id + '">' + esc(s.title) + "</a>"; }).join("") + "</div>" +
      '<div><h4>Zero2Gig</h4><a href="#/learn">My learning</a><a href="#/leaderboard">Leaderboard</a><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a></div>' +
      '</div><p class="copy">© 2026 ' + esc(SITE.name) + ". Built for beginners.</p></footer>";
  }

  // ---------- router ----------
  function route() {
    var p = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    document.onkeydown = null;
    ZCTX = {};
    document.body.dataset.view = p[0] === "login" ? "login" : (p[0] === "skill" && p[2] === "class") ? "player" : "page";
    if (p[0] === "login") return loginPage();
    if (p[0] === "admin") return user ? adminPage() : (location.hash = "#/login");
    if (p[0] === "account") return user ? accountPage() : (location.hash = "#/login");
    if (p[0] === "learn") return learnPage();
    if (p[0] === "leaderboard") return leaderboardPage();
    if (p[0] === "certificate" && find(p[1])) return certificatePage(find(p[1]));
    var s = p[0] === "skill" ? find(p[1]) : null;
    if (s && p[2] === "class" && sb && !user) {
      try { sessionStorage.setItem("skillroute-next", location.hash); } catch (e) {}
      location.hash = "#/login";
      return;
    }
    if (s && p[2] === "class") {
      var i = Number(p[3]);
      if (Number.isInteger(i) && i >= 0 && i < s.modules.length) return player(s, i);
    }
    if (s) return skillPage(s, p[2] === "resources" ? "res" : "classes");
    home();
  }

  // ---------- home ----------
  var MATCH = [
    ["Build things that work on screens", "frontend"],
    ["Know how apps work behind the scenes", "backend"],
    ["Make apps feel easy to use", "uiux"],
    ["Make things look beautiful", "graphic-design"],
    ["Help businesses sell more", "digital-marketing"],
    ["Write and explain things", "content-writing"],
    ["Find patterns in numbers", "data-analysis"],
    ["Let AI do the boring work", "ai-automation"]
  ];
  function courseCard(s) {
    var k = skillStats(s), q = s.modules.reduce(function (a, m) { return a + m.questions.length; }, 0);
    return '<a class="course" id="card-' + s.id + '" data-search="' + esc((s.title + " " + s.tagline).toLowerCase()) + '" href="#/skill/' + s.id + '" style="--c:' + s.color + '">' +
      '<div class="cover"><span class="cover-ico">' + ico(s, 40) + '</span><span class="badge">Beginner</span>' + (isComplete(s) ? '<span class="badge done">Completed</span>' : "") + "</div>" +
      '<div class="course-b"><h3>' + esc(s.title) + "</h3><p>" + esc(s.tagline) + "</p>" +
      '<div class="course-meta">' + s.modules.length + " classes · " + q + " questions · " + esc(s.duration) + "</div>" +
      (k.done || k.pts
        ? '<div class="meter"><i style="width:' + k.pct + '%"></i></div><div class="card-foot"><span>' + k.done + " of " + s.modules.length + " classes</span><span>" + k.pts + " pts</span></div>"
        : '<div class="card-foot"><span class="free">Free</span><span class="go">Start learning →</span></div>') +
      "</div></a>";
  }
  function home() {
    setTitle("");
    var T = totals(), last = getLast(), cont = "";
    if (last && find(last.sid) && find(last.sid).modules[last.ci]) {
      var ls = find(last.sid), lc = cls(ls.id, last.ci);
      cont = '<section class="continue" style="--c:' + ls.color + '"><span class="cont-ico">' + ico(ls, 26) + '</span><div class="cont-txt"><small>Continue where you stopped</small><b>' + esc(ls.title) + " · Class " + (last.ci + 1) + ": " + esc(ls.modules[last.ci].title) + '</b></div><a class="btn" href="#/skill/' + ls.id + "/class/" + last.ci + '">' + (lc.done ? "Review" : "Resume") + "</a></section>";
    }
    app.innerHTML = nav("home") +
      '<main>' +
      '<section class="hero2"><div class="wrap hero2-in">' +
        "<div>" + (user ? '<p class="hello">' + (hasAnyProgress() ? "Welcome back, " : "Welcome, ") + esc(displayName().split(" ")[0]) + "</p>" : '<p class="eyebrow">Free digital skills school</p>') +
          "<h1>Go from zero to your first gig.</h1>" +
          '<p class="hero-sub">Interactive classes that teach you step by step, an AI tutor that answers your questions, and real projects reviewed by AI. No long videos. No confusion about where to start.</p>' +
          '<div class="hero-cta"><a class="btn big" href="' + (user || !sb ? "#skills" : "#/login") + '" data-scroll="skills">' + (user ? "Continue learning" : "Start learning free") + '</a><a class="btn soft big" href="#skills" data-scroll="skills">Browse skills</a></div>' +
          '<dl class="hero-stats"><div><dt>' + T.skills + "</dt><dd>skills</dd></div><div><dt>" + T.classes + "</dt><dd>classes</dd></div><div><dt>" + T.questions + "</dt><dd>questions</dd></div><div><dt>" + T.resources + "+</dt><dd>resources</dd></div></dl>" +
        "</div>" +
        '<div class="preview" aria-hidden="true"><div class="pv-top"><span class="pv-bar"><i></i></span><span class="pv-streak">🔥 3 ×1.5</span><span class="pts-pill"><span class="coin"></span>42</span></div>' +
          '<p class="pv-k">Question 2 of 3</p><p class="pv-q">Which layer sits between the content and the border?</p>' +
          '<div class="pv-o">A&nbsp;&nbsp;Margin</div><div class="pv-o right">B&nbsp;&nbsp;Padding<span>+15</span></div><div class="pv-o">C&nbsp;&nbsp;Outline</div>' +
          '<div class="pv-f"><b>Correct!</b> Padding is the space inside the border.</div></div>' +
      "</div></section>" +
      '<div class="wrap"><div id="daily"></div>' + cont +
        '<section class="section" id="skills"><div class="sec-head"><div><h2>Choose a skill</h2><p class="sec-sub">Every skill is free and starts from the very beginning.</p></div>' +
          '<label class="search">' + svg("search", 18) + '<input type="search" id="q" placeholder="Search skills" aria-label="Search skills"></label></div>' +
          '<div class="courses" id="courses">' + SKILLS.map(courseCard).join("") + '</div><p class="empty-note" id="none" hidden>No skill matches that search.</p></section>' +
        '<section class="section finder"><div><h2>Not sure which one fits you?</h2><p class="sec-sub">Tap what sounds most like you.</p></div>' +
          '<div class="chips2">' + MATCH.map(function (m, k) { return '<button type="button" data-match="' + k + '" aria-pressed="false">' + esc(m[0]) + "</button>"; }).join("") + '</div><div id="match-out"></div></section>' +
        '<section class="section"><h2>How it works</h2><ol class="steps">' +
          [["Pick a skill", "Choose from 8 in-demand digital skills. Each one has 4 classes that build on each other."],
           ["Learn in short steps", "Read a little, see a diagram, then answer a question. You’re never just scrolling."],
           ["Build your score", "Earn points for every right answer. Answer streaks multiply your points."],
           ["Ship a real project", "Each class ends with a project. Upload it and the AI reviewer tells you what’s good and what to fix."]]
            .map(function (x, i) { return '<li><span class="step-n">' + (i + 1) + "</span><h3>" + x[0] + "</h3><p>" + x[1] + "</p></li>"; }).join("") + "</ol></section>" +
        '<section class="section"><h2>Everything you need to get started</h2><div class="features">' +
          [["learn", "Interactive classes", "Lessons, tappable diagrams and questions in one smooth flow."],
           ["board", "Leaderboard", "See how your points compare with other learners."],
           ["check", "Certificates", "Finish all the classes in a skill and download your certificate."],
           ["data-analysis", "AI project reviews and daily streaks", "Instant feedback on what you build, and a streak that keeps you learning every day."],
           ["ai-automation", "Zee, your AI tutor", "Stuck? Ask Zee. It knows the class you’re on and explains things simply."],
           ["content-writing", "Resource library", T.resources + "+ extra courses, templates and tools, sorted by skill."]]
            .map(function (x) { return '<div class="feature"><span class="f-ico">' + svg(x[0], 22) + "</span><h3>" + x[1] + "</h3><p>" + x[2] + "</p></div>"; }).join("") + "</div></section>" +
        '<section class="section faq"><h2>Questions people ask</h2>' +
          [["Is Zero2Gig really free?", "Yes. All 8 skills, every class and the AI project reviews are free."],
           ["I’ve never done anything digital before. Can I start?", "Yes. Every skill starts from zero and explains things in plain language."],
           ["How long does a class take?", "About 15 to 20 minutes for the lesson and questions. The project at the end takes longer, because you build something real."],
           ["Do I get a certificate?", "Yes. When you finish all 4 classes in a skill, you can download a certificate with your name on it."],
           ["What is Zee?", "Zee is the AI tutor built into Zero2Gig. Tap “Ask Zee” on any page to ask a question, get a simpler explanation, or be quizzed on your class."],
           ["Can I learn on my phone?", "Yes. The whole site is built for phones first, and your progress syncs to your Google account."]]
            .map(function (x) { return "<details><summary>" + x[0] + "</summary><p>" + x[1] + "</p></details>"; }).join("") + "</section>" +
        '<section class="cta-band"><h2>Your first class is 15 minutes away.</h2><p>Pick a skill and start now. It’s free.</p><a class="btn big light" href="' + (user || !sb ? "#skills" : "#/login") + '" data-scroll="skills">' + (user ? "Pick a skill" : "Start learning free") + "</a></section>" +
      "</div>" + footer() + "</main>";

    app.querySelectorAll("[data-scroll]").forEach(function (a) {
      if (a.getAttribute("href").charAt(1) === "/") return;
      a.addEventListener("click", function (e) { e.preventDefault(); document.getElementById(a.dataset.scroll).scrollIntoView({ behavior: "smooth" }); });
    });
    loadDaily(last);
    var q = document.getElementById("q");
    q.addEventListener("input", function () {
      var v = q.value.trim().toLowerCase(), shown = 0;
      app.querySelectorAll(".course").forEach(function (c) { var ok = c.dataset.search.indexOf(v) !== -1; c.hidden = !ok; if (ok) shown++; });
      document.getElementById("none").hidden = shown > 0;
    });
    app.querySelectorAll("[data-match]").forEach(function (b) {
      b.addEventListener("click", function () {
        app.querySelectorAll("[data-match]").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        var s = find(MATCH[+b.dataset.match][1]);
        document.getElementById("match-out").innerHTML =
          '<a class="match-result" href="#/skill/' + s.id + '" style="--c:' + s.color + '"><span class="cont-ico">' + ico(s, 26) + "</span><div><small>We’d start with</small><b>" + esc(s.title) + '</b></div><span class="go">See the classes →</span></a>';
      });
    });
  }

  // ---------- skill page ----------
  function skillPage(s, tab) {
    setTitle(s.title);
    var k = skillStats(s), resCount = (s.resources || []).length;
    var q = s.modules.reduce(function (a, m) { return a + m.questions.length; }, 0);
    var nx = nextClass(s), started = k.done > 0 || cls(s.id, 0).step > 0, complete = isComplete(s);
    var learn = []; s.modules.forEach(function (m) { learn.push(m.keyPoints[0], m.keyPoints[1]); });
    ZCTX = { skill: s.title, text: s.intro };

    var classesHTML = '<div class="classes">' + s.modules.map(function (m, i) {
      var c = cls(s.id, i);
      var status = c.done ? '<span class="ok">Finished</span>' : c.step > 0 ? "In progress" : "Not started";
      var review = c.review ? (c.review.passed ? '<span class="ok">Project passed</span>' : "Project needs another try") : "";
      var label = c.done ? "Review" : c.step > 0 ? "Continue" : "Start";
      return '<article class="class-card' + (c.done ? " done" : "") + '">' +
        '<div class="class-num">' + (c.done ? svg("check", 24) : i + 1) + "</div>" +
        "<div><h3>" + esc(m.title) + "</h3><p>" + esc(m.summary) + "</p>" +
        '<div class="class-meta"><span>' + status + "</span><span>" + m.lesson.length + " lessons</span><span>" + m.questions.length + " questions</span><span>1 project</span>" + (totalPts(c) ? "<span>" + totalPts(c) + " pts</span>" : "") + (review ? "<span>" + review + "</span>" : "") + "</div></div>" +
        '<a class="btn' + (c.done ? " soft" : "") + '" href="#/skill/' + s.id + "/class/" + i + '">' + label + "</a></article>";
    }).join("") + "</div>";

    function resRow(r) {
      var host = /mega\.nz/.test(r.url) ? "MEGA" : /docs\.google/.test(r.url) ? "Google Doc" : /drive\.google/.test(r.url) ? "Google Drive" : "Link";
      return '<a class="res" href="' + esc(r.url) + '" target="_blank" rel="noopener"><span class="ri">' + svg("learn", 18) + "</span><span>" + esc(r.title) + "</span><small>" + host + " ↗</small></a>";
    }
    var resHTML = '<div class="res-list">' + (resCount ? s.resources.map(resRow).join("") : '<p class="empty-note">No extra resources yet.</p>') + "</div>" +
      '<h2 class="res-h">Start earning with your skill</h2><div class="res-list">' + FREELANCE.map(resRow).join("") + "</div>";

    app.innerHTML = nav("home") + '<main style="--c:' + s.color + '">' +
      '<section class="c-hero"><div class="wrap c-hero-in"><div>' +
        '<nav class="crumbs2"><a href="#/">Skills</a> / <span>' + esc(s.title) + "</span></nav>" +
        "<h1>" + esc(s.title) + '</h1><p class="c-sub">' + esc(s.intro) + "</p>" +
        '<div class="c-meta"><span class="badge solid">Beginner</span><span>' + s.modules.length + " classes</span><span>" + q + " questions</span><span>" + esc(s.duration) + "</span><span>Certificate</span></div>" +
      "</div>" +
      '<aside class="enroll"><div class="cover"><span class="cover-ico">' + ico(s, 48) + "</span></div><div class=\"enroll-b\">" +
        (started ? '<div class="meter"><i style="width:' + k.pct + '%"></i></div><p class="enroll-p">' + k.done + " of " + s.modules.length + " classes · " + k.pts + " pts</p>" : '<p class="enroll-free">Free</p>') +
        (complete ? '<a class="btn big" href="#/certificate/' + s.id + '">Get your certificate</a>' : '<a class="btn big" href="#/skill/' + s.id + "/class/" + nx + '">' + (started ? "Continue class " + (nx + 1) : "Start learning") + "</a>") +
        '<ul class="incl"><li>' + svg("check", 18) + s.modules.length + " interactive classes</li><li>" + svg("check", 18) + q + " questions with instant feedback</li><li>" + svg("check", 18) + s.modules.length + " AI-reviewed projects</li><li>" + svg("check", 18) + resCount + " extra resources</li><li>" + svg("check", 18) + "Certificate of completion</li></ul>" +
      "</div></aside></div></section>" +
      '<div class="wrap c-body"><div class="c-main">' +
        '<section class="learn-box"><h2>What you’ll learn</h2><ul>' + learn.map(function (x) { return "<li>" + svg("check", 18) + "<span>" + esc(x) + "</span></li>"; }).join("") + "</ul></section>" +
        '<div class="tabs" role="tablist"><button role="tab" aria-selected="' + (tab === "classes") + '" data-tab="classes">Classes</button><button role="tab" aria-selected="' + (tab === "res") + '" data-tab="res">Resource library (' + resCount + ")</button></div>" +
        '<div id="tabpanel">' + (tab === "res" ? resHTML : classesHTML) + "</div>" +
        '<section class="outcome"><h2>You’ll finish with</h2><p>' + esc(s.outcome) + ".</p></section>" +
      "</div></div>" + footer() + "</main>";

    app.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () {
        app.querySelectorAll("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", "false"); });
        b.setAttribute("aria-selected", "true");
        document.getElementById("tabpanel").innerHTML = b.dataset.tab === "res" ? resHTML : classesHTML;
      });
    });
  }

  // ---------- my learning ----------
  function learnPage() {
    setTitle("My learning");
    var st = allStats();
    var active = SKILLS.filter(function (s) { var k = skillStats(s); return k.done > 0 || k.pts > 0 || cls(s.id, 0).step > 0; });
    var done = SKILLS.filter(isComplete);
    var rows = active.map(function (s) {
      var k = skillStats(s), nx = nextClass(s), comp = isComplete(s);
      return '<article class="my-row" style="--c:' + s.color + '"><span class="cont-ico">' + ico(s, 26) + '</span><div class="my-mid"><h3>' + esc(s.title) + '</h3><div class="meter"><i style="width:' + k.pct + '%"></i></div><p>' + k.done + " of " + s.modules.length + " classes · " + k.pts + " pts</p></div>" +
        (comp ? '<a class="btn" href="#/certificate/' + s.id + '">Certificate</a>' : '<a class="btn" href="#/skill/' + s.id + "/class/" + nx + '">Continue</a>') + "</article>";
    }).join("");
    app.innerHTML = nav("learn") + '<main class="wrap page">' +
      "<h1>My learning</h1>" +
      '<section class="stats"><div class="stat"><b>' + st.pts + "</b><span>Total points</span></div><div class=\"stat\"><b>" + st.done + "</b><span>Classes finished</span></div><div class=\"stat\"><b>" + done.length + "</b><span>Certificates</span></div></section>" +
      (active.length ? '<h2 class="sub-h">In progress</h2><div class="my-list">' + rows + "</div>"
        : '<div class="empty"><h2>You haven’t started a skill yet</h2><p>Pick one and take your first class. It takes about 15 minutes.</p><a class="btn big" href="#/">Browse skills</a></div>') +
      (active.length < SKILLS.length ? '<h2 class="sub-h">Try next</h2><div class="courses">' + SKILLS.filter(function (s) { return active.indexOf(s) === -1; }).slice(0, 4).map(courseCard).join("") + "</div>" : "") +
      "</main>" + footer();
  }

  // ---------- leaderboard ----------
  function leaderboardPage() {
    setTitle("Leaderboard");
    app.innerHTML = nav("board") + '<main class="wrap page"><h1>Leaderboard</h1><p class="sec-sub">The top learners on ' + esc(SITE.name) + ' by total points.</p><div id="lb"><p class="msg"><span class="loader"></span> Loading…</p></div></main>' + footer();
    var out = document.getElementById("lb");
    if (!sb) { out.innerHTML = '<p class="msg">The leaderboard appears once accounts are connected.</p>'; return; }
    if (!user) { out.innerHTML = '<div class="empty"><h2>Log in to see the leaderboard</h2><p>Sign in with Google to see where you rank.</p><a class="btn big" href="#/login">Log in</a></div>'; return; }
    pushProgress().then(function () { return sb.rpc("leaderboard"); }).then(function (r) {
      if (r.error) throw r.error;
      var rows = r.data || [];
      if (!rows.length) { out.innerHTML = '<div class="empty"><h2>No points yet</h2><p>Be the first on the board. Finish a class to earn points.</p><a class="btn big" href="#/">Start a class</a></div>'; return; }
      out.innerHTML = '<ol class="lb">' + rows.map(function (x, i) {
        return '<li class="' + (x.is_me ? "me" : "") + '"><span class="rank r' + (i + 1) + '">' + (i + 1) + '</span><span class="lb-name">' + esc(x.name || "Learner") + (x.is_me ? " (you)" : "") + '</span><span class="lb-c">' + x.classes_done + ' classes</span><span class="pts-pill"><span class="coin"></span>' + x.total_points + "</span></li>";
      }).join("") + "</ol>";
    }).catch(function (e) { console.error(e); out.innerHTML = '<p class="msg warn">The leaderboard couldn’t load. Please try again.</p>'; });
  }

  // ---------- certificate ----------
  function certificatePage(s) {
    setTitle("Certificate: " + s.title);
    if (!isComplete(s)) {
      var k = skillStats(s);
      app.innerHTML = nav() + '<main class="wrap page"><div class="empty"><h2>Finish all ' + s.modules.length + " classes to unlock this certificate</h2><p>You’ve finished " + k.done + " of " + s.modules.length + " classes in " + esc(s.title) + '.</p><a class="btn big" href="#/skill/' + s.id + "/class/" + nextClass(s) + '">Continue learning</a></div></main>' + footer();
      return;
    }
    var k2 = skillStats(s), latest = 0, passed = 0;
    s.modules.forEach(function (_, i) { var c = cls(s.id, i); if (c.doneAt) latest = Math.max(latest, Date.parse(c.doneAt)); if (c.review && c.review.passed) passed++; });
    var date = new Date(latest || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    var name = user ? displayName() : "Zero2Gig Learner";
    var id = "Z2G-" + s.id.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() + "-" + (user ? user.id.slice(0, 8).toUpperCase() : "LOCAL");
    app.innerHTML = nav() + '<main class="wrap page cert-page" style="--c:' + s.color + '">' +
      '<div class="cert-actions"><a class="back" href="#/skill/' + s.id + '">← Back to ' + esc(s.title) + '</a><button class="btn" id="print" type="button">Download / Print</button></div>' +
      '<section class="cert" id="cert"><div class="cert-in">' +
        '<div class="cert-brand"><span class="logo-mark">' + LOGO_SVG + "</span>" + esc(SITE.name) + "</div>" +
        '<p class="cert-k">Certificate of Completion</p><p class="cert-t">This certifies that</p>' +
        '<p class="cert-name">' + esc(name) + "</p>" +
        '<p class="cert-t">has completed all ' + s.modules.length + " classes in</p>" +
        '<p class="cert-skill">' + esc(s.title) + "</p>" +
        '<div class="cert-foot"><div><b>' + date + "</b><span>Date</span></div><div><b>" + k2.pts + " pts</b><span>Score</span></div><div><b>" + passed + " of " + s.modules.length + "</b><span>Projects passed</span></div><div><b>" + id + "</b><span>Certificate ID</span></div></div>" +
      "</div></section>" +
      '<p class="sec-sub" style="text-align:center">Tip: choose “Save as PDF” in the print window to keep a copy, then share it on LinkedIn.</p></main>';
    document.getElementById("print").addEventListener("click", function () { window.print(); });
  }

  // ---------- diagrams ----------
  function diagramHTML(d) {
    var h = '<div class="diagram"><h2>' + esc(d.title) + "</h2>";
    if (d.type === "flow") {
      h += '<div class="d-flow">' + d.nodes.map(function (n, i) { return (i ? '<span class="arr" aria-hidden="true">→</span>' : "") + '<button type="button" class="dnode">' + esc(n) + "</button>"; }).join("") + "</div>";
    } else if (d.type === "stack") {
      h += '<div class="d-stack">' + d.items.map(function (it, i) { return '<button type="button" class="dnode" style="--i:' + i + '"><b>' + esc(it[0]) + "</b><span>" + esc(it[1]) + "</span></button>"; }).join("") + "</div>";
    } else if (d.type === "nested") {
      var inner = "";
      for (var i = d.layers.length - 1; i >= 0; i--) {
        inner = i === d.layers.length - 1
          ? '<div class="dnode core"><b>' + esc(d.layers[i]) + "</b></div>"
          : '<div class="dnode"><b>' + esc(d.layers[i]) + "</b>" + inner + "</div>";
      }
      h += '<div class="d-nested">' + inner + "</div>";
    } else if (d.type === "compare") {
      h += '<div class="d-compare">' + [d.left, d.right].map(function (side) { return '<button type="button" class="dnode"><h3>' + esc(side.h) + "</h3><ul>" + side.items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></button>"; }).join("") + "</div>";
    } else if (d.type === "funnel") {
      var n = d.items.length;
      h += '<div class="d-funnel">' + d.items.map(function (it, i) { return '<button type="button" class="dnode" style="--i:' + i + ";width:" + (100 - i * (50 / Math.max(1, n - 1))) + '%">' + esc(it) + "</button>"; }).join("") + "</div>";
    } else if (d.type === "cycle") {
      var cnt = d.nodes.length, R = 120, cx = 210, cy = 160;
      var svg = '<svg viewBox="0 0 420 320" role="img" aria-label="' + esc(d.title) + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="var(--c)" stroke-width="3" stroke-dasharray="8 8"/>';
      d.nodes.forEach(function (nd, i) {
        var a = -Math.PI / 2 + i * 2 * Math.PI / cnt, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a), w = Math.max(90, nd.length * 9 + 24);
        svg += '<g class="dnode" tabindex="0" role="button"><rect x="' + (x - w / 2) + '" y="' + (y - 20) + '" width="' + w + '" height="40" rx="12"/><text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle">' + esc(nd) + "</text></g>";
      });
      h += '<div class="d-cycle">' + svg + '</svg><p style="text-align:center;color:var(--muted);margin:.4rem 0 0">↻ It keeps going round</p></div>';
    }
    h += '<div class="d-hint"><span>Tap any part to highlight it.</span><button type="button" class="btn soft" data-walk>▶ Walk me through it</button></div></div>';
    return h;
  }
  function bindDiagram(root) {
    var nodes = Array.prototype.slice.call(root.querySelectorAll(".dnode"));
    if (root.querySelector(".d-nested")) nodes = Array.prototype.slice.call(root.querySelectorAll(".d-nested .dnode"));
    function act(n) { nodes.forEach(function (x) { x.classList.remove("active"); }); if (n) n.classList.add("active"); }
    nodes.forEach(function (n) {
      n.addEventListener("click", function (e) { e.stopPropagation(); act(n); });
      n.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(n); } });
    });
    var walk = root.querySelector("[data-walk]");
    if (walk) walk.addEventListener("click", function () {
      var k = 0; walk.disabled = true;
      (function next() { if (k < nodes.length) { act(nodes[k++]); setTimeout(next, 900); } else { act(null); walk.disabled = false; } })();
    });
  }

  // ---------- class player ----------
  function buildSteps(m) {
    var steps = [{ t: "intro" }], L = m.lesson, qs = m.questions.map(function (_, i) { return { t: "q", i: i }; });
    L.forEach(function (p, i) {
      steps.push({ t: "text", i: i });
      if (i === 1) { steps.push({ t: "diagram" }); if (qs.length) steps.push(qs.shift()); }
      else if (i >= 2 && qs.length) steps.push(qs.shift());
    });
    while (qs.length) steps.push(qs.shift());
    steps.push({ t: "recap" }, { t: "finish" });
    return steps;
  }

  function player(s, ci) {
    var m = s.modules[ci];
    setTitle("Class " + (ci + 1) + ": " + m.title);
    var steps = buildSteps(m);
    var c = cls(s.id, ci);
    try { localStorage.setItem("z2g-last", JSON.stringify({ sid: s.id, ci: ci })); } catch (e) {}
    if (sb && user) sb.rpc("touch_activity").then(function (r) { if (r.error) console.error(r.error); });
    if (c.step >= steps.length) c.step = steps.length - 1;

    app.innerHTML =
      '<div class="player" style="--c:' + s.color + '">' +
        '<div class="p-top"><div class="p-top-in">' +
          '<a class="x" href="#/skill/' + s.id + '" aria-label="Leave class">✕</a>' +
          '<div class="p-bar" role="progressbar" aria-label="Class progress"><i id="bar"></i></div>' +
          '<div class="score"><span class="streak" id="streak" title="Answer streak"></span><span class="pts-pill" id="score"><span class="coin"></span><span id="score-n">0</span></span></div>' +
        "</div></div>" +
        '<div class="p-body"><div class="stage" id="stage"></div></div>' +
        '<div class="p-foot"><div class="p-foot-in"><button class="btn soft" id="prev" type="button">Back</button><button class="btn big" id="next" type="button">Continue</button></div></div>' +
      "</div>";

    var stage = document.getElementById("stage"), nextBtn = document.getElementById("next"), prevBtn = document.getElementById("prev");
    var shownScore = totalPts(c);

    function updateTop() {
      document.getElementById("bar").style.width = Math.round(c.step / (steps.length - 1) * 100) + "%";
      var target = totalPts(c), el = document.getElementById("score-n");
      var start = shownScore, t0 = performance.now();
      (function tick(now) {
        var k = Math.min(1, (now - t0) / 500); el.textContent = Math.round(start + (target - start) * k);
        if (k < 1) requestAnimationFrame(tick); else shownScore = target;
      })(t0);
      var sEl = document.getElementById("streak"); var mul = multiplier(c.streak);
      sEl.dataset.on = c.streak >= 2 ? "1" : "0";
      sEl.textContent = "🔥 " + c.streak + (mul > 1 ? " ×" + mul : "");
    }

    function persist() { saveCls(s.id, ci, c); }

    function render() {
      var st = steps[c.step];
      prevBtn.style.visibility = c.step === 0 ? "hidden" : "visible";
      document.querySelector(".p-foot").style.display = st.t === "finish" ? "none" : "";
      nextBtn.style.display = st.t === "finish" ? "none" : "";
      nextBtn.disabled = false;
      nextBtn.textContent = st.t === "intro" ? "Start class" : "Continue";
      var h = "";
      if (st.t === "intro") {
        h = '<p class="kicker">' + ico(s, 26) + " " + esc(s.title) + " · Class " + (ci + 1) + " of " + s.modules.length + "</p>" +
          "<h1>" + esc(m.title) + '</h1><p class="lead">' + esc(m.summary) + "</p>" +
          '<div class="intro-card"><strong>By the end of this class you’ll know:</strong><ul>' + m.keyPoints.map(function (k) { return "<li>" + esc(k) + "</li>"; }).join("") + "</ul></div>" +
          '<div class="scoring"><div><b>+' + FIRST_TRY + "</b>first try</div><div><b>×2</b>streak bonus</div><div><b>+" + PASS_BONUS + "</b>project passed</div></div>";
      } else if (st.t === "text") {
        h = '<p class="kicker">📖 Lesson · part ' + (st.i + 1) + " of " + m.lesson.length + '</p><p class="lead">' + esc(m.lesson[st.i]) + "</p>";
      } else if (st.t === "diagram") {
        h = '<p class="kicker">🧭 See it</p>' + diagramHTML(m.diagram);
      } else if (st.t === "q") {
        h = questionHTML(st.i);
      } else if (st.t === "recap") {
        h = '<p class="kicker">✅ Recap</p><h1>Remember this</h1><div class="recap">' + m.keyPoints.map(function (k) { return '<div><span class="tick">✓</span><span>' + esc(k) + "</span></div>"; }).join("") + "</div>";
      } else if (st.t === "finish") {
        if (!c.done) { c.done = true; c.doneAt = new Date().toISOString(); persist(); }
        h = finishHTML();
      }
      stage.innerHTML = '<div class="step">' + h + "</div>";
      if (st.t === "diagram") bindDiagram(stage);
      if (st.t === "q") bindQuestion(st.i);
      if (st.t === "finish") bindFinish();
      updateTop();
      ZCTX = { skill: s.title, klass: "Class " + (ci + 1) + ": " + m.title, text: (st.t === "finish" ? "Project: " + m.assignment.task : stage.innerText).slice(0, 1500) };
      window.scrollTo(0, 0);
    }

    function questionHTML(qi) {
      var q = m.questions[qi], a = c.answers[qi];
      var h = '<p class="kicker">❓ Question ' + (qi + 1) + " of " + m.questions.length + '</p><h2 class="q-prompt">' + esc(q.q) + '</h2><div class="opts">' +
        q.options.map(function (o, k) {
          var cl = "";
          if (a) { if (k === q.answer && (a.correct || a.tries >= 2)) cl = " right"; else if (a.picked && a.picked.indexOf(k) !== -1) cl = " wrong"; }
          var locked = a && (a.correct || a.tries >= 2);
          return '<button type="button" class="opt' + cl + '" data-k="' + k + '"' + (locked || (a && a.picked && a.picked.indexOf(k) !== -1) ? " disabled" : "") + '><span class="key">' + "ABCD"[k] + "</span>" + esc(o) + "</button>";
        }).join("") + '</div><div id="fb" aria-live="polite">' + (a ? feedbackHTML(q, a) : "") + "</div>";
      return h;
    }
    function feedbackHTML(q, a) {
      if (a.correct) return '<div class="feedback good"><b>' + (a.tries === 1 ? "Correct! +" + a.pts + " pts" : "Got it on the second try. +" + a.pts + " pts") + "</b>" + esc(q.explain) + "</div>";
      if (a.tries >= 2) return '<div class="feedback bad"><b>The answer is ' + "ABCD"[q.answer] + ".</b>" + esc(q.explain) + "</div>";
      return '<div class="feedback bad"><b>Not quite. Try once more for ' + SECOND_TRY + " pts.</b>Think about what the lesson said.</div>";
    }
    function bindQuestion(qi) {
      var q = m.questions[qi];
      var a = c.answers[qi];
      nextBtn.disabled = !(a && (a.correct || a.tries >= 2));
      stage.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () {
          var k = +b.dataset.k;
          a = c.answers[qi] || { tries: 0, picked: [], correct: false, pts: 0 };
          if (a.correct || a.tries >= 2) return;
          a.tries++; a.picked.push(k);
          if (k === q.answer) {
            a.correct = true;
            c.streak++; c.best = Math.max(c.best || 0, c.streak);
            a.pts = Math.round((a.tries === 1 ? FIRST_TRY : SECOND_TRY) * multiplier(c.streak));
            c.points += a.pts;
            popAt(b, "+" + a.pts);
            if (c.streak === 3 || c.streak === 5) toast("🔥 " + c.streak + " in a row! Points ×" + multiplier(c.streak));
          } else {
            c.streak = 0;
          }
          c.answers[qi] = a; persist();
          var fresh = document.createElement("div"); fresh.innerHTML = questionHTML(qi);
          stage.querySelector(".step").innerHTML = fresh.innerHTML;
          bindQuestion(qi); updateTop();
          if (a.correct || a.tries >= 2) nextBtn.focus();
        });
      });
    }

    function finishHTML() {
      var total = m.questions.length, correct = 0, firstTry = 0;
      for (var k = 0; k < total; k++) { var a = c.answers[k]; if (a && a.correct) { correct++; if (a.tries === 1) firstTry++; } }
      var acc = total ? Math.round(correct / total * 100) : 0;
      var stars = firstTry === total ? 3 : correct === total ? 2 : correct > 0 ? 1 : 0;
      var a = m.assignment;
      var last = ci === s.modules.length - 1;
      return '<div class="result-hero"><div class="stars">' + [0, 1, 2].map(function (x) { return '<span class="' + (x < stars ? "" : "off") + '">⭐</span>'; }).join("") + "</div>" +
        '<div class="big-score">' + totalPts(c) + "</div><div>class points</div>" +
        '<div class="result-grid"><div><b>' + correct + "/" + total + "</b><span>correct</span></div><div><b>" + acc + "%</b><span>accuracy</span></div><div><b>" + (c.best || 0) + "</b><span>best streak</span></div></div></div>" +
        '<section class="task"><span class="bonus">🪙 +' + PASS_BONUS + " pts when it passes</span><h2>Your project</h2><p>" + esc(a.task) + "</p>" +
        "<h3>What to submit</h3><ul>" + a.deliverables.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
        "<h3>What the AI reviewer checks</h3><ul>" + a.criteria.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
        '<form class="form" id="form" novalidate>' +
          '<label>Link to your work <span class="hint">GitHub, live site, Google Drive, Canva or Notion link</span><input type="url" name="link" placeholder="https://"></label>' +
          '<label class="drop" id="drop"><input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.md,.html,.css,.js,.ts,.py,.sql,.json,.csv"><span id="drop-t">📎 Tap to upload a screenshot, PDF or code file (max 3 MB)</span></label>' +
          '<label>Explain what you built <span class="hint">What you made, how you made it, and what you got stuck on</span><textarea name="notes"></textarea></label>' +
          '<div><button class="btn big" type="submit">Send for AI review</button></div>' +
        '</form><div id="out" aria-live="polite">' + (c.review ? reviewHTML(c.review) : "") + "</div></section>" +
        '<div style="display:flex;gap:.8rem;flex-wrap:wrap;margin-top:1.4rem">' +
          (isComplete(s) ? '<a class="btn big" href="#/certificate/' + s.id + '">🎓 Get your certificate</a>' : "") + (last ? '<a class="btn soft big" href="#/skill/' + s.id + '">Back to all classes</a>' : '<a class="btn big" href="#/skill/' + s.id + "/class/" + (ci + 1) + '">Next class →</a><a class="btn soft big" href="#/skill/' + s.id + '">All classes</a>') +
        "</div>";
    }
    function reviewHTML(r) {
      return '<div class="review' + (r.passed ? " pass" : "") + '"><p class="verdict"><span>' + (r.passed ? "✅ Passed! +" + PASS_BONUS + " pts" : "🔁 Not yet. Improve it and resubmit.") + "</span><span>" + r.score + "/100</span></p><p>" + esc(r.feedback) + "</p>" +
        (r.strengths && r.strengths.length ? "<h4>What you did well</h4><ul>" + r.strengths.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
        (r.improvements && r.improvements.length ? "<h4>What to improve</h4><ul>" + r.improvements.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
    }
    function bindFinish() {
      var form = document.getElementById("form"), out = document.getElementById("out"), fileIn = form.file, dropT = document.getElementById("drop-t"), drop = document.getElementById("drop");
      fileIn.addEventListener("change", function () { dropT.textContent = fileIn.files[0] ? "📎 " + fileIn.files[0].name : "📎 Tap to upload a screenshot, PDF or code file (max 3 MB)"; });
      ["dragover", "dragenter"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
      ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove("over"); }); });
      drop.addEventListener("drop", function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) { fileIn.files = e.dataTransfer.files; fileIn.dispatchEvent(new Event("change")); } });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var link = form.link.value.trim(), notes = form.notes.value.trim(), file = fileIn.files[0];
        if (!link && !file && notes.length < 40) { out.innerHTML = '<p class="msg warn">Add a link, upload a file, or describe what you built in a few sentences.</p>'; return; }
        if (link && !/^https?:\/\//i.test(link)) { out.innerHTML = '<p class="msg warn">Links must start with http:// or https://</p>'; return; }
        var btn = form.querySelector("button[type=submit]");
        (file ? readFile(file) : Promise.resolve(null)).then(function (fp) {
          btn.disabled = true; btn.innerHTML = '<span class="loader"></span> Reviewing…';
          out.innerHTML = '<p class="msg">The AI reviewer is checking your work. This takes about 15 to 30 seconds.</p>';
          return fetch(SITE.apiPath, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skill: s.title, module: m.title, task: m.assignment.task, deliverables: m.assignment.deliverables, criteria: m.assignment.criteria, link: link, notes: notes, file: fp }) })
            .then(function (res) { return res.json().catch(function () { return { error: "The review service sent back something unexpected (status " + res.status + ")." }; }).then(function (d) { if (!res.ok || d.error) throw new Error(d.error || "Review failed (" + res.status + ")."); return d; }); })
            .then(function (d) {
              var wasPassed = c.review && c.review.passed;
              c.review = { passed: !!d.passed || !!wasPassed, score: Math.round(+d.score || 0), feedback: d.feedback || "", strengths: d.strengths || [], improvements: d.improvements || [] };
              if (!d.passed && wasPassed) c.review.feedback = "Your earlier submission already passed, so your bonus is safe. " + c.review.feedback;
              persist(); out.innerHTML = reviewHTML(c.review); updateTop();
              if (d.passed && !wasPassed) toast("🎉 Project passed! +" + PASS_BONUS + " pts");
            });
        }).catch(function (err) {
          out.innerHTML = '<p class="msg warn">' + esc(err.message) + (location.protocol === "file:" ? " The reviewer only works once the site is online." : "") + "</p>";
        }).then(function () { btn.disabled = false; btn.textContent = "Send for AI review"; });
      });
    }

    nextBtn.addEventListener("click", function () { if (c.step < steps.length - 1) { c.step++; persist(); render(); } });
    prevBtn.addEventListener("click", function () { if (c.step > 0) { c.step--; persist(); render(); } });
    document.onkeydown = function (e) {
      if (!document.getElementById("next")) { document.onkeydown = null; return; }
      if (e.target.closest && e.target.closest("input,textarea")) return;
      var st = steps[c.step];
      if (st.t === "q" && /^[1-4a-d]$/i.test(e.key)) {
        var idx = isNaN(+e.key) ? "abcd".indexOf(e.key.toLowerCase()) : +e.key - 1;
        var b = stage.querySelector('.opt[data-k="' + idx + '"]'); if (b && !b.disabled) b.click();
      } else if (e.key === "Enter" && !nextBtn.disabled && nextBtn.style.display !== "none" && !(e.target.closest && e.target.closest("button,a"))) {
        nextBtn.click();
      }
    };
    render();
  }

  // ---------- file reading ----------
  function readFile(file) {
    var isImg = /^image\/(png|jpeg|gif|webp)$/.test(file.type), isPdf = file.type === "application/pdf";
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error("That file couldn’t be read. Try another one.")); };
      if (isImg || isPdf) {
        if (file.size > 3 * 1024 * 1024) return reject(new Error("That file is over 3 MB. Upload a smaller screenshot, or share a link instead."));
        fr.onload = function () { resolve({ name: file.name, type: file.type, kind: isImg ? "image" : "pdf", data: String(fr.result).split(",")[1] }); };
        fr.readAsDataURL(file);
      } else if (file.size <= 400 * 1024) {
        fr.onload = function () { var t = String(fr.result); if (t.indexOf("\u0000") !== -1) reject(new Error("That file type can’t be read. Upload an image, PDF or code file, or share a link.")); else resolve({ name: file.name, type: file.type || "text/plain", kind: "text", data: t }); };
        fr.readAsText(file);
      } else reject(new Error("Code and text files must be under 400 KB. For bigger projects, share a GitHub link."));
    });
  }

  // ---------- daily streak ----------
  function loadDaily(last) {
    var box = document.getElementById("daily");
    if (!box || !sb || !user) return;
    sb.rpc("my_streak").then(function (r) {
      if (r.error || !r.data || !document.getElementById("daily")) return;
      var d = r.data, n = d.streak || 0, href = "#skills", ls = last && find(last.sid);
      if (ls && ls.modules[last.ci]) href = "#/skill/" + ls.id + "/class/" + last.ci;
      var title, sub, cta = "";
      if (d.learned_today) { title = "🔥 " + n + "-day streak"; sub = "You’ve learned today. Come back tomorrow to keep it going."; }
      else if (n > 0) { title = "🔥 Your " + n + "-day streak ends today"; sub = "Take one class before midnight to keep it alive."; cta = "Learn now"; }
      else { title = "Start your daily streak"; sub = "Learn for 15 minutes a day. One class today starts your streak."; cta = "Take today’s class"; }
      box.innerHTML = '<section class="daily' + (d.learned_today ? " ok" : "") + '"><div><b>' + title + "</b><span>" + sub + "</span></div>" + (cta ? '<a class="btn" href="' + href + '"' + (href === "#skills" ? ' data-daily-scroll' : "") + ">" + cta + "</a>" : "") + "</section>";
      var a = box.querySelector("[data-daily-scroll]");
      if (a) a.addEventListener("click", function (e) { e.preventDefault(); document.getElementById("skills").scrollIntoView({ behavior: "smooth" }); });
    });
  }

  // ---------- admin dashboard ----------
  function fmtDay(d) { return d ? new Date(d + (String(d).length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Never"; }
  function adminPage() {
    setTitle("Admin");
    app.innerHTML = nav() + '<main class="wrap page"><h1>Admin dashboard</h1><p class="sec-sub">Who is joining and who is learning. Days use Lagos time.</p><div id="adm"><p class="msg"><span class="loader"></span> Loading…</p></div></main>';
    var out = document.getElementById("adm");
    sb.rpc("admin_overview").then(function (r) {
      if (r.error) { out.innerHTML = '<div class="empty"><h2>This page is for admins only</h2><p>You’re signed in as ' + esc(user.email) + '.</p><a class="btn big" href="#/">Back to the site</a></div>'; return; }
      var d = r.data, list = d.list || [], daily = d.daily || [];
      var max = Math.max.apply(null, daily.map(function (x) { return Math.max(x.signups, x.active); }).concat([1]));
      var todayMs = Date.parse(d.today + "T12:00:00");
      var cold = list.filter(function (x) { return !x.last_day || (todayMs - Date.parse(x.last_day + "T12:00:00")) / 864e5 >= 2; });
      var subject = "Your Zero2Gig class is waiting", body = "Hi,\n\nYou haven’t taken a class on Zero2Gig for a few days. It only takes 15 minutes to keep your streak going.\n\nContinue here: " + location.origin + "\n\nSee you in class!";
      function tile(v, l) { return '<div class="stat"><b>' + v + "</b><span>" + l + "</span></div>"; }
      function rowsHTML(arr) {
        return arr.map(function (x) {
          return "<tr><td><b>" + esc(x.name || "Learner") + "</b><small>" + esc(x.email || "") + "</small></td><td>" + x.points + "</td><td>" + x.classes + "</td><td>" + x.days + "</td><td>" + fmtDay(String(x.joined).slice(0, 10)) + "</td><td>" + fmtDay(x.last_day) + "</td></tr>";
        }).join("") || '<tr><td colspan="6">No learners match.</td></tr>';
      }
      out.innerHTML =
        '<section class="stats adm-stats">' + tile(d.learners, "Total learners") + tile(d.new_today, "Joined today") + tile(d.active_today, "Learning today") + tile(d.new_7d, "Joined this week") + tile(d.active_7d, "Active this week") + tile(d.classes_done, "Classes finished") + "</section>" +
        '<section class="panel"><div class="panel-h"><h2>Last 14 days</h2><div class="legend"><span><i class="l1"></i>Joined</span><span><i class="l2"></i>Learning</span></div></div>' +
          '<div class="bars" role="img" aria-label="Daily sign-ups and active learners for the last 14 days">' + daily.map(function (x) {
            return '<div class="bar-col" title="' + fmtDay(x.day) + ": " + x.signups + " joined, " + x.active + ' learning"><div class="bar-pair"><i class="l1" style="height:' + (x.signups / max * 100) + '%"></i><i class="l2" style="height:' + (x.active / max * 100) + '%"></i></div><span>' + new Date(x.day + "T12:00:00").getDate() + "</span></div>";
          }).join("") + "</div>" +
          '<details class="tbl-alt"><summary>Show the numbers</summary><table class="tbl"><thead><tr><th>Day</th><th>Joined</th><th>Learning</th></tr></thead><tbody>' + daily.slice().reverse().map(function (x) { return "<tr><td>" + fmtDay(x.day) + "</td><td>" + x.signups + "</td><td>" + x.active + "</td></tr>"; }).join("") + "</tbody></table></details></section>" +
        '<section class="panel compose"><div class="panel-h"><div><h2>Email your learners</h2><p class="sec-sub">One message, sent to everyone at once. Each email starts with the learner’s first name.</p></div><span class="auto-pill">Automatic reminders: daily at 6 pm</span></div>' +
          '<form class="form" id="mail-form" novalidate>' +
            '<label>Send to<select name="audience"><option value="all">All learners</option><option value="inactive">Learners who haven’t learned in 2+ days</option></select></label>' +
            '<label>Subject<input name="subject" maxlength="150" placeholder="New class just dropped"></label>' +
            '<label>Message <span class="hint">Don’t type “Hi name”. That’s added for you, along with a button to open the site.</span><textarea name="message" maxlength="5000" placeholder="Write your message here…"></textarea></label>' +
            '<div><button class="btn big" type="submit">Send email</button></div>' +
          '</form><div id="mail-out" aria-live="polite"></div></section>' +
        '<section class="panel"><div class="panel-h"><div><h2>Needs a reminder (' + cold.length + ')</h2><p class="sec-sub">Learners who haven’t taken a class in 2 or more days.</p></div>' +
          (cold.length ? '<div class="panel-a"><button class="btn soft" id="copy-cold" type="button">Copy emails</button><a class="btn" id="mail-cold" href="#">Email them</a></div>' : "") + "</div>" +
          (cold.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Learner</th><th>Points</th><th>Classes</th><th>Days learned</th><th>Joined</th><th>Last learned</th></tr></thead><tbody>' + rowsHTML(cold.slice(0, 50)) + "</tbody></table></div>" + (cold.length > 50 ? '<p class="sec-sub">Showing the first 50. “Copy emails” copies all ' + cold.length + ".</p>" : "") : '<p class="msg">Everyone has learned in the last 2 days. 🎉</p>') + "</section>" +
        '<section class="panel"><div class="panel-h"><h2>All learners (' + list.length + ')</h2><div class="panel-a"><label class="search">' + svg("search", 18) + '<input type="search" id="adm-q" placeholder="Search name or email" aria-label="Search learners"></label><button class="btn soft" id="csv" type="button">Export CSV</button></div></div>' +
          '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Learner</th><th>Points</th><th>Classes</th><th>Days learned</th><th>Joined</th><th>Last learned</th></tr></thead><tbody id="adm-rows">' + rowsHTML(list) + "</tbody></table></div></section>";

      var cc = document.getElementById("copy-cold");
      if (cc) {
        cc.addEventListener("click", function () {
          var txt = cold.map(function (x) { return x.email; }).filter(Boolean).join(", ");
          (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast("Emails copied"); }, function () { window.prompt("Copy these emails:", txt); });
        });
        document.getElementById("mail-cold").href = "mailto:?bcc=" + encodeURIComponent(cold.slice(0, 40).map(function (x) { return x.email; }).filter(Boolean).join(",")) + "&subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      }
      var mf = document.getElementById("mail-form"), mo = document.getElementById("mail-out");
      mf.addEventListener("submit", function (e) {
        e.preventDefault();
        var payload = { audience: mf.audience.value, subject: mf.subject.value.trim(), message: mf.message.value.trim() };
        if (!payload.subject || !payload.message) { mo.innerHTML = '<p class="msg warn">Add a subject and a message first.</p>'; return; }
        var btn = mf.querySelector("button[type=submit]");
        function call(extra) {
          return sb.auth.getSession().then(function (r) {
            return fetch("/api/broadcast", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (r.data.session && r.data.session.access_token) }, body: JSON.stringify(Object.assign({}, payload, extra)) });
          }).then(function (res) { return res.json().catch(function () { return { error: "The email service sent back something unexpected." }; }).then(function (j) { if (!res.ok || j.error) throw new Error(j.error || "Sending failed."); return j; }); });
        }
        btn.disabled = true; btn.innerHTML = '<span class="loader"></span> Checking…';
        call({ preview: true }).then(function (pv) {
          if (!pv.count) { mo.innerHTML = '<p class="msg">Nobody matches that group right now, so nothing was sent.</p>'; return; }
          if (!pv.ready) { mo.innerHTML = '<p class="msg warn">Email isn’t connected yet. Add BREVO_API_KEY and SENDER_EMAIL in Vercel, then redeploy.</p>'; return; }
          if (!window.confirm("Send “" + payload.subject + "” to " + pv.count + " learner" + (pv.count === 1 ? "" : "s") + "?")) return;
          btn.innerHTML = '<span class="loader"></span> Sending…';
          return call({}).then(function (j) {
            mo.innerHTML = '<p class="msg">✅ Sent to ' + j.sent + " learner" + (j.sent === 1 ? "" : "s") + (j.failed ? ". " + j.failed + " could not be delivered." : ".") + "</p>";
            if (!j.failed) { mf.subject.value = ""; mf.message.value = ""; }
          });
        }).catch(function (err) { mo.innerHTML = '<p class="msg warn">' + esc(err.message) + "</p>"; })
          .then(function () { btn.disabled = false; btn.textContent = "Send email"; });
      });
      document.getElementById("adm-q").addEventListener("input", function (e) {
        var v = e.target.value.trim().toLowerCase();
        document.getElementById("adm-rows").innerHTML = rowsHTML(list.filter(function (x) { return ((x.name || "") + " " + (x.email || "")).toLowerCase().indexOf(v) !== -1; }));
      });
      document.getElementById("csv").addEventListener("click", function () {
        var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
        var csv = "Name,Email,Points,Classes,Days learned,Joined,Last learned\n" + list.map(function (x) { return [q(x.name), q(x.email), x.points, x.classes, x.days, q(String(x.joined).slice(0, 10)), q(x.last_day || "")].join(","); }).join("\n");
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "zero2gig-learners-" + d.today + ".csv"; a.click();
      });
    });
  }

  // ---------- Zee, the AI tutor ----------
  var ZCTX = {}, zMsgs = [], zBusy = false;
  var ZEE_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15z"/></svg>';
  function zeeInit() {
    var w = document.createElement("div");
    w.innerHTML = '<button class="zee-fab" id="zee-fab" type="button" aria-haspopup="dialog">' + ZEE_ICON + "<span>Ask Zee</span></button>" +
      '<section class="zee" id="zee" role="dialog" aria-label="Zee, your AI tutor" hidden>' +
        '<header><span class="zee-av">' + ZEE_ICON + '</span><div><b>Zee</b><small>Your AI tutor</small></div><button type="button" id="zee-x" aria-label="Close chat">✕</button></header>' +
        '<div class="zee-log" id="zee-log" aria-live="polite"></div>' +
        '<div class="zee-sug" id="zee-sug"></div>' +
        '<form id="zee-form"><textarea id="zee-in" rows="1" placeholder="Ask Zee anything…" aria-label="Message Zee" maxlength="1500"></textarea><button class="btn" type="submit" aria-label="Send">➤</button></form>' +
        '<p class="zee-note">Zee is an AI and can make mistakes.</p>' +
      "</section>";
    while (w.firstChild) document.body.appendChild(w.firstChild);
    var panel = document.getElementById("zee"), fab = document.getElementById("zee-fab"), input = document.getElementById("zee-in");
    fab.addEventListener("click", function () { panel.hidden = false; fab.hidden = true; zeeRender(); input.focus(); });
    document.getElementById("zee-x").addEventListener("click", function () { panel.hidden = true; fab.hidden = false; fab.focus(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) document.getElementById("zee-x").click(); });
    document.getElementById("zee-form").addEventListener("submit", function (e) { e.preventDefault(); zeeSend(input.value); });
    input.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); zeeSend(input.value); } });
    input.addEventListener("input", function () { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; });
  }
  function zeeRender() {
    var log = document.getElementById("zee-log"), sug = document.getElementById("zee-sug");
    var hello = "Hi" + (user ? " " + esc(displayName().split(" ")[0]) : "") + "! I’m Zee, your AI tutor. " + (ZCTX.klass ? "I can see you’re on “" + esc(ZCTX.klass) + "”. Ask me anything about it." : "Ask me anything about the skills here, or how to get your first gig.");
    log.innerHTML = '<div class="zb bot">' + hello + "</div>" + zMsgs.map(function (m) {
      return '<div class="zb ' + (m.role === "user" ? "me" : "bot") + (m.err ? " err" : "") + '">' + esc(m.content) + "</div>";
    }).join("") + (zBusy ? '<div class="zb bot typing"><i></i><i></i><i></i></div>' : "");
    log.scrollTop = log.scrollHeight;
    var ideas = ZCTX.klass ? ["Explain this more simply", "Give me a real-life example", "Quiz me on this class"] : ZCTX.skill ? ["Is this skill right for me?", "How do I earn with this skill?", "What should I learn first?"] : ["Which skill should I start with?", "How do I get my first gig?", "How do I stay consistent?"];
    sug.innerHTML = zMsgs.length || zBusy ? "" : ideas.map(function (t) { return '<button type="button">' + t + "</button>"; }).join("");
    sug.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { zeeSend(b.textContent); }); });
  }
  function zeeSend(text) {
    text = (text || "").trim();
    if (!text || zBusy) return;
    var input = document.getElementById("zee-in"); input.value = ""; input.style.height = "auto";
    if (!sb || !user) {
      zMsgs.push({ role: "user", content: text }, { role: "assistant", content: "Please log in with Google first, then ask me again. It’s free.", err: true, local: true });
      zeeRender(); return;
    }
    zMsgs.push({ role: "user", content: text }); zBusy = true; zeeRender();
    sb.auth.getSession().then(function (r) {
      var token = r.data.session && r.data.session.access_token;
      return fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ messages: zMsgs.filter(function (m) { return !m.local && !m.err; }).slice(-12).map(function (m) { return { role: m.role, content: m.content }; }), context: ZCTX }) });
    }).then(function (res) {
      return res.json().catch(function () { return { error: "Zee couldn’t answer just now. Please try again." }; }).then(function (d) { if (!res.ok || d.error) throw new Error(d.error || "Zee couldn’t answer just now."); return d; });
    }).then(function (d) { zMsgs.push({ role: "assistant", content: d.reply }); })
      .catch(function (err) { zMsgs.push({ role: "assistant", content: err.message || "Zee couldn’t answer just now. Please try again.", err: true }); })
      .then(function () { zBusy = false; zeeRender(); });
  }

  // ---------- first-time welcome ----------
  // Shown once, right after a learner's first sign-in: greets them, explains how it works,
  // asks what they want to do and takes them straight into their first class.
  function hasAnyProgress() {
    var d = load();
    return Object.keys(d).some(function (k) { var c = d[k]; return c && typeof c === "object" && ((c.step || 0) > 0 || c.done); });
  }
  function closeWelcome(el) {
    try { localStorage.setItem("z2g-welcomed:" + user.id, "1"); } catch (e) {}
    if (el && el.parentNode) el.parentNode.removeChild(el);
    document.documentElement.classList.remove("no-scroll");
  }
  function maybeWelcome() {
    if (!user || document.getElementById("welcome")) return;
    var home = !location.hash || location.hash === "#/" || location.hash === "#";
    if (!home) return;                                   // they came for a specific class: don't interrupt
    try { if (localStorage.getItem("z2g-welcomed:" + user.id)) return; } catch (e) { return; }
    if (hasAnyProgress()) { try { localStorage.setItem("z2g-welcomed:" + user.id, "1"); } catch (e) {} return; }
    var first = esc(displayName().split(" ")[0] || "there");
    var el = document.createElement("div");
    el.id = "welcome"; el.className = "welcome";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "welcome-h");
    el.innerHTML =
      '<div class="welcome-card">' +
        '<div class="welcome-step" data-step="1">' +
          '<p class="eyebrow">You’re in 🎉</p>' +
          '<h2 id="welcome-h">Welcome to ' + esc(SITE.name) + ", " + first + "</h2>" +
          '<p class="welcome-lead">Here’s how you go from zero to your first gig:</p>' +
          '<ol class="welcome-how">' +
            "<li><b>Pick one skill</b><span>Start with one. You can add more later.</span></li>" +
            "<li><b>Take short classes</b><span>About 15 minutes each, with questions as you go.</span></li>" +
            "<li><b>Build a real project</b><span>Our AI reviews it and tells you how to improve.</span></li>" +
          "</ol>" +
          '<button class="btn big" type="button" id="welcome-next">Let’s pick your skill</button>' +
          '<button class="welcome-skip" type="button" data-close>I’ll look around first</button>' +
        "</div>" +
        '<div class="welcome-step" data-step="2" hidden>' +
          '<p class="eyebrow">One quick question</p>' +
          '<h2>What sounds most like you?</h2>' +
          '<p class="welcome-lead">Tap one. There’s no wrong answer, and you can switch any time.</p>' +
          '<div class="chips2 welcome-chips">' + MATCH.map(function (m, k) { return '<button type="button" data-wmatch="' + k + '" aria-pressed="false">' + esc(m[0]) + "</button>"; }).join("") + "</div>" +
          '<div id="welcome-out" aria-live="polite"></div>' +
          '<button class="welcome-skip" type="button" data-close>Show me all the skills</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(el);
    document.documentElement.classList.add("no-scroll");
    el.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", function () { closeWelcome(el); }); });
    el.addEventListener("keydown", function (e) { if (e.key === "Escape") closeWelcome(el); });
    el.querySelector("#welcome-next").addEventListener("click", function () {
      el.querySelector('[data-step="1"]').hidden = true; el.querySelector('[data-step="2"]').hidden = false;
      var c = el.querySelector("[data-wmatch]"); if (c) c.focus();
    });
    el.querySelectorAll("[data-wmatch]").forEach(function (b) {
      b.addEventListener("click", function () {
        el.querySelectorAll("[data-wmatch]").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        var sk = find(MATCH[+b.dataset.wmatch][1]);
        var out = el.querySelector("#welcome-out");
        out.innerHTML =
          '<div class="welcome-pick" style="--c:' + sk.color + '"><span class="cont-ico">' + ico(sk, 26) + "</span><div><small>We’d start you with</small><b>" + esc(sk.title) + "</b><span>" + sk.modules.length + " classes · free</span></div></div>" +
          '<a class="btn big" id="welcome-go" href="#/skill/' + sk.id + '/class/0">Start my first class</a>';
        out.querySelector("#welcome-go").addEventListener("click", function () { closeWelcome(el); });
        out.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    });
    var nx = el.querySelector("#welcome-next"); if (nx) nx.focus();
  }

  // ---------- auth pages ----------
  function authShell(inner) {
    return nav() + '<main class="wrap"><section class="auth">' + inner + "</section></main>";
  }
  function goNext() {
    var n = "#/"; try { n = sessionStorage.getItem("skillroute-next") || "#/"; sessionStorage.removeItem("skillroute-next"); } catch (e) {}
    location.hash = n;
  }
  var GOOGLE_ICON = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  var LOGO_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>';
  function themeBtn() {
    var dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    return '<button class="theme-btn" id="theme" type="button" aria-label="Switch to ' + (dark ? "light" : "dark") + ' mode">' + (dark ? "☀️" : "🌙") + "</button>";
  }
  function bindTheme() {
    var b = document.getElementById("theme"); if (!b || b.dataset.bound) return;
    b.dataset.bound = "1";
    b.addEventListener("click", function () {
      var dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
      var next = dark ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("z2g-theme", next); } catch (e) {}
      b.outerHTML = themeBtn(); bindTheme();
    });
  }
  function loginPage() {
    setTitle("Log in");
    if (user) { goNext(); return; }
    app.innerHTML =
      '<div class="login-page">' + themeBtn() +
        '<div class="login-brand"><span class="login-mark">' + LOGO_SVG + "</span><span>" + esc(SITE.name) + "</span></div>" +
        '<p class="login-tag">From zero to your first gig, one class at a time</p>' +
        '<section class="login-card">' +
          "<h1>Welcome to " + esc(SITE.name) + "</h1>" +
          '<p class="sub">Sign in with Google to start learning and save your progress</p>' +
          '<button class="btn-google" id="google" type="button">' + GOOGLE_ICON + "<span>Continue with Google</span></button>" +
          '<div id="auth-out" aria-live="polite"></div>' +
          '<div class="divider"><span>What you get</span></div>' +
          '<ul class="perks">' +
            '<li><span class="perk-i">📚</span><div><b>8 digital skills, 32 classes</b><small>Short lessons, diagrams and questions</small></div></li>' +
            '<li><span class="perk-i">🔥</span><div><b>Points and streaks</b><small>Your score follows you on any device</small></div></li>' +
            '<li><span class="perk-i">🤖</span><div><b>AI-reviewed projects</b><small>Build real work and get instant feedback</small></div></li>' +
          "</ul>" +
          '<p class="fine">By continuing, you agree to our <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a>.</p>' +
        "</section>" +
        '<a class="login-back" href="#/">← Browse the skills first</a>' +
      "</div>";
    bindTheme();
    var btn = document.getElementById("google"), out = document.getElementById("auth-out");
    btn.addEventListener("click", function () {
      if (!sb) { out.innerHTML = '<p class="msg warn">Sign-in isn’t available right now. Please try again shortly.</p>'; return; }
      btn.disabled = true; btn.querySelector("span").textContent = "Opening Google…";
      try { localStorage.setItem("skillroute-next", sessionStorage.getItem("skillroute-next") || "#/"); } catch (e) {}
      sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } }).then(function (r) {
        if (r.error) throw r.error;
      }).catch(function (err) {
        out.innerHTML = '<p class="msg warn">' + esc(err.message || "Google sign-in couldn’t start. Please try again.") + "</p>";
        btn.disabled = false; btn.querySelector("span").textContent = "Continue with Google";
      });
    });
  }
  function accountPage() {
    setTitle("My account");
    var st = allStats();
    app.innerHTML = authShell('<div class="auth-card"><div class="avatar big">' + avatarHTML("av-img") + "</div><h1>" + esc(displayName()) + '</h1><p class="sub">' + esc(user.email) + "</p>" +
      '<div class="result-grid"><div><b>' + st.pts + "</b><span>points</span></div><div><b>" + st.done + "</b><span>classes done</span></div><div><b>" + st.best + "</b><span>best streak</span></div></div>" +
      '<p class="sub" style="margin-top:1.2rem">Your progress is saved to your account, so you can continue on any device.</p>' +
      '<label class="switch"><input type="checkbox" id="rem" checked disabled><span>Email me reminders and updates</span></label>' +
      '<div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-top:1rem"><a class="btn" href="#/">Keep learning</a><a class="btn soft" id="admin-link" href="#/admin" hidden>Admin dashboard</a><button class="btn soft" id="logout" type="button">Log out</button></div></div>');
    var rem = document.getElementById("rem");
    sb.from("profiles").select("reminders_on").eq("id", user.id).maybeSingle().then(function (r) {
      if (r.data) rem.checked = r.data.reminders_on !== false;
      rem.disabled = false;
    });
    rem.addEventListener("change", function () {
      sb.from("profiles").update({ reminders_on: rem.checked }).eq("id", user.id).then(function (r) {
        if (r.error) { rem.checked = !rem.checked; toast("Couldn’t save. Try again."); } else toast(rem.checked ? "Email reminders on" : "Email reminders off");
      });
    });
    sb.rpc("is_admin").then(function (r) { var a = document.getElementById("admin-link"); if (a && r.data === true) a.hidden = false; });
    document.getElementById("logout").addEventListener("click", function () {
      pushProgress().then(function () { return sb.auth.signOut(); }).then(function () {
        user = null;
        try { localStorage.removeItem(KEY); localStorage.removeItem(OWNER); } catch (e) {}
        location.hash = "#/";
        route();
      });
    });
  }

  function afterOAuth() {
    var n = null; try { n = localStorage.getItem("skillroute-next"); localStorage.removeItem("skillroute-next"); } catch (e) {}
    if (n && n !== location.hash) location.hash = n; else route();
    setTimeout(maybeWelcome, 350);
  }

  try { var savedTheme = localStorage.getItem("z2g-theme"); if (savedTheme) document.documentElement.dataset.theme = savedTheme; } catch (e) {}
  new MutationObserver(function () { bindTheme(); }).observe(app, { childList: true, subtree: false });

  zeeInit();
  window.addEventListener("hashchange", route);
  if (sb) {
    sb.auth.getSession().then(function (r) { return setUser(r.data.session && r.data.session.user).then(function () { return !!(r.data.session); }); }).then(function (signedIn) {
      sb.auth.onAuthStateChange(function (ev, session) {
        setTimeout(function () {
          if (ev === "SIGNED_IN" && session && (!user || user.id !== session.user.id)) setUser(session.user).then(afterOAuth);
          if (ev === "SIGNED_OUT" && user) { user = null; route(); }
        }, 0);
      });
      if (signedIn) afterOAuth(); else route();
    });
  } else {
    route();
  }
})();
