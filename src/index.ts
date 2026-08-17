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
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
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

async function render(source: string, theme?: PluginThemeContext): Promise<string> {
  if (theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: themeVariablesFrom(theme),
    });
  }
  const { svg } = await mermaid.render(
    `mermaid-diagram-${++renderCount}`,
    stripInitDirectives(source),
  );
  return svg;
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

export default { render, export: exportDiagram, getExportRepresentations };
