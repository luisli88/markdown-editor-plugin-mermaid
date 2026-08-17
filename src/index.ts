import mermaid from "mermaid";

// Plugin de primera parte (research.md R4/R9) — mismo contrato exacto que
// cualquier plugin de terceros (contracts/plugin-contract.md), sin camino de
// código especial. Se empaqueta (bundlea) con la librería `mermaid` incluida
// para que el sandbox nunca necesite red al ejecutarlo (FR-024).
// Paleta de marca ("Ideas El Gato Sin Botas" v1.0.0 — design/design-reference.md)
// en vez del morado por defecto de Mermaid, para que los diagramas se sientan
// parte del mismo sistema visual que el resto de la app — este es solo el
// fallback inicial (antes de que un render real aplique su propio
// `%%{init}%%`, ver `applyInitDirective` más abajo y
// `computeMermaidStylePreset()` en `document-core/plugin-block-view.ts`).
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
 * `%%{init: {...}}%%` como prefijo del `source` (`computeMermaidStylePreset()`,
 * `document-core/plugin-block-view.ts`) es la única forma de pedir un tema
 * *por render* sin romper el contrato de plugin (`render(source): Promise<string>`,
 * sin un segundo parámetro para pasar config aparte). Revisado tras pruebas
 * de usuario (colores de diagrama que no seguían el tema activo, texto
 * ilegible) y confirmado empíricamente: una vez que `mermaid.initialize()`
 * corrió una vez (la llamada de más abajo, al cargar este módulo), Mermaid
 * ignora en silencio cualquier `%%{init}%%` con OTRO `themeVariables` que
 * llegue después dentro del `source` de `render()` — no hay error, el
 * directive simplemente no tiene efecto. Se extrae y aplica acá a mano, vía
 * `mermaid.initialize()` directo (que sí funciona en cualquier momento,
 * confirmado), antes de cada render.
 */
const INIT_DIRECTIVE_PATTERN = /^%%\{init:\s*([\s\S]*?)\}%%\s*\n/;

/**
 * Cualquier `%%{init}%%`/`%%{initialize}%%` en el resto del `source` —
 * confirmado con un caso real (una nota de referencia de sintaxis Mermaid
 * que incluye, como EJEMPLO de contenido, un `%%{init: {'theme': 'forest'}}%%`
 * dentro de uno de sus diagramas): Mermaid sí procesa ese segundo directive
 * cuando arma la config efectiva de este render — a diferencia del primer
 * directive (arriba, nunca aplicado por Mermaid solo), uno que aparece
 * DESPUÉS de un `mermaid.initialize()` ya corrido sí se mezcla por encima
 * (mismo mecanismo de "config del sitio + directives del documento" de
 * Mermaid) — así que ganaba el tema del ejemplo, no el de la app. Se
 * neutraliza cualquier directive de init que no sea el primero (el nuestro,
 * ya aplicado arriba) antes de renderizar, para que el tema activo de la
 * app sea siempre el que gana, sin importar qué directive traiga el propio
 * contenido del diagrama.
 */
const ANY_INIT_DIRECTIVE_PATTERN = /%%\{\s*init(?:ialize)?\s*:[\s\S]*?\}%%/g;

function applyInitDirective(source: string): void {
  const match = INIT_DIRECTIVE_PATTERN.exec(source);
  if (!match) return;
  try {
    const parsed = JSON.parse(match[1] as string) as Record<string, unknown>;
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", ...parsed });
  } catch {
    // Directive malformado — se deja el tema tal como estaba de la última
    // vez que se aplicó uno válido; no vale la pena abortar el render por esto.
  }
}

function stripOtherInitDirectives(source: string): string {
  let sawFirst = false;
  return source.replace(ANY_INIT_DIRECTIVE_PATTERN, (match) => {
    if (!sawFirst) {
      sawFirst = true;
      return match;
    }
    return "";
  });
}

async function render(source: string): Promise<string> {
  applyInitDirective(source);
  const { svg } = await mermaid.render(
    `mermaid-diagram-${++renderCount}`,
    stripOtherInitDirectives(source),
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
