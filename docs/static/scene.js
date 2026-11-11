(function(){
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;

  // ---------- flowers bloom when the invitation opens ----------
  var BLOOM = {"clusters": [{"n": "l", "cx": 115, "cy": 590, "rx": 190, "ry": 310, "delay": 0.0}, {"n": "r", "cx": 940, "cy": 650, "rx": 130, "ry": 170, "delay": 0.45}, {"n": "bl", "cx": 90, "cy": 1440, "rx": 180, "ry": 130, "delay": 0.85}, {"n": "br", "cx": 925, "cy": 1420, "rx": 190, "ry": 140, "delay": 1.1}], "roses": [{"c": "l", "x": 92, "y": 415, "R": 54}, {"c": "l", "x": 178, "y": 405, "R": 60}, {"c": "l", "x": 28, "y": 545, "R": 52}, {"c": "l", "x": 35, "y": 700, "R": 78}, {"c": "r", "x": 917, "y": 567, "R": 52}, {"c": "r", "x": 985, "y": 585, "R": 60}, {"c": "r", "x": 933, "y": 672, "R": 78}, {"c": "bl", "x": 58, "y": 1458, "R": 78}, {"c": "bl", "x": 25, "y": 1355, "R": 64}, {"c": "bl", "x": 195, "y": 1495, "R": 66}, {"c": "br", "x": 905, "y": 1468, "R": 66}, {"c": "br", "x": 990, "y": 1385, "R": 62}, {"c": "br", "x": 1005, "y": 1500, "R": 56}]};
  var sceneEl = document.getElementById("scene"), cv = null, cx2 = null, bloomReady = false, bloomRunning = false;
  var origImg = sceneEl.querySelector(".bg"), baseImg = new Image();
  function ss01(t){ t = Math.max(0, Math.min(1, t)); return t*t*(3-2*t); }
  function easeOut(t){ t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); }
  function easeBack(t){ t = Math.max(0, Math.min(1, t)); var c = 1.0; return 1 + (c+1)*Math.pow(t-1,3) + c*Math.pow(t-1,2); }
  function mk(w, h){ var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function ring(rs, stops){
    var R = rs.R, half = Math.ceil(R*1.22), S = half*2, c = mk(S, S), g = c.getContext("2d");
    g.drawImage(origImg, -(rs.x - half), -(rs.y - half));
    var gr = g.createRadialGradient(half, half, 0, half, half, R*1.2);
    stops.forEach(function(s){ gr.addColorStop(Math.min(1, s[0]/1.2), "rgba(0,0,0," + s[1] + ")"); });
    g.globalCompositeOperation = "destination-in"; g.fillStyle = gr; g.fillRect(0, 0, S, S);
    return { c: c, half: half };
  }
  var RING_PROFILES = [
    [[0,0],[.52,0],[.62,1],[1.02,1],[1.14,0],[1.2,0]],      // outer petals
    [[0,0],[.22,0],[.30,1],[.62,1],[.72,0],[1.2,0]],        // middle petals
    [[0,1],[.32,1],[.42,0],[1.2,0]]                         // bud
  ];
  function prepBloom(){
    try {
      var W = 1024, H = 1536;
      cv = mk(W, H); cv.className = "bloomcv"; cv.setAttribute("aria-hidden", "true");
      origImg.insertAdjacentElement("afterend", cv); cx2 = cv.getContext("2d");
      BLOOM.clusters.forEach(function(cl){
        var bx = Math.max(0, Math.floor(cl.cx - cl.rx)), by = Math.max(0, Math.floor(cl.cy - cl.ry));
        var bw = Math.min(W, Math.ceil(cl.cx + cl.rx)) - bx, bh = Math.min(H, Math.ceil(cl.cy + cl.ry)) - by;
        var c = mk(bw, bh), g = c.getContext("2d");
        g.drawImage(origImg, -bx, -by);
        g.save(); g.translate(cl.cx - bx, cl.cy - by); g.scale(cl.rx, cl.ry);
        var ge = g.createRadialGradient(0,0,0,0,0,1);
        ge.addColorStop(0,"rgba(0,0,0,1)"); ge.addColorStop(.82,"rgba(0,0,0,1)"); ge.addColorStop(1,"rgba(0,0,0,0)");
        g.globalCompositeOperation = "destination-in"; g.fillStyle = ge; g.fillRect(-1,-1,2,2); g.restore();
        g.globalCompositeOperation = "destination-out";
        BLOOM.roses.forEach(function(rs){
          var dx = rs.x - bx, dy = rs.y - by, R = rs.R*1.12;
          if (dx + R < 0 || dy + R < 0 || dx - R > bw || dy - R > bh) return;
          var gr = g.createRadialGradient(dx,dy,0,dx,dy,R);
          gr.addColorStop(0,"rgba(0,0,0,1)"); gr.addColorStop(.86,"rgba(0,0,0,1)"); gr.addColorStop(1,"rgba(0,0,0,0)");
          g.fillStyle = gr; g.fillRect(dx-R, dy-R, R*2, R*2);
        });
        cl.layer = c; cl.bx = bx; cl.by = by;
      });
      var idx = {};
      BLOOM.roses.forEach(function(rs, i){
        var cl = BLOOM.clusters.filter(function(c){ return c.n === rs.c; })[0];
        idx[rs.c] = (idx[rs.c] || 0);
        rs.delay = cl.delay + 0.22 + idx[rs.c]*0.17; idx[rs.c]++;
        rs.dir = (i % 2 ? 1 : -1);
        rs.rings = RING_PROFILES.map(function(p){ return ring(rs, p); });
      });
      cx2.drawImage(baseImg, 0, 0, W, H); // empty garden
      cv.style.display = "block"; bloomReady = true;
    } catch (e) { bloomReady = false; if (cv) cv.remove(); }
  }
  baseImg.onload = function(){ if (origImg.complete) prepBloom(); else origImg.addEventListener("load", prepBloom, {once:true}); };
  if (document.getElementById("gate")) baseImg.src = "static/hero_base.webp";
  var DUR = 2.1, STARTS = [.35,.25,.15], DEL = [0,.12,.22], ROT = [-.28,.22,-.14];
  function frame(t){
    var W = 1024, H = 1536, g = cx2;
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    g.drawImage(baseImg, 0, 0, W, H);
    BLOOM.clusters.forEach(function(cl){
      var p = (t - cl.delay + .25)/1.9; if (p <= 0) return;
      var e = easeOut(p), sc = .93 + .07*e;
      g.save(); g.globalAlpha = ss01(p/.75);
      g.translate(cl.cx, cl.cy + cl.ry*.45); g.scale(sc, sc); g.translate(-cl.cx, -(cl.cy + cl.ry*.45) + (1-e)*16);
      g.drawImage(cl.layer, cl.bx, cl.by); g.restore();
    });
    BLOOM.roses.forEach(function(rs){
      var lt = (t - rs.delay)/DUR; if (lt <= 0) return;
      for (var k = 0; k < 3; k++){
        var pk = Math.max(0, Math.min(1, (lt - DEL[k])/.7)); if (pk <= 0) continue;
        var e = easeBack(pk), sc = STARTS[k] + (1 - STARTS[k])*e, a = ss01(pk/.4);
        g.save(); g.globalAlpha = a; g.translate(rs.x, rs.y + (1-e)*rs.R*.12); g.rotate(ROT[k]*rs.dir*(1-e)); g.scale(sc, sc);
        g.drawImage(rs.rings[k].c, -rs.rings[k].half, -rs.rings[k].half); g.restore();
      }
      var gl = Math.sin(Math.PI*Math.max(0, Math.min(1, (lt - .1)/.8)))*.42;
      if (gl > .01){
        var gr = g.createRadialGradient(rs.x, rs.y, 0, rs.x, rs.y, rs.R*1.25);
        gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.save(); g.globalCompositeOperation = "screen"; g.globalAlpha = gl; g.fillStyle = gr;
        g.fillRect(rs.x - rs.R*1.3, rs.y - rs.R*1.3, rs.R*2.6, rs.R*2.6); g.restore();
      }
    });
  }
  function startBloom(){
    if (reduce || !bloomReady || bloomRunning) return;
    bloomRunning = true;
    var t0 = null, last = 0;
    BLOOM.last = Math.max.apply(null, BLOOM.roses.map(function(r){ return r.delay; })) + DUR + .1;
    BLOOM.roses.forEach(function(rs){
      setTimeout(function(){ sparkleAt(rs.x/1024, rs.y/1536, 5); }, 450 + (rs.delay + DUR*.62)*1000);
    });
    setTimeout(function(){
      function step(ts){
        if (t0 === null) t0 = ts; var t = (ts - t0)/1000; frame(t);
        if (t < BLOOM.last) requestAnimationFrame(step); else { frame(BLOOM.last + 1); cv.style.display = "none"; }
      }
      frame(0); requestAnimationFrame(step);
      var dv = document.getElementById("dove");
      setTimeout(function(){ dv.classList.add("land"); setTimeout(function(){ dv.classList.remove("land"); }, 1600); }, 700);
    }, 450);
  }
  function sparkleAt(fx_, fy_, n){
    var rr = sceneEl.getBoundingClientRect(), f = sceneEl.querySelector(".fx");
    for (var i=0;i<(n||9);i++){
      var b = document.createElement("i"); b.className = "burst";
      var a = Math.random()*Math.PI*2, d = 18 + Math.random()*36;
      b.style.left = (fx_*rr.width) + "px"; b.style.top = (fy_*rr.height) + "px";
      b.style.setProperty("--bx", (Math.cos(a)*d).toFixed(1) + "px");
      b.style.setProperty("--by", (Math.sin(a)*d - 12).toFixed(1) + "px");
      f.appendChild(b); (function(n){ setTimeout(function(){ n.remove(); }, 1000); })(b);
    }
  }

  // ---------- gate ----------
  var gate = document.getElementById("gate");
  // ---------- full screen (tapping the cross enters it; a small icon top-right toggles it) ----------
  var fsBtn = null;
  var fsOK = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  function fsEl(){ return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function enterFs(){
    var el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!f) return;
    try { var r = f.call(el); if (r && r.catch) r.catch(function(){}); } catch (e) {}
  }
  function exitFs(){
    var f = document.exitFullscreen || document.webkitExitFullscreen;
    if (!f) return;
    try { var r = f.call(document); if (r && r.catch) r.catch(function(){}); } catch (e) {}
  }
  function syncFs(){
    if (!fsBtn) return;
    var on = !!fsEl();
    fsBtn.classList.toggle("is-full", on);
    fsBtn.setAttribute("aria-label", on ? "Exit full screen" : "Enter full screen");
    fsBtn.title = on ? "Exit full screen" : "Full screen";
  }
  function makeFsBtn(){
    if (fsBtn || !fsOK) return;
    fsBtn = document.createElement("button");
    fsBtn.type = "button"; fsBtn.className = "fs-btn";
    fsBtn.innerHTML =
      '<svg class="i-expand" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>' +
      '<svg class="i-shrink" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
    fsBtn.addEventListener("click", function(){ if (fsEl()) exitFs(); else enterFs(); });
    document.body.appendChild(fsBtn); syncFs();
  }
  document.addEventListener("fullscreenchange", syncFs);
  document.addEventListener("webkitfullscreenchange", syncFs);

  function openGate(){
    enterFs();            // must run inside the tap on the cross
    makeFsBtn();
    startBloom();
    gate.classList.add("open");
    root.classList.remove("locked");
    window.scrollTo(0,0);
    setTimeout(function(){ gate.style.display = "none"; }, reduce ? 50 : 1700);
  }
  if (gate) {
    // press and hold the seal: a ring fills, and the invitation opens when it is full
    var seal = document.getElementById("openBtn"), HOLD_MS = reduce ? 400 : 1100, holdTimer = null, opened = false;
    function cancelHold(){ clearTimeout(holdTimer); holdTimer = null; if (!opened) seal.classList.remove("holding"); }
    function finishHold(){
      holdTimer = null; if (opened) return; opened = true;
      openGate();                      // (full screen is requested again on release, which touch screens require)
    }
    seal.addEventListener("pointerdown", function(e){
      if (opened || (e.pointerType === "mouse" && e.button !== 0)) return;
      try { seal.setPointerCapture(e.pointerId); } catch (err) {}
      seal.classList.add("holding");
      clearTimeout(holdTimer); holdTimer = setTimeout(finishHold, HOLD_MS);
    });
    function release(){
      if (opened) { if (!fsEl()) enterFs(); }   // finger lifted: a fresh tap gesture lets touch browsers go full screen
      else cancelHold();
    }
    seal.addEventListener("pointerup", release);
    seal.addEventListener("pointercancel", cancelHold);
    seal.addEventListener("contextmenu", function(e){ e.preventDefault(); });
    seal.addEventListener("click", function(e){ e.preventDefault(); });   // a plain click or tap never opens it
    seal.addEventListener("keydown", function(e){                          // keyboard users: Enter / Space
      if ((e.key === "Enter" || e.key === " ") && !e.repeat && !opened) { e.preventDefault(); opened = true; seal.classList.add("holding"); openGate(); }
    });
    seal.focus({preventScroll:true});
  }

  // ---------- reveal ----------
  var rv = document.querySelectorAll(".rv");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }); }, {threshold:.08});
    rv.forEach(function(el){ io.observe(el); });
  } else rv.forEach(function(el){ el.classList.add("in"); });

  // ---------- countdown ----------
  var target = new Date("2026-11-15T08:00:00+08:00").getTime();
  function tick(){
    var ms = target - Date.now(), txt;
    if (ms <= -3*36e5) txt = "Celebrated with love";
    else if (ms <= 0) txt = "Today is the day";
    else {
      var d = Math.floor(ms/864e5), h = Math.floor(ms/36e5)%24, m = Math.floor(ms/6e4)%60;
      txt = d > 0 ? d + (d===1?" day ":" days ") + h + " hr to go" : h + " hr " + m + " min to go";
    }
    document.querySelectorAll(".cdtxt").forEach(function(el){ el.textContent = txt; });
  }
  tick(); setInterval(tick, 30000);


  // ---------- scene: sparkles, dove, parallax ----------
  var scene = document.getElementById("scene"), fx = scene.querySelector(".fx");
  [[15,9],[28,8.5],[19,19.5],[26,18],[22,7],[13,15],[12,7],[31,4],[46,10],[60,5],[69,15],[90,32],[7,25],[53,27],[93,11],[18,37],[80,41],[38,2],[26,19],[63,32]].forEach(function(p,i){
    var s = document.createElement("i"); s.className = "spark";
    s.style.left = p[0] + "%"; s.style.top = p[1] + "%";
    s.style.setProperty("--s", (1.3 + (i%3)*0.8) + "cqw");
    s.style.setProperty("--d", (2.6 + (i%4)*0.7) + "s");
    s.style.setProperty("--dl", (i*0.37) + "s");
    fx.appendChild(s);
  });
  scene.addEventListener("pointerdown", function(e){
    if (reduce || e.target.closest("button,a")) return;
    var r = scene.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    for (var i=0;i<11;i++){
      var b = document.createElement("i"); b.className = "burst";
      var a = Math.random()*Math.PI*2, d = 28 + Math.random()*58;
      b.style.left = x + "px"; b.style.top = y + "px";
      b.style.setProperty("--bx", (Math.cos(a)*d).toFixed(1) + "px");
      b.style.setProperty("--by", (Math.sin(a)*d - 18).toFixed(1) + "px");
      fx.appendChild(b); (function(n){ setTimeout(function(){ n.remove(); }, 1000); })(b);
    }
  });
  scene.addEventListener("pointermove", function(e){
    if (reduce || e.pointerType !== "mouse") return;
    var r = scene.getBoundingClientRect();
    scene.style.setProperty("--px", ((e.clientX - r.left)/r.width - .5).toFixed(3));
    scene.style.setProperty("--py", ((e.clientY - r.top)/r.height - .5).toFixed(3));
  });
  var dove = document.getElementById("dove"), flying = false;
  dove.addEventListener("click", function(){
    if (flying) return; flying = true;
    if (reduce) { flying = false; return; }
    dove.classList.add("fly");
    setTimeout(function(){ dove.classList.remove("fly"); dove.classList.add("land"); }, 1700);
    setTimeout(function(){ dove.classList.remove("land"); flying = false; }, 3300);
  });

  // ---------- sheets ----------
  var sheet = document.getElementById("sheet"), sheetBg = document.getElementById("sheetBg"), sheetT = document.getElementById("sheetT"), sheetB = document.getElementById("sheetB"), lastOpener = null;
  var CAL = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("Baptism of Daimon Nicholas Etulle Caulin") + "&dates=20261115T000000Z/20261115T020000Z&location=" + encodeURIComponent("Our Lady of Consolation Parish Church") + "&details=" + encodeURIComponent("Please arrive by 7:30 AM. Wear sky blue or white.");
  function pledgeBtn(label){
    return document.getElementById("pledge")
      ? '<button class="go" type="button" data-go="pledge">' + label + '</button>'
      : '';
  }
  var SHEETS = {
    about: { t: "About the Baptism", h:
      '<p>Baptism is the first sacrament of the Catholic faith. Through water and the Word, Daimon will be welcomed into God\u2019s family and the life of the Church.</p>' +
      '<p>Ninongs and Ninangs walk with him: praying for him, setting an example of faith, and supporting his parents as he grows.</p>' +
      '<p>Under Church rules, a godparent is generally at least 16 years old and a baptized, confirmed Catholic who has received the Eucharist. Parishes can have their own requirements, so please check if you\u2019re unsure.</p>' +
      pledgeBtn('I\u2019d love to be his godparent') },
    event: { t: "Event Details", h:
      '<dl><dt>Date</dt><dd>Sunday, November 15, 2026</dd><dt>Time</dt><dd>8:00 AM<br><small>Please arrive by 7:30 AM for registration and a quick briefing.</small></dd>' +
      '<dt>Venue</dt><dd>Our Lady of Consolation Parish Church</dd><dt>Reception</dt><dd>Marvilla Beach Resort, Opol<br><button class="lnk lnk-btn" type="button" data-open="reception">See photos &amp; map</button></dd><dt>Dress</dt><dd>Sky blue or white<br><small>You can bring an extra outfit if you wish to swim at the reception.</small></dd><dt>Countdown</dt><dd class="cdtxt"></dd></dl>' +
      '<p>Some parishes ask godparents to attend a short seminar or bring a confirmation certificate. We\u2019ll message you if anything is needed.</p>' +
      '<a class="lnk" href="' + CAL + '" target="_blank" rel="noopener">Add to Google Calendar</a><br>' +
      pledgeBtn('Sign the godparent pledge') }
  };
  var RECEPTION = "Marvilla Beach Resort, Opol", RQ = encodeURIComponent(RECEPTION);
  var RPICS = [
    ["static/loc/marvilla-1.webp", "Entrance sign of Marvilla Beach Resort"],
    ["static/loc/marvilla-2.webp", "A beach hut and a big old tree by the shore"],
    ["static/loc/marvilla-3.webp", "View of the beach from inside a thatched cottage"],
    ["static/loc/marvilla-4.webp", "Cottages and shady trees along the sand"]
  ];
  SHEETS.reception = { t: "Reception", h:
    '<div class="pics-wrap"><div class="pics" tabindex="0" aria-label="Photos of the venue">' +
      RPICS.map(function(p, i){ return '<img src="' + p[0] + '" alt="' + p[1] + '"' + (i ? ' loading="lazy"' : '') + '>'; }).join('') +
    '</div>' +
    '<button class="pic-nav prev" type="button" aria-label="Previous photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M15 5l-7 7 7 7"/></svg></button>' +
    '<button class="pic-nav next" type="button" aria-label="Next photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>' +
    '<div class="pic-dots" aria-hidden="true">' + RPICS.map(function(){ return '<i></i>'; }).join('') + '</div></div>' +
    '<dl><dt>Place</dt><dd><b>Marvilla Beach Resort</b><br>Opol</dd><dt>Date</dt><dd>Sunday, November 15, 2026</dd></dl>' +
    '<p class="note">If you wish to swim, you can bring an extra outfit.</p>' +
    '<div class="vs-map"><iframe title="Map of Marvilla Beach Resort" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen src="https://www.google.com/maps?q=' + RQ + '&output=embed"></iframe></div>' +
    '<a class="go" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + RQ + '">Open in Google Maps</a>' +
    '<a class="go alt" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + RQ + '">Get directions</a>',
    init: function(root){
      var box = root.querySelector(".pics"), dots = root.querySelectorAll(".pic-dots i"), n = RPICS.length;
      function cur(){ return Math.max(0, Math.min(n - 1, Math.round(box.scrollLeft / Math.max(1, box.clientWidth)))); }
      function sync(){ var c = cur(); Array.prototype.forEach.call(dots, function(d, i){ d.classList.toggle("on", i === c); }); }
      function go(i){ box.scrollTo({ left: ((i % n) + n) % n * box.clientWidth, behavior: reduce ? "auto" : "smooth" }); }
      box.addEventListener("scroll", function(){ window.requestAnimationFrame(sync); }, { passive: true });
      root.querySelector(".pic-nav.prev").addEventListener("click", function(){ go(cur() - 1); });
      root.querySelector(".pic-nav.next").addEventListener("click", function(){ go(cur() + 1); });
      box.addEventListener("keydown", function(e){ if (e.key === "ArrowLeft") { e.preventDefault(); go(cur() - 1); } else if (e.key === "ArrowRight") { e.preventDefault(); go(cur() + 1); } });
      Array.prototype.forEach.call(dots, function(d, i){ d.addEventListener("click", function(){ go(i); }); });
      sync();
    } };

  function openSheet(key, opener){
    var d = SHEETS[key]; if (!d) return;
    lastOpener = opener || null; sheetT.textContent = d.t; sheetB.innerHTML = d.h; tick();
    if (d.init) d.init(sheetB);
    sheetBg.hidden = false; sheet.hidden = false;
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ sheetBg.classList.add("show"); sheet.classList.add("show"); document.getElementById("sheetX").focus({preventScroll:true}); }); });
    sheet.scrollTop = 0;
  }
  function closeSheet(){
    if (sheet.hidden) return;
    sheetBg.classList.remove("show"); sheet.classList.remove("show");
    setTimeout(function(){ sheet.hidden = true; sheetBg.hidden = true; if (lastOpener) lastOpener.focus({preventScroll:true}); }, reduce ? 0 : 380);
  }
  function goPledge(){
    closeSheet();
    setTimeout(function(){ var el = document.getElementById("pledge"); el.classList.add("in"); el.scrollIntoView({behavior: reduce ? "auto" : "smooth", block:"start"}); }, reduce ? 0 : 260);
  }
  document.addEventListener("click", function(e){
    var o = e.target.closest("[data-open]"); if (o) { openSheet(o.getAttribute("data-open"), o); return; }
    var g = e.target.closest("[data-go]"); if (g) { goPledge(); return; }
    if (e.target === sheetBg) closeSheet();
  });
  document.getElementById("sheetX").addEventListener("click", closeSheet);
  document.addEventListener("keydown", function(e){ if (e.key === "Escape") closeSheet(); });

  // ---------- petals ----------
  function petals(){
    if (reduce) return;
    var colors = ["#ffffff","#d6e9f7","#9cc6e6","#ffffff","#bcd9ef"];
    for (var i=0;i<26;i++){
      var p = document.createElement("span"); p.className = "petal";
      p.style.left = (Math.random()*100) + "vw";
      p.style.background = colors[i%colors.length];
      p.style.boxShadow = "0 2px 6px rgba(44,93,128,.35)";
      p.style.width = p.style.height = (10 + Math.random()*12) + "px";
      p.style.setProperty("--dx", ((Math.random()-.5)*160) + "px");
      p.style.setProperty("--rot", ((Math.random()-.5)*900) + "deg");
      p.style.animationDuration = (4.5 + Math.random()*4) + "s";
      p.style.animationDelay = (Math.random()*1.4) + "s";
      document.body.appendChild(p);
      (function(n){ setTimeout(function(){ n.remove(); }, 10500); })(p);
    }
  }

  window.Baptism = { petals: petals, reduce: reduce };
})();

