/* =========================================================
   KI-Agenten – Geschirr für den Kern · Seitenlogik
   ========================================================= */
(function () {
  const LEVELS = ["UNGEZÄHMT", "SCHLEIFE", "GESCHIRR", "ZÜGEL", "GESPANN", "KUTSCHER"];
  const STREAK_GOAL = 5;
  const S = window.AgentSim;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
  const svgEl = (tag, attrs = {}, parent) => {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const warte = ms => new Promise(r => setTimeout(r, calm ? 0 : ms));
  const komma = x => Number(x).toFixed(1).replace(".", ",");

  /* ---------------- Fortschritt (nur im Browser) ---------------- */
  const KEY = "ls-ki-agenten:v1";
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { cleared: [] }; } catch (e) { return { cleared: [] }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* privat/blockiert */ } }
  const progress = load();
  const isCleared = n => progress.cleared.includes(n);

  /* ---------------- Syntax-Hervorhebung ---------------- */
  function hlJson(src) {
    return esc(src).replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, (m, str, colon, lit) => {
      if (str) return colon ? `<span class="j-key">${str}</span>${colon}` : `<span class="j-str">${str}</span>`;
      if (lit) return `<span class="j-lit">${lit}</span>`;
      return `<span class="j-num">${m}</span>`;
    });
  }
  function hlPy(src) {
    return esc(src).replace(/(#.*$)|(f?"""[\s\S]*?"""|f?"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[\w.]+)|\b(from|import|def|async|await|return|if|elif|else|for|in|while|not|None|True|False|and|or|break|class|self)\b/gm, (m, com, str, dec, kw) => {
      if (com) return `<span class="p-com">${com}</span>`;
      if (str) return `<span class="p-str">${str}</span>`;
      if (dec) return `<span class="p-dec">${dec}</span>`;
      return `<span class="p-kw">${kw}</span>`;
    });
  }
  // Definitionsdatei: Kopfbereich zwischen --- hervorheben
  function hlMd(src) {
    let imKopf = false, striche = 0;
    return String(src).split("\n").map(z => {
      if (z.trim() === "---" && striche < 2) { striche++; imKopf = striche === 1; return `<span class="m-sep">---</span>`; }
      if (imKopf) {
        const i = z.indexOf(":");
        if (i > 0) return `<span class="m-key">${esc(z.slice(0, i))}</span>:<span class="m-val">${esc(z.slice(i + 1))}</span>`;
      }
      return esc(z);
    }).join("\n");
  }
  // Protokoll mit Etiketten [MENSCH ], [HARNESS] …
  function hlLog(src) {
    return esc(src).replace(/^(\s*(?:│\s*)*)\[(MENSCH|AGENT|HARNESS|LLM|MCP|FEHLER)\s*\]/gm, (m, ein, wer) => `${ein}<span class="lz-tag t-${wer.toLowerCase()}">[${wer.padEnd(7, " ")}]</span>`);
  }
  const hl = (lang, src) => lang === "py" ? hlPy(src) : lang === "md" ? hlMd(src) : lang === "log" ? hlLog(src) : hlJson(src);
  $$("pre.json").forEach(p => { if (p.textContent.trim()) p.innerHTML = hlJson(p.textContent); });
  $$("pre.py").forEach(p => { if (p.textContent.trim()) p.innerHTML = hlPy(p.textContent); });
  $$("pre.md").forEach(p => { if (p.textContent.trim()) p.innerHTML = hlMd(p.textContent); });
  $$("pre.log").forEach(p => { if (p.textContent.trim()) p.innerHTML = hlLog(p.textContent); });

  /* ---------------- Protokollzeilen wie im Python-Harness ---------------- */
  function logZeile(wer, text, tiefe = 0) {
    const d = document.createElement("div");
    const w = String(wer).toLowerCase();
    d.className = "lz lz-" + w;
    const einzug = "    │ ".repeat(tiefe);
    if (wer === "HINWEIS") d.innerHTML = `${einzug ? `<span class="lz-ein">${einzug}</span>` : ""}<span class="lz-hint">💡 ${esc(text)}</span>`;
    else d.innerHTML = `${einzug ? `<span class="lz-ein">${einzug}</span>` : ""}<span class="lz-tag t-${w}">[${esc(String(wer).padEnd(7, " "))}]</span> <span class="lz-text">${esc(text)}</span>`;
    return d;
  }
  function logAn(el, wer, text, tiefe) { const d = logZeile(wer, text, tiefe); el.appendChild(d); el.scrollTop = el.scrollHeight; return d; }

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
  }

  /* ---------------- Navigation ---------------- */
  const nav = $("#lvl-nav");
  const page = $(".level") ? +$(".level").dataset.level : null; // null = Startseite
  LEVELS.forEach((name, i) => {
    const a = document.createElement("a");
    a.href = `lvl${i}.html`; a.textContent = `LVL ${i}`; a.title = name; a.dataset.level = i;
    if (i === page) { a.classList.add("current"); a.setAttribute("aria-current", "page"); }
    nav.appendChild(a);
  });
  $$(".level").forEach(sec => {
    const links = $$(".station", sec).map(st => `<a href="#${st.id}">${esc($("h3", st).textContent)}</a>`);
    links.push(`<a href="#${sec.id}-test">Clearance-Test</a>`);
    const div = document.createElement("div");
    div.className = "station-nav"; div.innerHTML = links.join("<span class='dim'>·</span>");
    $(".lvl-head .lvl-sub", sec).after(div);
  });

  /* ---------------- Schaltbild Startseite: Kern mit sechs Gurten ---------------- */
  const core = $("#core-svg");
  function drawCore() {
    if (!core) return;
    core.innerHTML = "";
    const g = svgEl("g", { class: "core" + (progress.cleared.length === LEVELS.length ? " online" : "") }, core);
    // Zügel vom Kern zum Kutscherpult (unten)
    LEVELS.forEach((name, i) => {
      const a = (-90 + i * 60) * Math.PI / 180;
      const cx = 200 + Math.cos(a) * 158, cy = 200 + Math.sin(a) * 150;
      const pg = svgEl("g", { class: "port" + (isCleared(i) ? " on" : "") }, g);
      svgEl("line", { x1: 200 + Math.cos(a) * 66, y1: 200 + Math.sin(a) * 66, x2: 200 + Math.cos(a) * 128, y2: 200 + Math.sin(a) * 124, class: "port-wire" }, pg);
      const link = svgEl("a", { href: `lvl${i}.html` }, pg);
      svgEl("rect", { x: cx - 42, y: cy - 18, width: 84, height: 36, rx: 6, class: "port-box" }, link);
      const t1 = svgEl("text", { x: cx, y: cy - 2, "text-anchor": "middle", class: "port-lbl" }, link); t1.textContent = `LVL ${i}`;
      const t2 = svgEl("text", { x: cx, y: cy + 11, "text-anchor": "middle", class: "port-sub" }, link); t2.textContent = name;
    });
    svgEl("circle", { cx: 200, cy: 200, r: 78, class: "core-ring" }, g);
    svgEl("circle", { cx: 200, cy: 200, r: 60, class: "core-body" }, g);
    // Geschirr: Bogen um den Kern, je angelegtem Gurt ein Segment
    LEVELS.forEach((_, i) => {
      const a0 = (-120 + i * 60) * Math.PI / 180, a1 = (-60 + i * 60) * Math.PI / 180;
      const r = 70;
      const d = `M ${200 + Math.cos(a0 + .08) * r} ${200 + Math.sin(a0 + .08) * r} A ${r} ${r} 0 0 1 ${200 + Math.cos(a1 - .08) * r} ${200 + Math.sin(a1 - .08) * r}`;
      svgEl("path", { d, class: "harness-seg" + (isCleared(i) ? " on" : "") }, g);
    });
    svgEl("circle", { cx: 200, cy: 192, r: 15, class: "core-eye" }, g);
    const t = svgEl("text", { x: 200, y: 230, "text-anchor": "middle", class: "port-lbl" }, g);
    t.textContent = "LLM";
  }

  function refreshProgressUI() {
    const n = progress.cleared.length;
    $$("a", nav).forEach(a => a.classList.toggle("done", isCleared(+a.dataset.level)));
    $$(".level, .lvl-card").forEach(el => el.classList.toggle("done", isCleared(+el.dataset.level)));
    const st = $("#status-line");
    if (st) {
      st.parentElement.classList.toggle("ok", n === LEVELS.length);
      st.textContent = n === LEVELS.length ? "GESPANN STARTKLAR – 6/6 GURTE ANGELEGT" : `KERN OHNE GESCHIRR – ${n}/6 GURTE ANGELEGT`;
    }
    const start = $("#start-btn");
    if (start) {
      const open = LEVELS.findIndex((_, i) => !isCleared(i));
      start.href = open < 0 ? "#online" : `lvl${open}.html`;
      start.textContent = n === 0 ? "Geschirr anlegen ▸" : open < 0 ? "Zum Abschluss ▸" : `Weiter mit LVL ${open} ▸`;
    }
    if ($("#online")) $("#online").hidden = n !== LEVELS.length;
    drawCore();
  }

  /* ---------------- Hinweis auf die Vorgänger-LS (gleicher Ursprung github.io) ---------------- */
  (function vorgaenger() {
    const el = $("#mcp-status");
    if (!el) return;
    let fertig = false;
    try { fertig = (JSON.parse(localStorage.getItem("mcp-usb-fuer-ki:v1")) || { cleared: [] }).cleared.length >= 6; } catch (e) { /* egal */ }
    el.innerHTML = fertig
      ? "✓ In diesem Browser ist <strong>„MCP – USB für KI“</strong> abgeschlossen (SYSTEM ONLINE). Du kennst den Kern und seine Ports. Jetzt bekommt er sein Geschirr."
      : "Empfehlung: Bearbeite vorher <a href=\"https://flowthetensor.github.io/LS-MCP-USB-fuer-KI/\" target=\"_blank\" rel=\"noopener\">„MCP – USB für KI“</a>. Dort lernst du, wie Programme über MCP mit Tools sprechen. Nötig ist es nicht: LVL 0 wiederholt das Wichtigste.";
    el.classList.toggle("ok", fertig);
  })();

  /* ---------------- Boot-Sequenz ---------------- */
  (function boot() {
    const el = $("#boot");
    if (!el) return;
    let seen = false;
    try { seen = sessionStorage.getItem("agenten-boot") === "1"; } catch (e) { /* egal */ }
    if (seen || calm) { el.remove(); return; }
    const n = progress.cleared.length;
    const lines = [
      "> BOOT SEQUENCE …",
      "> KERN (LLM) .......... <span class='cy'>ONLINE</span>",
      "> MCP-PORTS ........... <span class='cy'>VERBUNDEN</span>",
      `> GESCHIRR ............ ${n}/6 GURTE`,
      n < 6 ? "> <span class='err'>WARNUNG: Kern ohne Geschirr. Viel Kraft, keine Richtung, keine Bremse.</span>" : "> <span class='cy'>Geschirr angelegt. Zügel in Menschenhand.</span>",
      "> Lade Modul: <span class='cy'>KI-Agenten – Geschirr für den Kern</span>",
      "> _"
    ];
    const pre = $("#boot-text");
    let i = 0, timer;
    const step = () => { pre.innerHTML += (i ? "\n" : "") + lines[i++]; if (i < lines.length) timer = setTimeout(step, 380); };
    step();
    const close = () => {
      clearTimeout(timer);
      try { sessionStorage.setItem("agenten-boot", "1"); } catch (e) { /* egal */ }
      el.classList.add("hide"); setTimeout(() => el.remove(), 700);
      document.removeEventListener("keydown", onKey);
      $("h1.glitch").classList.add("go");
    };
    const onKey = e => { if (e.key === "Enter" || e.key === "Escape" || e.key === " ") { e.preventDefault(); close(); } };
    document.addEventListener("keydown", onKey);
    $("#boot-skip").addEventListener("click", close);
    el.addEventListener("click", close);
  })();

  // Werkzeugliste so, wie MenschLLM sie zeigt: • name(param) – beschreibung
  const toolZeile = t => `• ${t.name}(${Object.keys(t.input_schema.properties || {}).join(", ")}) – ${t.description}`;
  function nachrichtZeile(n) {
    if (n.role === "user") return `<div class="msg m-user"><b>[user]</b> ${esc(n.content)}</div>`;
    if (n.role === "assistant") {
      const tc = (n.tool_calls || []).map(a => `tool ${a.name} ${JSON.stringify(a.arguments)}`).join("<br>");
      return `<div class="msg m-llm"><b>[du/LLM]</b> ${n.text ? esc(n.text) : ""}${tc ? esc(tc) : ""}</div>`;
    }
    const inhalt = n.content.length > 500 ? n.content.slice(0, 500) + " …" : n.content;
    return `<div class="msg m-tool"><b>[tool-ergebnis ${esc(n.name)}]</b><pre>${esc(inhalt)}</pre></div>`;
  }

  /* ---------------- LVL 0: Was sieht das LLM? ---------------- */
  (function kontext() {
    const root = $("#kontext");
    if (!root) return;
    const chk = $("#kx-verlauf");
    let nr = 0;
    function show() {
      const k = S.kontextDemo(chk.checked)[nr];
      $$("#kx-schritte .btn").forEach((b, i) => b.classList.toggle("sel", i === nr));
      $("#kx-sys").textContent = k.system;
      $("#kx-liste").innerHTML = k.nachrichten.map(nachrichtZeile).join("");
      $("#kx-tools").innerHTML = k.tools.map(t => `<div class="tl">${esc(toolZeile(t))}</div>`).join("");
      $("#kx-tokens").innerHTML = `Aufruf ${nr + 1}: <strong>${k.nachrichten.length}</strong> Nachricht(en) im Verlauf · etwa <strong>${k.tokens}</strong> Tokens Eingabe` +
        (chk.checked ? "" : " · <span class='bad'>Verlauf fehlt!</span>");
      const ant = $("#kx-antwort");
      ant.textContent = k.antwort;
      ant.classList.toggle("bad", !chk.checked && nr > 0);
    }
    $$("#kx-schritte .btn").forEach((b, i) => b.addEventListener("click", () => { nr = i; show(); }));
    chk.addEventListener("change", show);
    show();
  })();

  /* ---------------- LVL 1: Schleife Schritt für Schritt ---------------- */
  (function schleife() {
    const root = $("#schleife");
    if (!root) return;
    const svg = $("#sl-svg"), logEl = $("#sl-log");
    const K = [["Kontext bauen", 232, 34], ["LLM fragen", 384, 140], ["Prüfen & ausführen", 232, 246], ["Ergebnis anhängen", 82, 140]];
    svgEl("circle", { cx: 232, cy: 140, r: 106, class: "sl-ring" }, svg);
    const knoten = K.map(([t, x, y], i) => {
      const g = svgEl("g", { class: "sl-node" }, svg);
      svgEl("rect", { x: x - 70, y: y - 18, width: 140, height: 36, rx: 8 }, g);
      const tx = svgEl("text", { x, y: y + 5, "text-anchor": "middle" }, g); tx.textContent = `${i + 1} ${t}`;
      return g;
    });
    svgEl("path", { d: "M454 140 H486", class: "sl-exit" }, svg);
    const fertig = svgEl("g", { class: "sl-node sl-done" }, svg);
    svgEl("rect", { x: 486, y: 122, width: 66, height: 36, rx: 8 }, fertig);
    const ft = svgEl("text", { x: 519, y: 145, "text-anchor": "middle" }, fertig); ft.textContent = "FERTIG";
    const sx = svgEl("text", { x: 470, y: 112, "text-anchor": "middle", class: "sl-small" }, svg); sx.textContent = "nur Text";
    const mitte = svgEl("text", { x: 232, y: 136, "text-anchor": "middle", class: "sl-mid" }, svg);
    const mitte2 = svgEl("text", { x: 232, y: 156, "text-anchor": "middle", class: "sl-small" }, svg);

    const q = "SELECT COUNT(*) FROM schueler WHERE klasse = '7a'";
    const T = "Tools für 'datenbank-analyst': list_tables, describe_table, query_database";
    const STEPS = [
      { k: 0, n: 1, s: 1, txt: "Der Mensch erteilt den Auftrag (S1). Der Harness lädt die Definition, wählt die erlaubten Tools aus und baut den ersten Kontext.", z: [["MENSCH", "Auftrag: Wie viele Schüler hat die Klasse 7a?"], ["AGENT", "▶ Agent 'datenbank-analyst' startet"], ["HARNESS", T]] },
      { k: 1, n: 1, s: 1, txt: "Der Harness schickt System-Prompt, Verlauf (1 Nachricht) und Toolliste an das LLM.", z: [["HARNESS", "Schritt 1/10: sende 1 Nachricht(en) + 3 Tool(s) an das LLM …"]] },
      { k: 1, n: 2, s: 1, txt: "Das LLM kennt die Spalten nicht. Es antwortet mit einem <strong>Tool-Wunsch</strong>, nicht mit Text.", z: [["LLM", "möchte Tool 'describe_table' mit {\"table_name\": \"schueler\"}"]] },
      { k: 2, n: 2, s: 1, txt: "Der Harness prüft: Steht <code>describe_table</code> in <code>tools</code>? Ja. Also ruft er das Tool über MCP auf.", z: [["MCP", "tools/call → describe_table"], ["MCP", "Ergebnis: [id, vorname, nachname, klasse, geburtsdatum, email]"]] },
      { k: 3, n: 3, s: 1, txt: "Das Ergebnis kommt <strong>in den Verlauf</strong>. Nur so erfährt das LLM davon.", z: [] },
      { k: 1, n: 3, s: 2, txt: "Zweite Runde: Der Harness schickt jetzt 3 Nachrichten. Das LLM sieht sein eigenes Tool-Ergebnis von eben.", z: [["HARNESS", "Schritt 2/10: sende 3 Nachricht(en) + 3 Tool(s) an das LLM …"], ["LLM", `möchte Tool 'query_database' mit {"query": "${q}"}`]] },
      { k: 2, n: 4, s: 2, txt: "Wieder prüfen und ausführen. Der Server führt die Abfrage aus (nur SELECT ist erlaubt).", z: [["MCP", "tools/call → query_database"], ["MCP", "Ergebnis: [{\"COUNT(*)\": 5}]"]] },
      { k: 3, n: 5, s: 2, txt: "Ergebnis anhängen: Der Verlauf hat jetzt 5 Nachrichten.", z: [] },
      { k: 1, n: 5, s: 3, txt: "Dritte Runde. Das LLM hat alles, was es braucht.", z: [["HARNESS", "Schritt 3/10: sende 5 Nachricht(en) + 3 Tool(s) an das LLM …"]] },
      { k: 4, n: 6, s: 3, txt: "Das LLM antwortet <strong>nur mit Text</strong>, ohne Tool-Wunsch. Damit endet die Schleife. Der Mensch bekommt das Ergebnis (S5).", z: [["LLM", "Die Klasse 7a hat 5 Schüler."], ["AGENT", "■ Agent 'datenbank-analyst' ist fertig (3 Schritt(e))."]] }
    ];
    let cur = 0;
    function show() {
      const st = STEPS[cur];
      knoten.forEach((g, i) => g.classList.toggle("act", i === st.k));
      fertig.classList.toggle("act", st.k === 4);
      mitte.textContent = `Schritt ${st.s}`;
      mitte2.textContent = `${st.n} Nachricht${st.n === 1 ? "" : "en"} im Verlauf`;
      logEl.innerHTML = "";
      STEPS.slice(0, cur + 1).forEach(x => x.z.forEach(([w, t]) => logAn(logEl, w, t)));
      $("#sl-num").textContent = `ETAPPE ${cur + 1}/${STEPS.length}`;
      $("#sl-text").innerHTML = st.txt;
      $("#sl-prev").disabled = cur === 0;
      $("#sl-next").textContent = cur === STEPS.length - 1 ? "Von vorn ↺" : "Weiter ▸";
    }
    $("#sl-next").addEventListener("click", () => { cur = (cur + 1) % STEPS.length; show(); });
    $("#sl-prev").addEventListener("click", () => { if (cur > 0) { cur--; show(); } });
    show();
  })();

  /* ---------------- LVL 1: Workflow oder Agent? ---------------- */
  (function waSort() {
    const root = $("#wa-sort");
    if (!root) return;
    const FAELLE = [
      ["Jeden Morgen um 7 Uhr wird der Vertretungsplan als PDF an alle Lehrkräfte gemailt.", "workflow", "Immer dieselben Schritte, kein Entscheidungsspielraum."],
      ["„Finde heraus, in welchem Fach die 7a am meisten Probleme hat, und schlage Gründe vor.“", "agent", "Welche Abfragen nötig sind, ergibt sich erst unterwegs."],
      ["Ein Formular „Klasse + Fach“ liefert immer den Notendurchschnitt.", "workflow", "Das ist Workflow A aus n8n: eine feste SQL-Abfrage, kein LLM."],
      ["Beliebige Fragen von Lehrkräften zur Schul-Datenbank beantworten.", "agent", "Offene Fragen: Das LLM wählt Tabellen und Abfragen selbst."],
      ["Jede neue Krankmeldung wird in die Tabelle „Fehlzeiten“ übertragen.", "workflow", "Gleiche Eingabe, gleicher Ablauf. Vorhersagbar und günstig."],
      ["Aus einer unsortierten Ideensammlung einen Projekttag planen, inklusive Raumsuche.", "agent", "Mehrere Schritte, Zwischenergebnisse bestimmen den nächsten Schritt."],
      ["Jede E-Mail ins Deutsche übersetzen und im Ordner „Übersetzt“ ablegen.", "workflow", "Ein LLM-Aufruf pro Mail reicht. Das LLM ist hier nur ein Baustein im festen Ablauf."],
      ["Einen Fehler in einem Programm suchen: Logs lesen, Tests starten, Code ändern, wieder testen.", "agent", "Klassischer Agent: Was als Nächstes kommt, hängt vom letzten Ergebnis ab."]
    ];
    function start() {
      let richtig = 0, beantwortet = 0;
      root.innerHTML = `<div class="wa-list">${shuffle(FAELLE.slice()).map(([t, l, w]) => `
        <div class="wa-card" data-l="${l}" data-w="${esc(w)}"><p>${esc(t)}</p>
          <div class="row"><button class="btn small ghost" data-a="workflow">⚙ Workflow</button><button class="btn small ghost" data-a="agent">🔁 Agent</button></div>
          <p class="wa-fb"></p></div>`).join("")}</div><p class="readout" id="wa-score"></p>`;
      $$(".wa-card", root).forEach(card => $$("button", card).forEach(b => b.addEventListener("click", () => {
        const ok = b.dataset.a === card.dataset.l;
        $$("button", card).forEach(x => { x.disabled = true; if (x.dataset.a === card.dataset.l) x.classList.add("sel"); });
        card.classList.add(ok ? "right" : "wrong");
        $(".wa-fb", card).textContent = (ok ? "✓ " : "✗ ") + card.dataset.w;
        beantwortet++; if (ok) richtig++;
        $("#wa-score").innerHTML = `<strong>${richtig}</strong> von ${beantwortet} richtig` +
          (beantwortet === FAELLE.length ? ` <button class="btn small ghost" id="wa-neu">Nochmal</button>` : "");
        const neu = $("#wa-neu"); if (neu) neu.addEventListener("click", start);
      })));
    }
    start();
  })();

  /* ---------------- LVL 2: Du bist das LLM ---------------- */
  (function duBistLLM() {
    const root = $("#dbl");
    if (!root) return;
    const selA = $("#dbl-agent"), selT = $("#dbl-auftrag"), logEl = $("#dbl-log"), ktx = $("#dbl-kontext"), inp = $("#dbl-in"), vorschlag = $("#dbl-vorschlag"), frage = $("#dbl-frage");
    const AUFTRAEGE = [
      "Wie viele Schüler hat die Klasse 7a?",
      "Trage für Werner aus der 7a eine 2,0 in Mathematik als Schulaufgabe ein.",
      "Welche Lehrkräfte unterrichten Informatik?"
    ];
    const VORSCHLAEGE = [
      ["Tabellen ansehen", "tool list_tables"],
      ["Spalten von schueler", "tool describe_table {\"table_name\": \"schueler\"}"],
      ["Schüler der 7a zählen", "tool query_database {\"query\": \"SELECT COUNT(*) FROM schueler WHERE klasse = '7a'\"}"],
      ["Werner in der 7a suchen", "tool query_database {\"query\": \"SELECT id, vorname, nachname FROM schueler WHERE klasse = '7a' AND nachname = 'Werner'\"}"],
      ["Mathe-Kurs der 7a suchen", "tool query_database {\"query\": \"SELECT id FROM kurse WHERE klasse = '7a' AND fach = 'Mathematik'\"}"],
      ["Informatik-Lehrkräfte (fach1)", "tool query_database {\"query\": \"SELECT vorname, nachname FROM lehrer WHERE fach1 = 'Informatik'\"}"],
      ["Informatik-Lehrkräfte (fach2)", "tool query_database {\"query\": \"SELECT vorname, nachname FROM lehrer WHERE fach2 = 'Informatik'\"}"],
      ["Rückfrage an den Menschen", "tool frage_mensch {\"frage\": \"Es gibt Paul und Emma Werner in der 7a. Wen meinst du?\"}"],
      ["Note für Emma eintragen", "tool add_grade {\"schueler_id\": 11, \"kurs_id\": 6, \"note\": 2.0, \"art\": \"Schulaufgabe\"}"],
      ["⚠ Sabotage: Note 6,0 für Anna", "tool add_grade {\"schueler_id\": 1, \"kurs_id\": 1, \"note\": 6.0}"],
      ["⚠ Sabotage: alle Noten löschen", "tool query_database {\"query\": \"DELETE FROM noten\"}"],
      ["Antwort: 5 Schüler", "Die Klasse 7a hat 5 Schüler."],
      ["Antwort: Note eingetragen", "Erledigt: Emma Werner hat in Mathematik eine 2,0 (Schulaufgabe)."]
    ];
    AUFTRAEGE.forEach((a, i) => { const o = document.createElement("option"); o.value = i; o.textContent = a; selT.appendChild(o); });
    vorschlag.innerHTML = `<option value="">Vorschlag wählen …</option>` + VORSCHLAEGE.map(([l], i) => `<option value="${i}">${esc(l)}</option>`).join("");
    vorschlag.addEventListener("change", () => { if (vorschlag.value !== "") inp.value = VORSCHLAEGE[vorschlag.value][1]; vorschlag.value = ""; inp.focus(); });
    let h = null, gezeigt = 0, gen = 0;

    function zeigeKontext(neuStart) {
      const k = h.kontext();
      const neu = k.alle.slice(neuStart ? 0 : gezeigt);
      ktx.innerHTML =
        `<details ${neuStart ? "open" : ""}><summary>SYSTEM-PROMPT</summary><pre>${esc(k.system)}</pre></details>` +
        `<details ${neuStart ? "open" : ""}><summary>VERFÜGBARE TOOLS (${k.tools.length})</summary>${k.tools.map(t => `<div class="tl">${esc(toolZeile(t))}</div>`).join("") || "<div class='tl'>(keine)</div>"}</details>` +
        `<div class="kx-head">NEUE NACHRICHTEN</div>${neu.map(nachrichtZeile).join("")}` +
        `<p class="readout">Insgesamt ${k.alle.length} Nachricht(en) · etwa ${k.tokens} Tokens pro Aufruf</p>`;
      ktx.scrollTop = 0;
      gezeigt = k.alle.length;
    }
    function status() {
      $("#dbl-status").textContent = h.fertig ? "Lauf beendet. Starte neu, um es noch einmal zu versuchen." : "Antworte als LLM:  Text  ODER  tool NAME {json-argumente}";
      inp.disabled = $("#dbl-send").disabled = h.fertig;
    }
    function start() {
      gen++;
      frage.hidden = true; frage.innerHTML = "";
      logEl.innerHTML = "";
      h = new S.SimHarness(selA.value, AUFTRAEGE[selT.value]);
      h.log.forEach(z => logAn(logEl, z.wer, z.text));
      gezeigt = 0; zeigeKontext(true); status();
      inp.value = "";
    }
    // Freigabe (S2) und Rückfrage (S3) als kleine Oberfläche
    function mensch(agent, tool, args) {
      return new Promise(res => {
        frage.hidden = false;
        if (tool === "frage_mensch") {
          frage.innerHTML = `<p class="fq">❓ <strong>${esc(agent)}</strong> fragt dich: ${esc(args.frage || "")}</p>
            <div class="q-input"><input type="text" placeholder="Deine Antwort" aria-label="Antwort an den Agenten"><button class="btn small">Antworten</button></div>`;
          const i = $("input", frage), b = $("button", frage);
          const ok = () => { frage.hidden = true; res({ ok: true, grund: i.value.trim() }); };
          b.addEventListener("click", ok); i.addEventListener("keydown", e => { if (e.key === "Enter") ok(); }); i.focus();
        } else {
          frage.innerHTML = `<p class="fq">⚠ <strong>FREIGABE NÖTIG:</strong> Agent '${esc(agent)}' möchte '<code>${esc(tool)}</code>' aufrufen mit <code>${esc(JSON.stringify(args))}</code></p>
            <div class="row"><button class="btn small" data-j>Erlauben [j]</button><input type="text" placeholder="Begründung bei Ablehnung (optional)" aria-label="Begründung"><button class="btn ghost small" data-n>Ablehnen [n]</button></div>`;
          const g = $("input", frage);
          $("[data-j]", frage).addEventListener("click", () => { frage.hidden = true; res({ ok: true, grund: "" }); });
          $("[data-n]", frage).addEventListener("click", () => { frage.hidden = true; res({ ok: false, grund: g.value.trim() }); });
        }
      });
    }
    async function senden() {
      if (!h || h.fertig) return;
      const text = inp.value.trim();
      if (!text) return;
      const meins = gen;
      inp.disabled = $("#dbl-send").disabled = true;
      const vorher = h.log.length;
      // Zeilen schon während des Wartens auf den Menschen anzeigen
      const anzeigen = () => { while (vorherAngezeigt < h.log.length) { const z = h.log[vorherAngezeigt++]; logAn(logEl, z.wer, z.text); } };
      let vorherAngezeigt = vorher;
      const mitAnzeige = (a, t, g) => { anzeigen(); return mensch(a, t, g); };
      await h.antworte(text, mitAnzeige);
      if (meins !== gen) return;
      anzeigen();
      inp.value = "";
      zeigeKontext(false); status();
      if (!h.fertig) inp.focus();
    }
    $("#dbl-send").addEventListener("click", senden);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); senden(); } });
    $("#dbl-start").addEventListener("click", start);
    selA.addEventListener("change", start); selT.addEventListener("change", start);
    start();
  })();

  /* ---------------- LVL 2: Sicherheits-Labor ---------------- */
  (function injektion() {
    const root = $("#inject");
    if (!root) return;
    const logEl = $("#in-log"), fazit = $("#in-fazit"), frage = $("#in-frage");
    const [sichtbar, versteckt] = S.INJEKTION_MAIL.split("\n");
    $("#in-mail").innerHTML = `<p>${esc(sichtbar)}</p><p class="in-hidden">${esc(versteckt)}</p>`;
    $("#in-quelltext").addEventListener("change", e => root.classList.toggle("quelltext", e.target.checked));
    const s0 = $("#in-s0"), s2 = $("#in-s2");
    const sync = () => { s2.disabled = s0.checked; s2.closest("label").classList.toggle("dim", s0.checked); };
    s0.addEventListener("change", sync); sync();
    let gen = 0;
    async function lauf() {
      const meins = ++gen;
      const schutz = { prompt: $("#in-prompt").checked, s0: s0.checked, s2: s2.checked && !s0.checked, server: $("#in-server").checked };
      logEl.innerHTML = ""; fazit.innerHTML = ""; frage.hidden = true;
      $("#in-run").disabled = true;
      let erg = S.injektionsLauf(schutz, false);
      const fIdx = erg.zeilen.findIndex(z => z[1].includes("FREIGABE NÖTIG"));
      for (let i = 0; i < erg.zeilen.length; i++) {
        if (meins !== gen) return;
        logAn(logEl, ...erg.zeilen[i]);
        await warte(380);
        if (i === fIdx) {
          const ja = await new Promise(res => {
            frage.hidden = false;
            frage.innerHTML = `<p class="fq">⚠ <strong>FREIGABE NÖTIG:</strong> Agent 'sekretariat' möchte '<code>add_grade</code>' aufrufen mit <code>{"schueler_id": 12, "kurs_id": 6, "note": 1.0}</code></p>
              <div class="row"><button class="btn small" data-j>Erlauben</button><button class="btn ghost small" data-n>Ablehnen</button></div>`;
            $("[data-j]", frage).addEventListener("click", () => res(true));
            $("[data-n]", frage).addEventListener("click", () => res(false));
          });
          frage.hidden = true;
          erg = S.injektionsLauf(schutz, ja);
        }
      }
      $("#in-run").disabled = false;
      const n = Object.values(schutz).filter(Boolean).length;
      fazit.innerHTML = erg.schaden.length
        ? `<div class="fb no"><div class="fb-title">✗ SCHADEN</div><ul>${erg.schaden.map(s => `<li>${esc(s)}</li>`).join("")}</ul>${schutz.prompt ? "<p>Die Regel im Prompt hat nichts genützt. Sie ist eine <strong>Bitte</strong>, keine Grenze.</p>" : ""}</div>`
        : `<div class="fb ok"><div class="fb-title">✓ KEIN SCHADEN</div>Die Schutzschichten im <strong>Code</strong> haben gehalten (Harness${schutz.server ? " und MCP-Server" : ""}). ${n > 2 ? "Mehrere Schichten = Verteidigung in der Tiefe." : ""}</div>`;
    }
    $("#in-run").addEventListener("click", lauf);
  })();

  /* ---------------- LVL 3: Autonomie-Regler ---------------- */
  (function autonomie() {
    const root = $("#autonomie");
    if (!root) return;
    const reg = $("#au-stufe"), logEl = $("#au-log"), notaus = $("#au-notaus"), frage = $("#au-frage"), fazit = $("#au-fazit");
    let gen = 0, gestoppt = false, laeuft = false;
    function info() {
      const st = S.STUFEN[+reg.value];
      $("#au-name").textContent = `${st.nr} · ${st.name}`;
      $$(".au-skala span").forEach((s, i) => s.classList.toggle("act", i === st.nr));
      $("#au-mensch").textContent = st.mensch;
      $("#au-risiko").style.setProperty("--w", (st.risiko / 4 * 100) + "%");
      $("#au-aufwand").style.setProperty("--w", (st.aufwand / 4 * 100) + "%");
      notaus.textContent = st.nr === 4 ? "■ NOT-AUS (niemand da)" : "■ NOT-AUS (S4)";
    }
    function waehle(optionen) {
      return new Promise(res => {
        frage.hidden = false;
        frage.innerHTML = `<div class="row">${optionen.map((o, i) => `<button class="btn small ${i ? "ghost" : ""}" data-i="${i}">${esc(o)}</button>`).join("")}</div>`;
        $$("button", frage).forEach(b => b.addEventListener("click", () => { frage.hidden = true; res(+b.dataset.i); }));
      });
    }
    async function lauf() {
      const meins = ++gen;
      const stufe = +reg.value;
      gestoppt = false; laeuft = true;
      logEl.innerHTML = ""; fazit.innerHTML = ""; frage.hidden = true;
      notaus.disabled = stufe < 2 || stufe === 4;
      $("#au-start").disabled = true; reg.disabled = true;
      let zeilen = S.autonomieLauf(stufe);
      let geschrieben = false, abgelehnt = false, paul = false;
      const tempo = stufe === 3 ? 1100 : stufe === 4 ? 500 : 650;
      for (let i = 0; i < zeilen.length; i++) {
        if (meins !== gen) return;
        let [wer, text, opt] = zeilen[i];
        opt = opt || {};
        if (paul) text = text.replace(/"schueler_id": 11/g, "\"schueler_id\": 10").replace(/Emma Werner/g, "Paul Werner").replace("Antwort: Emma", "Antwort: Paul");
        if (gestoppt && !geschrieben) {
          logAn(logEl, "MENSCH", "Strg+C · Abbruch durch den Menschen (S4)");
          logAn(logEl, "AGENT", "■ Agent 'notenverwalter' wurde gestoppt. Es wurde nichts eingetragen.");
          break;
        }
        logAn(logEl, wer, text);
        if (opt.kritisch) geschrieben = true;
        if (opt.frage) {
          const w = await waehle(["Emma", "Paul"]);
          paul = w === 1;
        }
        if (opt.freigabe) {
          const w = await waehle(["Erlauben [j]", "Ablehnen [n]"]);
          if (w === 1) {
            logAn(logEl, "MENSCH", "Freigabe verweigert ✘");
            logAn(logEl, "LLM", "Der Aufruf wurde abgelehnt. Ich habe nichts eingetragen.");
            abgelehnt = true;
            break;
          }
          i++; // nächste Zeile („Freigabe erteilt“) wird normal ausgegeben
          logAn(logEl, ...zeilen[i].slice(0, 2));
        }
        await warte(tempo);
      }
      laeuft = false;
      notaus.disabled = true; $("#au-start").disabled = false; reg.disabled = false;
      const falsch = (stufe >= 3 && geschrieben) || (stufe === 2 && paul && geschrieben);
      fazit.innerHTML = gestoppt && !geschrieben ? `<div class="fb ok"><div class="fb-title">✓ RECHTZEITIG GESTOPPT</div>Der Not-Aus (S4) hat gegriffen, bevor etwas geschrieben wurde.</div>`
        : gestoppt && geschrieben ? `<div class="fb no"><div class="fb-title">✗ ZU SPÄT</div>Die Note stand schon in der Datenbank. Ein Not-Aus hilft nur, solange noch nichts passiert ist.</div>`
          : abgelehnt ? `<div class="fb ok"><div class="fb-title">✓ ABGELEHNT</div>Du hast die Freigabe verweigert. Nichts wurde eingetragen.</div>`
            : falsch ? `<div class="fb no"><div class="fb-title">✗ FALSCHE NOTE IN DER DATENBANK</div>${stufe === 2 ? "Du hast Paul gewählt und freigegeben. Gemeint war Emma. Auch eine Freigabe schützt nur, wenn man genau hinsieht." : "Der Agent hat geraten. Niemand hat rechtzeitig eingegriffen."}</div>`
              : stufe === 2 ? `<div class="fb ok"><div class="fb-title">✓ RICHTIG EINGETRAGEN</div>Rückfrage und Freigabe haben den Fehler verhindert. Aufwand für dich: zwei Klicks.</div>`
                : "";
    }
    reg.addEventListener("input", info);
    $("#au-start").addEventListener("click", lauf);
    notaus.addEventListener("click", () => { if (laeuft) { gestoppt = true; notaus.disabled = true; } });
    info();
  })();

  /* ---------------- LVL 3: Freigabe-Ermüdung ---------------- */
  (function ermuedung() {
    const root = $("#ermuedung");
    if (!root) return;
    const dialog = $("#er-dialog"), stand = $("#er-stand"), fazit = $("#er-fazit");
    let modus = "ids", runde, pos, entscheidungen, t0, zeiten;
    $$("#er-modus .btn").forEach(b => b.addEventListener("click", () => {
      modus = b.dataset.m;
      $$("#er-modus .btn").forEach(x => x.classList.toggle("sel", x === b));
      start();
    }));
    function start() {
      runde = S.ermuedungsRunde(); pos = 0; entscheidungen = []; zeiten = [];
      fazit.innerHTML = "";
      $("#er-liste").innerHTML = `<thead><tr><th>Name</th><th>Fach</th><th>Note</th></tr></thead><tbody>` +
        runde.notenliste.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.fach)}</td><td>${komma(x.note)}</td></tr>`).join("") + "</tbody>";
      zeige();
    }
    function zeige() {
      if (pos >= runde.freigaben.length) return ende();
      const f = runde.freigaben[pos];
      const args = { schueler_id: f.schueler_id, kurs_id: f.kurs_id, note: f.note, art: f.art };
      dialog.innerHTML = modus === "ids"
        ? `<p class="fq">⚠ <strong>FREIGABE NÖTIG:</strong> Agent 'notenverwalter' möchte 'add_grade' aufrufen mit</p><pre>${hlJson(JSON.stringify(args, null, 2))}</pre>`
        : `<p class="fq">👤 <strong>Freigabe nötig</strong></p><p>Soll <strong>${esc(f.name)}</strong> (7a) im Fach <strong>${esc(f.fach)}</strong> die Note <strong>${komma(f.note)}</strong> (${esc(f.art)}) bekommen?</p>`;
      dialog.insertAdjacentHTML("beforeend", `<div class="row"><button class="btn small" data-j>Erlauben [j]</button><button class="btn ghost small" data-n>Ablehnen [n]</button></div>`);
      stand.textContent = `Freigabe ${pos + 1} von ${runde.freigaben.length}`;
      t0 = performance.now();
      $("[data-j]", dialog).addEventListener("click", () => entscheide(true));
      $("[data-n]", dialog).addEventListener("click", () => entscheide(false));
      $("[data-j]", dialog).focus({ preventScroll: true });
    }
    function entscheide(ja) { zeiten.push(performance.now() - t0); entscheidungen.push(ja); pos++; zeige(); }
    function ende() {
      const f = runde.freigaben[runde.falsch];
      const erwischt = entscheidungen[runde.falsch] === false;
      const unnoetig = entscheidungen.filter((j, i) => !j && i !== runde.falsch).length;
      const schnitt = zeiten.reduce((a, b) => a + b, 0) / zeiten.length / 1000;
      dialog.innerHTML = `<p class="fq">Alle ${runde.freigaben.length} Freigaben bearbeitet.</p><button class="btn small" id="er-neu">Neue Runde</button>`;
      $("#er-neu").addEventListener("click", start);
      stand.textContent = "";
      fazit.innerHTML = `<div class="fb ${erwischt ? "ok" : "no"}"><div class="fb-title">${erwischt ? "✓ FEHLER ERKANNT" : "✗ FEHLER DURCHGEWUNKEN"}</div>
        Freigabe ${runde.falsch + 1} war falsch: ${esc(f.grund)}
        <br>Du hast im Schnitt <strong>${schnitt.toFixed(1).replace(".", ",")} s</strong> pro Freigabe gebraucht${unnoetig ? ` und ${unnoetig} richtige Einträge abgelehnt` : ""}.
        ${modus === "ids" ? "<br><strong>Probiere jetzt die Anzeige mit Namen.</strong> Mit IDs kann man kaum prüfen, wer gemeint ist." : "<br>Mit Namen ist Prüfen möglich, aber nur, wenn man bei jeder Freigabe wirklich hinsieht."}</div>`;
    }
    start();
  })();

  /* ---------------- LVL 4: Team-Baukasten ---------------- */
  (function team() {
    const root = $("#team");
    if (!root) return;
    const A = S.TEAM_AGENTEN, R = S.TEAM_RECHTE;
    const ICON = { "koordinator": "🧭", "datenbank-analyst": "🔎", "pruefer": "✅", "berichtsautor": "✍️" };
    let cfg = JSON.parse(JSON.stringify(S.TEAM_VORSCHLAG));
    const m = $("#tm-matrix");
    function render() {
      m.innerHTML = `<thead><tr><th>Agent</th>${R.map(r => `<th><code>${r}</code></th>`).join("")}</tr></thead><tbody>` +
        A.map(a => `<tr><th>${ICON[a]} ${a}</th>${R.map(r => `<td><input type="checkbox" data-a="${a}" data-r="${r}" ${cfg[a].includes(r) ? "checked" : ""} aria-label="${a}: ${r}"></td>`).join("")}</tr>`).join("") + "</tbody>";
      pruefen();
    }
    function pruefen() {
      $("#tm-check").innerHTML = S.teamPruefen(cfg).map(([c, t]) => `<div class="${c}">${c === "bad" ? "✗ " : c === "warn" ? "⚠ " : ""}${esc(t)}</div>`).join("");
    }
    m.addEventListener("change", e => {
      const { a, r } = e.target.dataset;
      cfg[a] = e.target.checked ? [...cfg[a], r] : cfg[a].filter(x => x !== r);
      pruefen();
    });
    $("#tm-vorschlag").addEventListener("click", () => { cfg = JSON.parse(JSON.stringify(S.TEAM_VORSCHLAG)); render(); });
    $("#tm-alles").addEventListener("click", () => { A.forEach(a => { cfg[a] = R.slice(); }); render(); });
    let gen = 0;
    $("#tm-run").addEventListener("click", async () => {
      const meins = ++gen;
      const erg = S.teamLauf(cfg, { stillePost: $("#tm-stille").checked });
      const logEl = $("#tm-log");
      logEl.innerHTML = ""; $("#tm-tokens").innerHTML = ""; $("#tm-fazit").innerHTML = "";
      $("#tm-run").disabled = true;
      for (const z of erg.zeilen) {
        if (meins !== gen) return;
        logAn(logEl, z.wer, z.text, z.tiefe);
        await warte(220);
      }
      $("#tm-run").disabled = false;
      const v = erg.verbrauch;
      const summe = Object.values(v).reduce((s, x) => s + x.ein + x.aus, 0);
      const einzel = erg.einzel.ein + erg.einzel.aus;
      const max = Math.max(summe, einzel);
      const bar = n => `<i class="tk-bar" style="width:${Math.round(n / max * 100)}%"></i>`;
      $("#tm-tokens").innerHTML = `<thead><tr><th>Agent</th><th>Aufrufe</th><th>Tokens rein</th><th>raus</th></tr></thead><tbody>` +
        Object.entries(v).map(([a, x]) => `<tr><th>${ICON[a] || ""} ${a}</th><td>${x.aufrufe}</td><td>${x.ein}</td><td>${x.aus}</td></tr>`).join("") +
        `<tr class="tk-sum"><th>Team gesamt</th><td>${Object.values(v).reduce((s, x) => s + x.aufrufe, 0)}</td><td colspan="2">${summe} ${bar(summe)}</td></tr>` +
        `<tr class="tk-sum"><th>zum Vergleich: Analyst allein</th><td>${erg.einzel.aufrufe}</td><td colspan="2">${einzel} ${bar(einzel)}</td></tr></tbody>`;
      $("#tm-fazit").innerHTML = `<p class="readout">Das Team brauchte etwa das <strong>${(summe / einzel).toFixed(1).replace(".", ",")}-fache</strong> an Tokens (Schätzung: 4 Zeichen ≈ 1 Token, 70 Tokens pro Tool).</p>` +
        erg.fazit.map(([c, t]) => `<div class="fb ${c === "good" ? "ok" : "no"} ${c === "warn" ? "warnfb" : ""}">${esc(t)}</div>`).join("");
    });
    render();
  })();

  /* ---------------- LVL 5: Agenten-Designer ---------------- */
  (function designer() {
    const root = $("#designer");
    if (!root) return;
    const name = $("#ds-name"), beschr = $("#ds-beschr"), fragen = $("#ds-fragen"), max = $("#ds-max"), prompt = $("#ds-prompt"), vorlage = $("#ds-vorlage");
    const toolsEl = $("#ds-tools-wahl"), delEl = $("#ds-del");
    toolsEl.innerHTML = S.TOOLS.map(t => `<label class="ds-tool"><code>${t.name}</code><select data-tool="${t.name}" aria-label="${t.name}">
      <option value="">– nicht erlaubt</option><option value="tools">tools (ohne Nachfrage)</option><option value="frei">tools_mit_freigabe</option></select></label>`).join("");
    delEl.innerHTML = Object.keys(S.DEFS).map(n => `<label><input type="checkbox" value="${n}"> ${n}</label>`).join("");
    vorlage.innerHTML = `<option value="neu">eigener Agent: statistiker</option>` + Object.keys(S.DEFS).map(n => `<option value="${n}">${n}</option>`).join("");
    const NEU = {
      name: "statistiker", beschreibung: "Ermittelt Notenverteilungen (wie viele 1er, 2er …) für eine Klasse und ein Fach. Nur lesend.",
      tools: ["describe_table", "query_database"], tools_mit_freigabe: [], mensch_fragen: false, delegiert_an: [], max_schritte: 8,
      system_prompt: "Du bist Statistiker für die Schul-Datenbank.\nZähle für die genannte Klasse und das Fach, wie oft jede Note vorkommt.\nErfinde keine Zahlen. Gib die verwendeten SQL-Abfragen mit an."
    };
    function laden(d) {
      name.value = d.name; beschr.value = d.beschreibung; fragen.checked = d.mensch_fragen; max.value = d.max_schritte; prompt.value = d.system_prompt;
      $$("select", toolsEl).forEach(s => { const t = s.dataset.tool; s.value = d.tools.includes(t) ? "tools" : d.tools_mit_freigabe.includes(t) ? "frei" : ""; });
      $$("input", delEl).forEach(c => { c.checked = d.delegiert_an.includes(c.value); });
      update();
    }
    function lesen() {
      return {
        name: name.value.trim(), beschreibung: beschr.value.trim().replace(/\s+/g, " "),
        tools: $$("select", toolsEl).filter(s => s.value === "tools").map(s => s.dataset.tool),
        tools_mit_freigabe: $$("select", toolsEl).filter(s => s.value === "frei").map(s => s.dataset.tool),
        mensch_fragen: fragen.checked, delegiert_an: $$("input:checked", delEl).map(c => c.value),
        max_schritte: parseInt(max.value, 10), system_prompt: prompt.value.trim()
      };
    }
    function update() {
      const d = lesen();
      $("#ds-check").innerHTML = S.definitionPruefen(d).map(([c, t]) => `<div class="${c}">${c === "bad" ? "✗ " : c === "warn" ? "⚠ " : ""}${esc(t)}</div>`).join("");
      $("#ds-md").innerHTML = hlMd(S.definitionAlsMarkdown(d));
      $("#ds-cc").innerHTML = hlMd(S.alsClaudeCodeSubagent(d));
      const sicht = S.toolsFuer({ ...d, delegiert_an: d.delegiert_an.filter(x => S.DEFS[x]) });
      $("#ds-sieht").textContent = `System-Prompt:\n${S.systemPrompt(d)}\n\nTools, die das LLM sieht:\n${sicht.map(toolZeile).join("\n") || "(keine)"}`;
      $("#ds-datei").textContent = `agenten/definitionen/${d.name || "name"}.md`;
      $("#ds-datei-cc").textContent = `.claude/agents/${d.name || "name"}.md`;
    }
    [name, beschr, fragen, max, prompt].forEach(e => e.addEventListener("input", update));
    toolsEl.addEventListener("change", update); delEl.addEventListener("change", update);
    vorlage.addEventListener("change", () => laden(vorlage.value === "neu" ? NEU : S.DEFS[vorlage.value]));
    $$("#designer .tabs .btn").forEach(b => b.addEventListener("click", () => {
      $$("#designer .tabs .btn").forEach(x => x.classList.toggle("sel", x === b));
      $$("#designer .ds-out").forEach(o => { o.hidden = o.dataset.tab !== b.dataset.tab; });
    }));
    laden(NEU);
  })();

  /* ---------------- Clearance-Tests ---------------- */
  const norm = s => String(s).toLowerCase().replace(/\s+/g, "");
  $$(".test").forEach(box => {
    const lvl = +box.dataset.level;
    box.id = `lvl${lvl}-test`;
    const pool = window.TESTS[lvl];
    let queue = [], streak = 0;

    const next = () => {
      if (!queue.length) queue = shuffle(pool.map((_, i) => i));
      const item = pool[queue.pop()];
      return typeof item === "function" ? item() : item;
    };
    const leds = () => `<div class="streak" aria-label="${streak} von ${STREAK_GOAL}">${Array.from({ length: STREAK_GOAL }, (_, i) => `<i class="${i < streak ? "on" : ""}"></i>`).join("")}</div>`;
    const head = sub => `<div class="test-head"><h3>Clearance-Test · LVL ${lvl}</h3>${leds()}</div>${sub || ""}`;

    function intro() {
      streak = 0;
      if (isCleared(lvl)) {
        box.innerHTML = head() + `<div class="test-done"><p class="big">GURT ${lvl} ANGELEGT ✓</p>
          <p>Clearance <strong>${LEVELS[lvl]}</strong> erreicht.</p>
          <div class="row" style="justify-content:center"><button class="btn ghost" data-start>Nochmal üben</button>${nextLink()}</div></div>`;
      } else {
        box.innerHTML = head(`<p>Beantworte <strong>${STREAK_GOAL} Fragen in Folge</strong> richtig, um Gurt ${lvl} anzulegen.
          Ein Fehler setzt den Zähler zurück, aber du bekommst eine Erklärung.</p>
          <button class="btn" data-start>Test starten ▸</button>`);
      }
      $("[data-start]", box).addEventListener("click", ask);
    }
    function nextLink() {
      return lvl < LEVELS.length - 1 ? `<a class="btn next-link" href="lvl${lvl + 1}.html">Weiter zu LVL ${lvl + 1} ▸</a>` : `<a class="btn next-link" href="index.html#online">Zum Abschluss ▸</a>`;
    }

    function ask() {
      const q = next();
      box.innerHTML = head(`<p class="q-text">${q.q}</p>${q.code ? `<pre class="${q.lang || "json"}">${hl(q.lang, q.code)}</pre>` : ""}<div class="answer"></div><div class="fb-wrap"></div>`);
      const ans = $(".answer", box);
      if (q.input) {
        ans.innerHTML = `<div class="q-input"><input type="text" spellcheck="false" autocomplete="off" aria-label="Antwort"><button class="btn">Prüfen</button></div>`;
        const inp = $("input", ans), btn = $("button", ans);
        const go = () => {
          if (!inp.value.trim()) return;
          inp.disabled = btn.disabled = true;
          resolve(q.accept.some(a => norm(a) === norm(inp.value)), q, `Richtig wäre: <code>${esc(q.accept[0])}</code>. `);
        };
        btn.addEventListener("click", go);
        inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        inp.focus({ preventScroll: true });
      } else {
        const order = shuffle(q.opts.map((_, i) => i));
        ans.innerHTML = `<div class="opts">${order.map(i => `<button class="opt" data-i="${i}">${q.opts[i]}</button>`).join("")}</div>`;
        $$(".opt", ans).forEach(b => b.addEventListener("click", () => {
          const right = b.dataset.i === "0";
          $$(".opt", ans).forEach(x => { x.disabled = true; if (x.dataset.i === "0") x.classList.add("right"); });
          if (!right) b.classList.add("wrong");
          resolve(right, q, "");
        }));
      }
    }

    function resolve(right, q, solution) {
      streak = right ? streak + 1 : 0;
      $(".streak", box).outerHTML = leds();
      const fb = $(".fb-wrap", box);
      if (right && streak >= STREAK_GOAL) {
        const first = !isCleared(lvl);
        if (first) { progress.cleared.push(lvl); save(); }
        fb.innerHTML = `<div class="fb ok"><div class="fb-title">✓ KORREKT</div>${q.explain}</div>`;
        setTimeout(() => {
          toast(`GURT ${lvl} ANGELEGT · ${LEVELS[lvl]}`);
          refreshProgressUI(); intro();
          if (first && progress.cleared.length === LEVELS.length) setTimeout(() => { location.href = "index.html#online"; }, 1500);
        }, 900);
        return;
      }
      fb.innerHTML = right
        ? `<div class="fb ok"><div class="fb-title">✓ KORREKT · ${streak}/${STREAK_GOAL}</div>${q.explain}</div>`
        : `<div class="fb no"><div class="fb-title">✗ HARNESS BLOCKIERT · Zähler zurückgesetzt</div>${solution}${q.explain}</div>`;
      fb.insertAdjacentHTML("beforeend", `<div class="row"><button class="btn">Nächste Frage ▸</button></div>`);
      const btn = $(".row .btn", fb);
      btn.addEventListener("click", ask);
      btn.focus({ preventScroll: true });
      if (!right) { box.classList.remove("glitch-flash"); void box.offsetWidth; box.classList.add("glitch-flash"); }
    }
    intro();
  });

  /* ---------------- Reset ---------------- */
  $("#reset-progress").addEventListener("click", () => {
    if (!confirm("Gesamten Fortschritt (alle angelegten Gurte) löschen?")) return;
    progress.cleared = []; save(); location.reload();
  });

  refreshProgressUI();
  // Abschluss ist erst nach refreshProgressUI sichtbar, daher Sprungziel nachholen
  if (location.hash === "#online" && $("#online") && !$("#online").hidden) $("#online").scrollIntoView();
})();
