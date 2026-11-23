# KI-Agenten – Geschirr für den Kern
# [Starten](https://flowthetensor.github.io/LS-KI-Agenten/)
Interaktive Lernseite zu **KI-Agenten**, **Harness**, **Mensch-Maschine-Schnittstellen** und **Multiagentensystemen**.
Für Fachschülerinnen und Fachschüler (Elektrotechnik, Schwerpunkt KI) und für Lehrkräfte, die sich in Agenten und Protokolle wie MCP, A2A und A2UI einarbeiten möchten.

Fortsetzung von [MCP – USB für KI](https://flowthetensor.github.io/LS-MCP-USB-fuer-KI/). Dort endet die Geschichte mit „SYSTEM ONLINE“: Der KI-Kern ist verbunden.
Hier bekommt er sein **Geschirr**. Leitbild ist **Pferd – Geschirr – Kutscher**: Das LLM liefert die Kraft, der Harness lenkt und begrenzt sie, der Mensch hält die Zügel.
Die MCP-LS wird empfohlen, ist aber keine Voraussetzung. Wurde sie im selben Browser abgeschlossen, zeigt die Startseite das an.

| Level | Thema | Interaktiv |
|---|---|---|
| LVL 0 // UNGEZÄHMT | LLM ohne Harness: kann nichts ausführen, merkt sich nichts. Bausteine, Schichtenmodell | „Was sieht das LLM?“: Kontext mit und ohne Verlauf, Token-Schätzung |
| LVL 1 // SCHLEIFE | Agenten-Schleife, Minimal-Agent (Code lesen), Workflow oder Agent | Schleife Schritt für Schritt mit Protokoll, Sortierer Workflow/Agent |
| LVL 2 // GESCHIRR | Aufgaben des Harness, `_fuehre_aus()` (Code lesen), Rechte im Code statt im Prompt, Prompt Injection, Verteidigung in der Tiefe, ein Harness – viele Gehirne | **Du bist das LLM** gegen einen simulierten Harness, Sicherheits-Labor mit vier Schutzschichten |
| LVL 3 // ZÜGEL | Schnittstellen S0–S5, Autonomiestufen 0–4, Freigabe-Ermüdung, MCP Apps vs. A2UI, Verantwortung | Autonomie-Regler mit Rückfrage, Freigabe und Not-Aus, Freigabe-Ermüdung (IDs vs. Namen) |
| LVL 4 // GESPANN | Multiagentensysteme, Agent als Tool (`delegiere_an_…`), Muster, Vor- und Nachteile, **A2A** (Agent Card, Tasks) | Team-Baukasten: Rechte verteilen, Lauf simulieren, Tokenkosten und stille Post |
| LVL 5 // KUTSCHER | Agenten-Definitionen, Praxis-Repo, n8n, Claude Code mit Subagenten | Agenten-Designer (Definitionsdatei + Claude-Code-Subagent + „Das sieht das LLM“) |

Jedes Level endet mit einem **Clearance-Test**: 5 richtige Antworten in Folge (Fragen teils zufällig erzeugt, darunter Fragen zu Code-Ausschnitten).
Wer alle sechs Tests besteht, sieht auf der Startseite den Abschluss „GESPANN STARTKLAR“.
Der Fortschritt wird nur im `localStorage` des Browsers gespeichert (Schlüssel `ls-ki-agenten:v1`). Es gibt keine Anmeldung, keinen Server und keinen API-Schlüssel.

## Praxis-Repo

Alles, was die Lernseite im Browser simuliert, läuft echt im Projekt [SQLite-per-MCP](https://github.com/FlowTheTensor/SQLite-per-MCP), Teil 2 (`agenten/`):
ein Harness in Python, in dem jede Zeile lesbar ist, mit `--modell mensch` (du spielst das LLM), `ollama` oder `anthropic`, dazu n8n als zweiter Harness.
Die Simulation verwendet dieselben Protokoll-Etiketten (`[MENSCH ]`, `[HARNESS]`, `[LLM    ]`, `[MCP    ]`, `[AGENT  ]`, `[FEHLER ]`), dieselben Agenten-Definitionen und dieselbe Rechteprüfung wie `agenten/harness/harness.py`.
Die Lernseite verlinkt auf den Branch `main` des Praxis-Repos.

## Aufbau

```text
index.html       Startseite: Leitbild, Schaltbild mit sechs Gurten, Level-Übersicht, Abschluss
lvl0–lvl5.html   je eine Seite pro Level
css/style.css    Design (übernommen aus der MCP-LS und erweitert)
js/farbschema.js Schalter hell/dunkel (gleich in allen Lernsituationen)
js/agentsim.js   Simulation: Beispiel-Datenbank, Mini-SQL, MCP-Tools, Agenten-Definitionen,
                 nachgebauter Harness (SimHarness) und die Szenarien der Widgets
js/tests.js      Fragenpools der Clearance-Tests (leicht erweiterbar)
js/app.js        Navigation, Widgets, Test-Logik
img/             Bilder und BILD-PROMPTS.md
```

**Eigene Fragen ergänzen:** In `js/tests.js` ein Objekt in den Pool des Levels einfügen. Bei Multiple Choice ist die **erste** Option immer die richtige,
die Reihenfolge wird automatisch gemischt. Mit `code` und `lang` (`"py"`, `"md"`, `"log"`, sonst JSON) lässt sich ein Code-Ausschnitt zur Frage anzeigen.

**Simulation testen:** `js/agentsim.js` läuft auch in Node, z. B.

```powershell
node -e "const S=require('./js/agentsim.js'); console.log(S.mcpAufruf(S.neueDB(),'query_database',{query:\"SELECT COUNT(*) FROM schueler WHERE klasse = '7a'\"}))"
```

### Bilder in `img/`

Die Bilder werden mit ChatGPT erzeugt. Die Prompts stehen in [`img/BILD-PROMPTS.md`](img/BILD-PROMPTS.md). Fehlt ein Bild, zeigt die Seite an seiner Stelle einen Platzhalter mit dem Dateinamen.

| Datei | Verwendung |
|---|---|
| `hero.png` | Startseite oben |
| `lvl0-ungezaehmt.png` … `lvl5-kutscher.png` | Banner der sechs Level-Seiten |
| `gespann-startklar.png` | Abschluss auf der Startseite |
| `og-image.png` | Vorschaubild beim Teilen des Links |
| `logoschulecyber-klein.png` | Schullogo als angepinnter Zettel oben rechts (verlinkt auf [bsnes.de](https://www.bsnes.de)) |
| `favicon.svg` | Symbol im Browser-Tab |

## Veröffentlichen mit GitHub Pages

1. Im Ordner ein Git-Repository anlegen (Branch `main`) und auf GitHub ein neues, **leeres**, öffentliches Repository `LS-KI-Agenten` anlegen (ohne README).
2. Verbinden und hochladen:

   ```powershell
   git remote add origin https://github.com/FlowTheTensor/LS-KI-Agenten.git
   git push -u origin main
   ```

3. Im Repository: **Settings → Pages → Build and deployment → Source: „Deploy from a branch“**, Branch `main`, Ordner `/ (root)`, speichern.
4. Nach ein bis zwei Minuten ist die Seite erreichbar unter `https://flowthetensor.github.io/LS-KI-Agenten/`.

Lokal testen: einfach `index.html` im Browser öffnen, oder `python -m http.server` im Ordner starten und `http://localhost:8000` aufrufen.

## Quellen

- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (Anthropic)
- [MCP-Spezifikation](https://modelcontextprotocol.io/specification)
- [A2A-Protokoll](https://a2a-protocol.org)
- [A2UI](https://github.com/google/A2UI)
- [SQLite-per-MCP, Teil 2: Agenten](https://github.com/FlowTheTensor/SQLite-per-MCP/blob/main/agenten/README.md)

## Farbschema hell/dunkel

Der runde Knopf mit Mond/Sonne oben rechts schaltet zwischen hellem und dunklem Schema um. Die Wahl wird im Browser gespeichert (`localStorage`, Schlüssel `jps-lernsituationen-farbschema`) und gilt für alle Lernsituationen der Jakob-Preh-Schule. Ohne gespeicherte Wahl gilt das dunkle Terminal-Design. Umgesetzt in `js/farbschema.js`; die Farben stehen als CSS-Variablen in der Stylesheet-Datei.

## Lizenz

[![CC BY 4.0](https://img.shields.io/badge/Lizenz-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/deed.de)

**KI-Agenten – Geschirr für den Kern** von **Christoph Rothaug, Jakob-Preh-Schule Bad Neustadt**, steht unter der Lizenz [Creative Commons Namensnennung 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.de). Der vollständige Lizenztext steht in der Datei [`LICENSE`](LICENSE).

Du darfst das Material (Quellcode, Texte, Aufgaben und Grafiken) kopieren, weitergeben und verändern, auch kommerziell. Dafür musst du

- den Urheber nennen: *Christoph Rothaug, Jakob-Preh-Schule Bad Neustadt*,
- auf die Lizenz verlinken: <https://creativecommons.org/licenses/by/4.0/deed.de>,
- angeben, ob du etwas verändert hast.

Vorschlag für die Namensnennung: *„KI-Agenten – Geschirr für den Kern“ von Christoph Rothaug, Jakob-Preh-Schule Bad Neustadt, CC BY 4.0, https://github.com/FlowTheTensor/LS-KI-Agenten*

Die übrigen Bilder in `img/` (`hero.png`, `lvl*-*.png`, `gespann-startklar.png`, `og-image.png`) sind KI-generiert und stehen ebenfalls unter CC BY 4.0.

**Ausgenommen** von dieser Lizenz sind:

| Bestandteil | Rechte |
|---|---|
| `img/logoschulecyber-klein.png` | Logo der Jakob-Preh-Schule – alle Rechte bei der Schule |
| Schriften JetBrains Mono, Orbitron, Space Grotesk | über Google Fonts eingebunden, SIL Open Font License 1.1 |
