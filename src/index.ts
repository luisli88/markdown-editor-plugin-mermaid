import mermaid from "mermaid";

// Plugin de primera parte (research.md R4/R9) — mismo contrato exacto que
// cualquier plugin de terceros (contracts/plugin-contract.md), sin camino de
// código especial. Se empaqueta (bundlea) con la librería `mermaid` incluida
// para que el sandbox nunca necesite red al ejecutarlo (FR-024).

/**
 * Mismo shape que `PluginThemeContext` de `@markdown-editor/plugin-sdk` — no
 * se declara como dependencia de npm (ese paquete es privado al monorepo,
 * sin publicar); el contrato completo está documentado en el `README.md` de
 * `plugin-sdk` (github.com/luisli88/MarkdownEditor).
 */
interface PluginThemeContext {
  mode: "light" | "dark";
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
}

/** Mismo shape que `SyntaxGrammar` de `@markdown-editor/plugin-sdk` — ver nota de `PluginThemeContext` arriba sobre por qué no se importa el paquete. */
interface SyntaxGrammar {
  caseInsensitive?: boolean;
  keywords?: Record<string, string>;
  comment?: { begin: string; end: string };
  quoteStrings?: boolean;
  contains?: Array<{ className: string; begin: string; end?: string }>;
}

// Paleta de marca ("Ideas El Gato Sin Botas" v1.0.0 — design/design-reference.md)
// en vez del morado por defecto de Mermaid — fallback usado solo cuando
// `render()` no recibe `theme` (host sin theming, o una primera llamada
// antes de que exista un tema activo).
//
// Sin `fontFamily` a propósito (revisado tras pruebas de usuario: texto
// cortado en las tablas de ER diagram) — Mermaid mide el texto para calcular
// cajas DENTRO de este mismo sandbox (CSP `default-src 'none'`, sin fuentes
// externas), pero el SVG se pinta después en la página principal, que sí
// puede tener otra fuente disponible. Pedir una fuente que el sandbox no
// puede cargar hace que la medición (sandbox) y el pintado (página
// principal) usen anchos distintos, y el texto termina desbordando su caja.
// Sin este campo, cae al default de Mermaid
// (`"trebuchet ms", verdana, arial, sans-serif`), disponible en ambos lados.
// `htmlLabels: false` (default de Mermaid es `true`) — con `true`, cada
// etiqueta de texto se emite como `<foreignObject><div>...</div></foreignObject>`
// dentro del SVG. El host (`plugin-block-view.tsx`/`diagram-edit-mode.ts`)
// sanitiza el `render()` de cualquier plugin con DOMPurify antes de
// insertarlo en su propio documento — DOMPurify vacía el contenido de
// `foreignObject` por diseño (protección deliberada contra un vector de XSS
// conocido, sin override seguro), así que con `htmlLabels: true` el texto de
// cada etiqueta desaparecería. `false` hace que Mermaid emita `<text>`/`<tspan>`
// SVG nativo en su lugar, que DOMPurify preserva sin problema.
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  htmlLabels: false,
  themeVariables: {
    primaryColor: "#F0F2FA",
    primaryTextColor: "#0F1520",
    primaryBorderColor: "#334A99",
    lineColor: "#64718A",
    secondaryColor: "#ECF0F8",
    tertiaryColor: "#F8F9FC",
  },
});

let renderCount = 0;

/**
 * Mapea los 8 slots genéricos de `PluginThemeContext` a los `themeVariables`
 * propios de Mermaid.
 *
 * `background` (revisado tras pruebas de usuario: texto de ejes/títulos
 * ilegible en diagramas XY chart/gitGraph/journey con temas oscuros) es una
 * variable de Mermaid separada de `primaryColor`/`tertiaryColor` — varios
 * tipos de diagrama (`xyChart.backgroundColor`, fondos de sección en
 * gitGraph/journey) caen a ella, no a las de arriba, así que sin
 * sobreescribirla quedaba fija en el gris claro por defecto de Mermaid
 * (`#f4f4f4`) sin importar el tema.
 *
 * `attributeBackgroundColorOdd`/`Even` (ER diagram, filas de atributos de
 * cada entidad) son otro caso igual: Mermaid las deja fijas en blanco/gris
 * clarísimo por defecto, sin caer a ningún otro themeVariable.
 */
function themeVariablesFrom(theme: PluginThemeContext): Record<string, string> {
  return {
    background: theme.background,
    primaryColor: theme.surface,
    primaryTextColor: theme.text,
    primaryBorderColor: theme.accent,
    lineColor: theme.textMuted,
    secondaryColor: theme.surfaceMuted,
    tertiaryColor: theme.background,
    attributeBackgroundColorOdd: theme.surface,
    attributeBackgroundColorEven: theme.surfaceMuted,
  };
}