// ---------- venue map sidebar (hover on desktop, tap on phones) ----------
(function(){
  var venue = document.querySelector(".info .it:last-child");
  if (!venue) return;
  // Put the exact address here for a more accurate pin.
  var PLACE = "Our Lady of Consolation Parish Church";
  var q = encodeURIComponent(PLACE);

  var panel = document.createElement("aside");
  panel.className = "venue-side"; panel.id = "venueSide"; panel.setAttribute("aria-label", "Venue map");
  panel.innerHTML =
    '<button class="vs-x" type="button" aria-label="Close map">&times;</button>' +
    '<p class="vs-k">Venue</p><h3>' + PLACE + '</h3>' +
    '<p class="vs-d">Sunday, November 15, 2026 &middot; 8:00 AM<br><small>Please arrive by 7:30 AM for registration.</small></p>' +
    '<div class="vs-map"><iframe title="Map of the venue" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>' +
    '<a class="vs-b" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + q + '">Open in Google Maps</a>' +
    '<a class="vs-b alt" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + q + '">Get directions</a>';
  document.body.appendChild(panel);

  venue.setAttribute("tabindex", "0"); venue.setAttribute("role", "button");
  venue.setAttribute("aria-controls", "venueSide"); venue.setAttribute("aria-expanded", "false");
  venue.classList.add("it-link");

  var frame = panel.querySelector("iframe"), timer = null, pinned = false;
  function open(){
    clearTimeout(timer);
    if (!frame.src) frame.src = "https://www.google.com/maps?q=" + q + "&output=embed";
    panel.classList.add("show"); venue.setAttribute("aria-expanded", "true");
  }
  function close(){
    clearTimeout(timer); pinned = false;
    panel.classList.remove("show"); venue.setAttribute("aria-expanded", "false");
  }
  function later(){ if (pinned) return; clearTimeout(timer); timer = setTimeout(close, 300); }

  var canHover = window.matchMedia && matchMedia("(hover:hover)").matches;
  if (canHover) {
    venue.addEventListener("mouseenter", open); venue.addEventListener("mouseleave", later);
    panel.addEventListener("mouseenter", function(){ clearTimeout(timer); }); panel.addEventListener("mouseleave", later);
  }
  venue.addEventListener("click", function(){ if (panel.classList.contains("show") && pinned) close(); else { pinned = true; open(); } });
  venue.addEventListener("keydown", function(e){ if (e.key === "Enter" || e.key === " ") { e.preventDefault(); venue.click(); } });
  panel.querySelector(".vs-x").addEventListener("click", close);
  document.addEventListener("keydown", function(e){ if (e.key === "Escape") close(); });
  document.addEventListener("pointerdown", function(e){
    if (pinned && !panel.contains(e.target) && !venue.contains(e.target)) close();
  });
})();
