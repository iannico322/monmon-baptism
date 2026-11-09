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
    return "Godparent pledge – Baptism of Daimon Nicholas Etulle Caulin, Nov 15, 2026, 8:00 AM\n" +
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
    var card = document.getElementById("pledge"); card.scrollTop = 0; card.scrollLeft = 0;
    done.classList.remove("show"); void done.offsetWidth; done.classList.add("show");
    if (celebrate) { petals(); document.getElementById("pledge").scrollIntoView({behavior: reduce ? "auto" : "smooth", block:"start"}); }
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
      tr.appendChild(nameCell); tr.appendChild(td(r.role, "rolechip")); tr.appendChild(td(r.phone)); tr.appendChild(td(r.relation)); tr.appendChild(td(r.catholic));
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
  // ---------- export the list to Excel (.xlsx), or CSV if the Excel helper can't load ----------
  var XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  function loadXlsx(){
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function(resolve, reject){
      var s = document.createElement("script"); s.src = XLSX_URL; s.async = true;
      s.onload = function(){ window.XLSX ? resolve(window.XLSX) : reject(new Error("xlsx")); };
      s.onerror = function(){ reject(new Error("xlsx")); };
      document.head.appendChild(s);
    });
  }
  function fmtWhen(t){
    if (!t) return "";
    var d = new Date(t * 1000), p = function(n){ return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  var HEAD = ["#", "Role", "Full name", "Mobile", "Email", "Relationship", "Confirmed Catholic", "Attending", "Blessing for Daimon", "Signed up"];
  function exportRows(){
    var rows = current.slice().sort(function(a, b){
      return (a.role === b.role ? 0 : a.role === "Ninong" ? -1 : 1) || (a.submittedAt || 0) - (b.submittedAt || 0);
    });
    return rows.map(function(r, i){
      return [i + 1, r.role || "", r.fullName || "", r.phone || "", r.email || "", r.relation || "",
        r.catholic || "", r.attend && r.attend.indexOf("Yes") === 0 ? "Will be there" : "Sponsor only (can't attend)",
        r.message || "", fmtWhen(r.submittedAt)];
    });
  }
  function saveBlob(blob, name){
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
  }
  function csvCell(v){ v = String(v == null ? "" : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function downloadCsv(data){
    var lines = [HEAD].concat(data).map(function(r){ return r.map(csvCell).join(","); });
    saveBlob(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), "godparents-daimon-baptism.csv");   // BOM so Excel reads the Filipino/accented letters correctly
  }
  document.getElementById("xlsBtn").addEventListener("click", async function(){
    var btn = this, label = "Download Excel";
    if (!current.length) { btn.textContent = "No pledges yet"; setTimeout(function(){ btn.textContent = label; }, 1800); return; }
    btn.disabled = true; btn.textContent = "Preparing…";
    var data = exportRows();
    try {
      var X = await loadXlsx();
      var ws = X.utils.aoa_to_sheet([HEAD].concat(data));
      ws["!cols"] = [{ wch: 4 }, { wch: 9 }, { wch: 28 }, { wch: 15 }, { wch: 26 }, { wch: 16 }, { wch: 18 }, { wch: 26 }, { wch: 50 }, { wch: 17 }];
      var range = X.utils.decode_range(ws["!ref"]);
      for (var R = 1; R <= range.e.r; R++) {                      // keep phone numbers as text so a leading 0 isn't lost
        var c = ws[X.utils.encode_cell({ r: R, c: 3 })]; if (c) { c.t = "s"; c.v = String(c.v); }
      }
      ws["!autofilter"] = { ref: ws["!ref"] };
      var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, "Godparents");
      X.writeFile(wb, "godparents-daimon-baptism.xlsx");
      btn.textContent = "Saved!";
    } catch (e) {
      downloadCsv(data);                                         // offline / blocked: a CSV still opens in Excel
      btn.textContent = "Saved (CSV)";
    }
    setTimeout(function(){ btn.disabled = false; btn.textContent = label; }, 2000);
  });

  document.getElementById("copyListBtn").addEventListener("click", function(e){
    var t = e.target, lines = ["GODPARENTS – Baptism of Daimon Nicholas Etulle Caulin", "Nov 15, 2026, 8:00 AM · Our Lady of Consolation Parish Church", ""];
    var ninong = current.filter(function(r){ return r.role === "Ninong"; }), ninang = current.filter(function(r){ return r.role !== "Ninong"; });
    lines.push("NINONG:"); ninong.forEach(function(r,i){ lines.push((i+1) + ". " + r.fullName); });
    lines.push("", "NINANG:"); ninang.forEach(function(r,i){ lines.push((i+1) + ". " + r.fullName); });
    navigator.clipboard.writeText(lines.join("\n")).then(function(){ t.textContent = "Copied!"; setTimeout(function(){ t.textContent = "Copy list for the parish"; }, 2000); }, function(){ t.textContent = "Copy not allowed"; });
  });
})();