/**
 * Cualquier `%%{init}%%`/`%%{initialize}%%` que el propio `source` del
 * diagrama traiga (ej. una nota de referencia de sintaxis Mermaid que lo
 * incluye como EJEMPLO de contenido — caso real observado) se neutraliza
 * antes de renderizar: el tema de la app, aplicado abajo vía
 * `mermaid.initialize()`, debe ganar siempre para mantenerse "congruente por
 * construcción" con el resto de la app — nunca un directive suelto que
 * traiga el contenido del diagrama.
 */
const INIT_DIRECTIVE_PATTERN = /%%\{\s*init(?:ialize)?\s*:[\s\S]*?\}%%/g;

function stripInitDirectives(source: string): string {
  return source.replace(INIT_DIRECTIVE_PATTERN, "");
}

/**
 * Un `<svg>` embebido en HTML es `display: inline` por defecto (misma
 * herencia que una `<img>`) — sin esto se alineaba con el texto circundante
 * en vez de quedar centrado como bloque. El host no sabe que este plugin en
 * particular devuelve un `<svg>` (recibe un string de HTML genérico), así
 * que esta presentación por defecto es responsabilidad del propio plugin,
 * no del host. Vive en `getStylesheet()` — el host la inyecta como un
 * `<style>` propio, aparte del HTML que devuelve `render()` (nunca mezclada
 * en ese string), dentro del shadow root donde monta este plugin.
 */
function getStylesheet(): string {
  return "svg{display:block;margin:auto;}";
}

async function render(source: string, theme?: PluginThemeContext): Promise<string> {
  if (theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      htmlLabels: false,
      themeVariables: themeVariablesFrom(theme),
    });
  }
  const { svg } = await mermaid.render(
    `mermaid-diagram-${++renderCount}`,
    stripInitDirectives(source),
  );
  return svg;
}

/** Mismo shape que `PluginEditorSession` de `@markdown-editor/plugin-sdk` — ver nota de `PluginThemeContext` arriba sobre por qué no se importa el paquete. */
interface PluginEditorSession {
  destroy(): void;
}

/** Mismo shape que `PluginEditorMountOptions` de `@markdown-editor/plugin-sdk`. */
interface PluginEditorMountOptions {
  container: HTMLElement;
  initialSource: string;
  theme?: PluginThemeContext;
  onCommit: (newSource: string) => void;
}

const EDITOR_DEBOUNCE_MS = 300;

/**
 * v1 de `mountEditor` — reproduce el layout del editor genérico del host
 * (split apilado, código arriba/preview debajo, mismo debounce/atajos de
 * commit: Escape/Cmd+Enter/blur confirman, Tab inserta un tab real), ahora
 * dueño de su propio DOM/CSS dentro de este sandbox en vez del `editor.css`
 * del host.
 *
 * Sin overlay de resaltado de sintaxis (a diferencia del genérico): ese
 * truco (`diagram-edit-mode.ts`, host) depende de tokens de spacing/fuente
 * que `PluginThemeContext` deliberadamente no expone (son detalle del
 * chrome del host, no del tema) — reimplementar un mini-resaltador acá sería
 * una duplicación desproporcionada para esta primera versión; un
 * `<textarea>` con texto real alcanza para editar cómodo.
 */
