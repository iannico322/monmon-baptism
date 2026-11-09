(function(){
  var API = window.API_BASE || "";
  var reduce = window.Baptism ? window.Baptism.reduce : false;
  var petals = window.Baptism ? window.Baptism.petals : function(){};

  // ---------- form ----------
  var form = document.getElementById("regForm");
  var errEl = document.getElementById("formErr");
  var btn = document.getElementById("submitBtn");
  var done = document.getElementById("done");
  var ID_KEY = "baptism.godparentId";

  function getId(){ try { return localStorage.getItem(ID_KEY) || ""; } catch (e) { return ""; } }
  function setId(v){ try { localStorage.setItem(ID_KEY, v); } catch (e) {} }
  function rememberName(n){ try { if (n) localStorage.setItem("baptism.name", n); } catch (e) {} }

  function val(name){
    var el = form.elements[name]; if (!el) return "";
    if (typeof RadioNodeList !== "undefined" && el instanceof RadioNodeList) return el.value || "";
    return (el.value || "").trim();
  }
  function collect(){
    return { role:val("role"), fullName:val("fullName"), phone:val("phone"), email:val("email"),
      relation:val("relation"), catholic:val("catholic"), attend:val("attend"), message:val("message") };
  }
  function validate(r){
    if (!r.fullName) return "Please write your full name.";
    if (!r.role) return "Please choose Ninong or Ninang.";
    if (!r.relation) return "Please choose how you're related to us.";
    if (!r.phone) return "Please add your mobile number.";
    if (r.email && !/^\S+@\S+\.\S+$/.test(r.email)) return "Please check your email address.";
    if (!r.catholic) return "Please tell us if you are a confirmed Catholic.";
    if (!r.attend) return "Please tell us if you'll be there on the day.";
    return "";
  }
  function asText(r){
    return "Godparent pledge – Baptism of Daimon Nicholas Etulle Caulin, Nov 15, 2026, 10:00 AM\n" +
      "Role: " + r.role + "\nFull name: " + r.fullName + "\nMobile: " + r.phone +
      (r.email ? "\nEmail: " + r.email : "") + "\nRelationship: " + r.relation +
      "\nConfirmed Catholic: " + r.catholic + "\nAttending: " + r.attend +
      (r.message ? "\nBlessing for baby: " + r.message : "");
  }
  function fillForm(r){
    ["fullName","phone","email","relation","catholic","message"].forEach(function(k){ if (r[k] != null) form.elements[k].value = r[k]; });
    ["role","attend"].forEach(function(k){
      var opt = Array.prototype.find.call(form.querySelectorAll('input[name="'+k+'"]'), function(i){ return i.value === r[k]; });
      if (opt) opt.checked = true;
    });
  }
  function showDone(r, saved, celebrate){
    form.style.display = "none"; done.style.display = "block";
    var first = r.fullName.split(" ")[0];
    document.getElementById("thanksH").textContent = "Salamat po, " + first + "!";
    document.getElementById("doneText").textContent = saved
      ? "Your pledge as Daimon's " + r.role + " is safely signed and sent. We're so blessed to have you."
      : "We're so blessed to have you as Daimon's " + r.role + ".";
    document.getElementById("fallback").style.display = saved ? "none" : "block";
    document.getElementById("copyBtn").style.display = saved ? "none" : "inline-block";
    document.getElementById("msgText").textContent = asText(r);
    done.classList.remove("show"); void done.offsetWidth; done.classList.add("show");
    if (celebrate) { petals(); done.scrollIntoView({behavior: reduce ? "auto" : "smooth", block:"center"}); }
  }
  document.getElementById("editBtn").addEventListener("click", function(){
    done.style.display = "none"; form.style.display = "block"; btn.textContent = "Update my pledge";
  });
  document.getElementById("copyBtn").addEventListener("click", function(e){
    var t = e.target;
    navigator.clipboard.writeText(document.getElementById("msgText").textContent).then(function(){ t.textContent = "Copied!"; }, function(){ t.textContent = "Select the text above to copy"; });
  });

  async function send(payload){
    var res = await fetch(API + "/api/godparents", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    var data = await res.json().catch(function(){ return {}; });
    if (!res.ok) throw new Error(data.error || "Couldn't save.");
    return data;
  }

  form.addEventListener("submit", async function(e){
    e.preventDefault();
    var r = collect(), problem = validate(r);
    errEl.textContent = problem; if (problem) return;
    btn.disabled = true; btn.textContent = "Signing…";
    var saved = false, payload = Object.assign({}, r, { id: getId() });
    try {
      var data = await send(payload); setId(data.id); rememberName(r.fullName); saved = true;
    } catch (err) {
      try { await new Promise(function(res){ setTimeout(res, 700); }); var d2 = await send(payload); setId(d2.id); rememberName(r.fullName); saved = true; }
      catch (e2) { if (e2 && e2.message && !/Failed to fetch|NetworkError|Load failed/i.test(e2.message)) errEl.textContent = e2.message; }
    }
    btn.disabled = false; btn.textContent = "Sign & send";
    if (!saved && errEl.textContent) return;
    showDone(r, saved, true);
  });

  // restore my previous pledge
  (async function(){
    var id = getId(); if (!id) return;
    try {
      var res = await fetch(API + "/api/godparents/" + encodeURIComponent(id));
      if (!res.ok) return;
      var r = await res.json(); fillForm(r); rememberName(r.fullName); showDone(r, true, false);
    } catch (e) {}
  })();

  // ---------- parents' list (needs ?key=...) ----------
  var adminKey = new URLSearchParams(location.search).get("key") || "";
  var current = [];
  var ownerErr = document.getElementById("ownerErr");
  function api(url, opts){ return fetch(API + url + (url.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(adminKey), opts); }

  async function loadList(){
    try {
      var res = await api("/api/godparents");
      if (res.status === 401 || res.status === 403) return false;
      if (!res.ok) throw new Error();
      current = (await res.json()).godparents || [];
      document.getElementById("ownerPanel").style.display = "block";
      renderList(); return true;
    } catch (e) {
      ownerErr.textContent = "The list couldn't be loaded."; return false;
    }
  }
  if (adminKey) { loadList().then(function(ok){ if (ok) setInterval(loadList, 15000); }); }

  function td(text, cls){ var c = document.createElement("td"); if (cls) { var s = document.createElement("span"); s.className = cls; s.textContent = text; c.appendChild(s); } else c.textContent = text || "–"; return c; }
  function renderList(){
    var tb = document.getElementById("rows"); tb.textContent = "";
    var n = current.filter(function(r){ return r.role === "Ninong"; }).length;
    document.getElementById("sTotal").textContent = current.length;
    document.getElementById("sNinong").textContent = n;
    document.getElementById("sNinang").textContent = current.length - n;
    if (!current.length){
      var tr0 = document.createElement("tr"), c0 = td("No pledges yet. Share this page with your chosen ninongs and ninangs."); c0.colSpan = 7; c0.className = "empty"; tr0.appendChild(c0); tb.appendChild(tr0); return;
    }
    current.forEach(function(r){
      var tr = document.createElement("tr"), nameCell = td(r.fullName);
      if (r.message){ var m = document.createElement("div"); m.style.cssText = "color:var(--muted);font-style:italic;font-size:.82rem;margin-top:3px"; m.textContent = "“" + r.message + "”"; nameCell.appendChild(m); }
      tr.appendChild(nameCell); tr.appendChild(td(r.role, "tag")); tr.appendChild(td(r.phone)); tr.appendChild(td(r.relation)); tr.appendChild(td(r.catholic));
      tr.appendChild(td(r.attend && r.attend.indexOf("Yes") === 0 ? "Yes" : "Sponsor only"));
      var act = document.createElement("td"), b = document.createElement("button"); b.className = "del"; b.type = "button"; b.textContent = "Remove";
      b.addEventListener("click", async function(){
        if (b.dataset.confirm !== "1"){ b.dataset.confirm = "1"; b.textContent = "Confirm?"; setTimeout(function(){ b.dataset.confirm = ""; b.textContent = "Remove"; }, 3000); return; }
        b.disabled = true;
        try {
          var res = await api("/api/godparents/" + encodeURIComponent(r.id), { method: "DELETE" });
          if (!res.ok) throw new Error();
          current = current.filter(function(x){ return x.id !== r.id; }); renderList();
        } catch (e) { ownerErr.textContent = "Couldn't remove that entry."; b.disabled = false; }
      });
      act.appendChild(b); tr.appendChild(act); tb.appendChild(tr);
    });
  }
  document.getElementById("copyListBtn").addEventListener("click", function(e){
    var t = e.target, lines = ["GODPARENTS – Baptism of Daimon Nicholas Etulle Caulin", "Nov 15, 2026, 10:00 AM · Our Lady of Consolacion Parish Church", ""];
    var ninong = current.filter(function(r){ return r.role === "Ninong"; }), ninang = current.filter(function(r){ return r.role !== "Ninong"; });
    lines.push("NINONG:"); ninong.forEach(function(r,i){ lines.push((i+1) + ". " + r.fullName); });
    lines.push("", "NINANG:"); ninang.forEach(function(r,i){ lines.push((i+1) + ". " + r.fullName); });
    navigator.clipboard.writeText(lines.join("\n")).then(function(){ t.textContent = "Copied!"; setTimeout(function(){ t.textContent = "Copy list for the parish"; }, 2000); }, function(){ t.textContent = "Copy not allowed"; });
  });
})();
