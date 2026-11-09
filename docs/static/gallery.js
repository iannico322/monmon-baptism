(function(){
  var API = window.API_BASE || "";
  var GID_KEY = "baptism.guest";
  function guest(){
    try { var g = localStorage.getItem(GID_KEY); if (!g) { g = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, ""); localStorage.setItem(GID_KEY, g); } return g; }
    catch (e) { return ""; }
  }
  function url(p){ return /^https?:/.test(p) ? p : API + p; }
  var $ = function(id){ return document.getElementById(id); };
  var adminKey = new URLSearchParams(location.search).get("key") || "";
  var MAX_SIDE = 1280;

  var video = $("video"), cam = $("cam"), shotsEl = $("shots"), msg = $("camMsg");
  var openBtn = $("openCam"), shutter = $("shutter");
  var stream = null, facing = "environment";
  var SENT_KEY = "baptism.sent", MINE_KEY = "baptism.mine";
  var limit = 5;
  function lsGet(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  // remembered in this browser, so a refresh never gives the 5 photos back
  var sentBefore = Math.max(0, Math.min(limit, parseInt(lsGet(SENT_KEY), 10) || 0));
  var remaining = limit - sentBefore;
  var mine = [];               // photos this guest sent (kept across refreshes)
  try { mine = JSON.parse(lsGet(MINE_KEY) || "[]").filter(function(p){ return p && p.url; }).slice(0, limit); } catch (e) { mine = []; }
  function saveState(){ lsSet(SENT_KEY, String(Math.max(0, limit - remaining))); lsSet(MINE_KEY, JSON.stringify(mine.slice(0, limit))); }
  var sending = false, fallback = !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  var NAME_KEY = "baptism.name", nameIn = $("guestName");
  function storedName(){ try { return localStorage.getItem(NAME_KEY) || ""; } catch (e) { return ""; } }
  function cleanName(){ return nameIn.value.replace(/\s+/g, " ").trim(); }
  nameIn.value = storedName();
  nameIn.addEventListener("input", function(){ try { localStorage.setItem(NAME_KEY, cleanName()); } catch (e) {} });
  function requireName(){
    if (cleanName()) return true;
    say("Please type your name first, so everyone knows who took the photo.");
    nameIn.focus(); return false;
  }
  function say(t, ok){
    msg.textContent = t || ""; msg.style.color = ok ? "var(--ink)" : "";
    var tt = $("camToast"); tt.textContent = t || ""; tt.classList.toggle("on", !!t);   // visible inside the full-screen camera
  }

  // ---------- UI state ----------
  function refreshUI(){
    $("limitN").textContent = limit;
    $("shotCount").textContent = remaining + " left";
    shutter.disabled = remaining <= 0 || sending;
    var used = remaining <= 0;
    openBtn.hidden = !!stream || used;
    $("fileLabel").hidden = used || !!stream || !fallback;
    if (used && !msg.textContent) say("You've used all " + limit + " of your photos. Salamat po!", true);
    shotsEl.textContent = "";
    mine.forEach(function(p, i){
      var f = document.createElement("div"); f.className = "shot";
      var im = document.createElement("img"); im.src = url(p.url); im.alt = "Your photo " + (i + 1);
      f.appendChild(im); shotsEl.appendChild(f);
    });
  }


  // ---------- camera ----------
  async function startCam(){
    say("");
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      say("This page can't open the camera here (browsers only allow it on https). Use the phone camera button below instead.");
      fallback = true; refreshUI(); return;
    }
    stopCam();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
    } catch (e) {
      stream = null;
      say(e && e.name === "NotAllowedError" ? "Camera permission was blocked. Allow the camera in your browser, or use the button below." : "Couldn't start the camera. You can use the phone camera button below.");
      fallback = true; refreshUI(); return;
    }
    video.srcObject = stream;
    var track = stream.getVideoTracks()[0], st = track && track.getSettings ? track.getSettings() : {};
    var front = st.facingMode ? st.facingMode === "user" : facing === "user";
    video.classList.toggle("mirror", front);
    cam.hidden = false; document.documentElement.classList.add("cam-open"); window.scrollTo(0, 0);
    if (cam.requestFullscreen && !document.fullscreenElement) cam.requestFullscreen({ navigationUI: "hide" }).catch(function(){});
    video.play().catch(function(){});
    refreshUI();
  }
  function stopCam(){
    if (stream) stream.getTracks().forEach(function(t){ t.stop(); });
    stream = null; video.srcObject = null; cam.hidden = true; document.documentElement.classList.remove("cam-open");
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function(){});
  }
  openBtn.addEventListener("click", function(){ if (remaining > 0 && requireName()) startCam(); });
  $("fileLabel").addEventListener("click", function(e){ if (!requireName()) e.preventDefault(); });
  $("closeCam").addEventListener("click", function(){ stopCam(); refreshUI(); });
  $("flipBtn").addEventListener("click", function(){ facing = facing === "user" ? "environment" : "user"; startCam(); });

  function toBlob(canvas){ return new Promise(function(res){ canvas.toBlob(res, "image/jpeg", 0.85); }); }
  function drawScaled(src, w, h){
    var s = Math.min(1, MAX_SIDE / Math.max(w, h)), c = document.createElement("canvas");
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  // ---------- take a photo -> it is sent right away ----------
  async function sendOne(blob){
    if (!requireName()) return false;
    sending = true; say("Sending…", true); refreshUI();
    var ok = false, fd = new FormData();
    fd.append("name", cleanName());
    fd.append("photos", blob, "photo.jpg");
    try {
      var res = await fetch(API + "/api/photos", { method: "POST", body: fd, headers: { "X-Guest": guest() } });
      var data = await res.json().catch(function(){ return {}; });
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      remaining = Math.min(remaining - 1, data.remaining); mine.push({ id: data.photos[0].id, url: data.photos[0].url, name: data.photos[0].name }); saveState(); ok = true;
      say(remaining > 0 ? "Sent! " + remaining + (remaining === 1 ? " photo" : " photos") + " left." : "Sent! You've used all " + limit + " photos. Salamat po!", true);
      if (remaining <= 0) stopCam();
      loadPhotos();
    } catch (err) {
      say(err && err.message && !/fetch/i.test(err.message) ? err.message : "Couldn't send that photo. Check your connection and try again.");
    }
    sending = false; refreshUI(); return ok;
  }

  shutter.addEventListener("click", async function(){
    if (remaining <= 0 || sending || !video.videoWidth) return;
    if (!requireName()) return;
    var fl = $("flash"); fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go");
    var blob = await toBlob(drawScaled(video, video.videoWidth, video.videoHeight));
    if (!blob) { say("Couldn't capture that one. Try again."); return; }
    await sendOne(blob);
  });

  // phone camera app fallback (works over plain http too)
  $("fileInput").addEventListener("change", async function(e){
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = "";
    for (var i = 0; i < files.length && remaining > 0; i++) {
      try {
        var bmp = await createImageBitmap(files[i], { imageOrientation: "from-image" });
        var blob = await toBlob(drawScaled(bmp, bmp.width, bmp.height));
        if (!blob || !(await sendOne(blob))) break;
      } catch (err) { say("One of those files wasn't a usable photo."); break; }
    }
  });

  // ---------- gallery grid ----------
  var seen = {};
  function addFigure(p, prepend){
    var f = document.createElement("figure"); f.className = "gi"; f.dataset.id = p.id;
    var im = document.createElement("img"); im.src = url(p.url); im.loading = "lazy"; im.alt = "Photo shared by a guest";
    im.addEventListener("click", function(){ openLightbox(url(p.url), p.name || "Guest", "baptism-" + (p.name || "guest").replace(/[^\w]+/g, "-").toLowerCase() + "-" + p.id.slice(0, 6) + ".jpg"); });
    f.appendChild(im);
    var cap = document.createElement("figcaption"); cap.className = "by"; cap.textContent = p.name || "Guest"; f.appendChild(cap);
    if (adminKey) {
      var d = document.createElement("button"); d.type = "button"; d.className = "rmphoto"; d.textContent = "Remove";
      d.addEventListener("click", async function(){
        if (d.dataset.c !== "1") { d.dataset.c = "1"; d.textContent = "Confirm?"; setTimeout(function(){ d.dataset.c = ""; d.textContent = "Remove"; }, 3000); return; }
        var r = await fetch(API + "/api/photos/" + p.id + "?key=" + encodeURIComponent(adminKey), { method: "DELETE" });
        if (r.ok) { f.remove(); delete seen[p.id]; }
      });
      f.appendChild(d);
    }
    var grid = $("grid"), feat = grid.querySelector(".feat");
    // newest first, right after the portrait
    if (feat && feat.nextSibling && prepend !== false) grid.insertBefore(f, feat.nextSibling); else grid.appendChild(f);
  }
  async function loadPhotos(){
    try {
      var res = await fetch(API + "/api/photos" + (adminKey ? "?key=" + encodeURIComponent(adminKey) : ""), { cache: "no-store", headers: { "X-Guest": guest() } });
      if (!res.ok) throw new Error();
      var data = await res.json();
      limit = data.limit; remaining = Math.min(remaining, data.remaining); saveState();
      var ids = {}; data.photos.forEach(function(p){ ids[p.id] = 1; });
      // photos removed by the parents
      Object.keys(seen).forEach(function(id){
        if (!ids[id]) { var el = $("grid").querySelector('[data-id="' + id + '"]'); if (el) el.remove(); delete seen[id]; }
      });
      // add new ones oldest-first so the newest ends up first
      data.photos.slice().reverse().forEach(function(p){ if (!seen[p.id]) { seen[p.id] = 1; addFigure(p, true); } });
      $("galSub").textContent = data.photos.length
        ? data.photos.length + (data.photos.length === 1 ? " photo" : " photos") + " from our guests"
        : "No guest photos yet. Be the first!";
    } catch (e) { $("galSub").textContent = "Couldn't load the gallery. Pull to refresh."; }
    refreshUI();
  }

  var lb = { src: "", file: "photo.jpg" };
  function openLightbox(src, name, file){
    lb.src = src; lb.file = file;
    $("lbImg").src = src; $("lbImg").alt = "Photo by " + name; $("lbName").textContent = name;
    var b = $("lbDownload"); b.disabled = false; b.textContent = "Download";
    $("lightbox").hidden = false;
  }
  $("lbDownload").addEventListener("click", async function(){
    var b = this; b.disabled = true; b.textContent = "Saving…";
    try {
      var res = await fetch(lb.src); if (!res.ok) throw new Error();
      var blob = await res.blob(), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = lb.file;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
      b.textContent = "Saved!";
    } catch (e) {
      window.open(lb.src, "_blank", "noopener"); b.textContent = "Download";   // fallback: open it so it can be saved
    }
    setTimeout(function(){ b.disabled = false; b.textContent = "Download"; }, 2000);
  });
  var featImg = document.querySelector(".gi.feat img");
  if (featImg) { featImg.addEventListener("click", function(){ openLightbox(featImg.src, "Daimon's baptism portrait", "daimon-baptism-portrait.webp"); }); }
  $("lbClose").addEventListener("click", function(){ $("lightbox").hidden = true; });
  $("lightbox").addEventListener("click", function(e){ if (e.target === this) this.hidden = true; });
  document.addEventListener("keydown", function(e){ if (e.key === "Escape") $("lightbox").hidden = true; });
  document.addEventListener("visibilitychange", function(){ if (document.hidden) stopCam(), refreshUI(); });

  refreshUI();
  loadPhotos();
  setInterval(function(){ if (!document.hidden && !sending) loadPhotos(); }, 15000);
})();