function mountEditor(options: PluginEditorMountOptions): PluginEditorSession {
  const theme = options.theme;
  const colors = {
    surface: theme?.surface ?? "#f0f2fa",
    surfaceMuted: theme?.surfaceMuted ?? "#ecf0f8",
    text: theme?.text ?? "#0f1520",
    border: theme?.border ?? "#334a99",
  };

  const style = document.createElement("style");
  style.textContent = `
    html, body { margin: 0; height: 100%; background: transparent; }
    .mermaid-edit-mode {
      display: grid;
      grid-template-rows: auto auto;
      gap: 12px;
      height: 100%;
      box-sizing: border-box;
      padding: 4px;
      font-family: -apple-system, "Segoe UI", sans-serif;
    }
    .mermaid-edit-code-pane {
      background: ${colors.surfaceMuted};
      border: 2px solid ${colors.border};
      border-radius: 8px;
      min-height: 160px;
    }
    .mermaid-edit-textarea {
      width: 100%;
      height: 100%;
      min-height: 160px;
      box-sizing: border-box;
      resize: vertical;
      border: none;
      outline: none;
      background: transparent;
      color: ${colors.text};
      font-family: "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 14px;
      line-height: 1.5;
      tab-size: 4;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      padding: 16px;
    }
    .mermaid-edit-preview-pane {
      background: ${colors.surface};
      border-radius: 8px;
      padding: 16px;
      overflow: auto;
    }
    .mermaid-edit-preview-pane.error {
      background: #3a1d1d;
    }
    .mermaid-edit-error-panel {
      color: #ef4444;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "mermaid-edit-mode";

  const codePane = document.createElement("div");
  codePane.className = "mermaid-edit-code-pane";
  const textarea = document.createElement("textarea");
  textarea.className = "mermaid-edit-textarea";
  textarea.value = options.initialSource;
  textarea.spellcheck = false;
  codePane.appendChild(textarea);

  const previewPane = document.createElement("div");
  previewPane.className = "mermaid-edit-preview-pane";

  root.append(codePane, previewPane);
  options.container.appendChild(root);
  textarea.focus();

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let renderToken = 0;

  function renderPreview(source: string): void {
    const currentToken = ++renderToken;
    render(source, theme)
      .then((svg) => {
        if (currentToken !== renderToken) return;
        previewPane.classList.remove("error");
        previewPane.innerHTML = svg;
      })
      .catch((error: unknown) => {
        if (currentToken !== renderToken) return;
        previewPane.classList.add("error");
        previewPane.innerHTML = "";
        const panel = document.createElement("div");
        panel.className = "mermaid-edit-error-panel";
        panel.textContent = error instanceof Error ? error.message : String(error);
        previewPane.appendChild(panel);
      });
  }

  function scheduleRender(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderPreview(textarea.value), EDITOR_DEBOUNCE_MS);
  }

  renderPreview(options.initialSource);
  textarea.addEventListener("input", scheduleRender);

  function commit(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    options.onCommit(textarea.value);
  }

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      commit();
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commit();
    } else if (event.key === "Tab") {
      event.preventDefault();
      const { selectionStart, selectionEnd, value } = textarea;
      textarea.value = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
      textarea.selectionStart = selectionStart + 1;
      textarea.selectionEnd = selectionStart + 1;
      scheduleRender();
    }
  });
  textarea.addEventListener("blur", commit);

  return {
    destroy(): void {
      if (debounceTimer) clearTimeout(debounceTimer);
    },
  };
}

/**
 * Gramática de resaltado propia (antes vivía a mano dentro del monorepo host,
 * en `document-core/src/syntax/mermaid.ts` — movida acá para que agregar un
 * lenguaje nuevo de plugin no requiera tocar el core del editor). Cobertura
 * deliberadamente acotada al subconjunto que de verdad ayuda a leer un
 * diagrama mientras se edita — palabras clave de tipo de diagrama/dirección,
 * flechas/conectores, comentarios (`%%`) y strings — no un parser Mermaid
 * completo.
 */
const syntaxGrammar: SyntaxGrammar = {
  keywords: {
    keyword:
      "graph flowchart sequenceDiagram classDiagram stateDiagram stateDiagram-v2 erDiagram " +
      "gantt pie journey gitGraph mindmap quadrantChart timeline " +
      "subgraph end participant actor loop alt else opt par and rect " +
      "activate deactivate note title dateFormat section click link",
    literal: "TD TB LR RL BT",
  },
  comment: { begin: "%%", end: "$" },
  quoteStrings: true,
  contains: [
    {
      // Conectores/flechas — el mismo campo semántico que un operador en un
      // lenguaje de programación.
      className: "operator",
      begin: "(-->>|--?>>|<-{1,2}>|-\\.{1,2}->|={2,3}>|--[ox]|\\.\\.>|-{2,3}>|-{2,3}(?!>))",
    },
    {
      // Etiqueta de nodo/arista entre corchetes/paréntesis/llaves — ej.
      // `A[Inicio]`, `B(Proceso)`, `C{Decisión}`.
      className: "title",
      begin: "[[({][^\\]})]*[\\])}]",
    },
  ],
};

function getSyntaxGrammar(): SyntaxGrammar {
  return syntaxGrammar;
}

/** US8/FR-022: representaciones de exportación que este plugin ofrece — el panel de exportación las descubre dinámicamente (`export-panel.ts`). */
function getExportRepresentations(): Array<{ id: string; label: string }> {
  return [
    { id: "embedded", label: "Imagen embebida" },
    { id: "as-is", label: "Markdown tal cual" },
  ];
}

/** `"as-is"`: sin imagen — conserva el `source` tal cual en el Markdown exportado (FR-022). Cualquier otro valor (incluido `undefined`, plugins de terceros anteriores a US8) usa el comportamiento `"embedded"` ya existente. */
async function exportDiagram(
  source: string,
  representationId?: string,
): Promise<{ svg?: string; verbatim?: boolean }> {
  if (representationId === "as-is") return { verbatim: true };
  return { svg: await render(source) };
}

export default {
  render,
  export: exportDiagram,
  getExportRepresentations,
  getSyntaxGrammar,
  mountEditor,
  getStylesheet,
};
