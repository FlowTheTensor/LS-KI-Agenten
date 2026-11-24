/* Graphen im Stil von LangGraphs draw_mermaid() zeichnen (LVL 1 Station 5, LVL 4).
   Erwartet die Mermaid-Bibliothek (CDN). Fehlt sie (offline), bleibt der Mermaid-Text sichtbar.
   Lizenz: CC BY 4.0 – Christoph Rothaug, Jakob-Preh-Schule Bad Neustadt */
(function () {
  if (!window.mermaid || !document.querySelector(".gr-mermaid pre.mermaid")) return;
  mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict", flowchart: { curve: "linear", nodeSpacing: 18, rankSpacing: 40, padding: 8 } });
  mermaid.run({ querySelector: ".gr-mermaid pre.mermaid" });
})();
