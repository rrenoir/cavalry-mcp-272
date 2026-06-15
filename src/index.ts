#!/usr/bin/env node

/**
 * Cavalry MCP Server — patched for Cavalry 2.7.2
 *
 * Minimal toolset:
 *   cavalry_ping          — connectivity check
 *   cavalry_run_script    — validated JS execution
 *   cavalry_create_text   — create a Text Shape layer
 *   cavalry_create_shape  — create a primitive shape layer
 *
 * All generated Cavalry JavaScript uses only documented APIs from
 * @scenery/cavalry-types and always uses console.log() for output.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sendToCavalry, pingStallion } from "./stallion.js";

const server = new McpServer({
  name: "cavalry-mcp",
  version: "1.3.0",
});

// ---------------------------------------------------------------------------
// Helper: run a Cavalry script and return the response text
// ---------------------------------------------------------------------------
async function runScript(code: string): Promise<string> {
  try {
    const result = await sendToCavalry(code);
    return result || "Script executed successfully.";
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ECONNREFUSED")) {
      return (
        "Error: Could not connect to Cavalry. " +
        "Make sure Cavalry is running and the Stallion script is active (Scripts > Stallion)."
      );
    }
    return `Error: ${message}`;
  }
}

// ---------------------------------------------------------------------------
// Script validator — rejects scripts that use unsupported Cavalry API calls.
// Only scripts that pass validation are sent to Cavalry.
// ---------------------------------------------------------------------------
interface ValidationResult {
  ok: boolean;
  error?: string;
}

const BANNED_PATTERNS: Array<{ pattern: RegExp; suggestion: string }> = [
  {
    // api.log() is not part of the Cavalry API — use console.log()
    pattern: /\bapi\.log\s*\(/,
    suggestion: "Use console.log() instead of api.log()",
  },
  {
    // api.setCurrentFrame() does not exist — the correct call is api.setFrame()
    pattern: /\bapi\.setCurrentFrame\s*\(/,
    suggestion: "Use api.setFrame(frame) instead of api.setCurrentFrame(frame)",
  },
  {
    // api.setKeyframe() does not exist — the correct call is api.keyframe()
    pattern: /\bapi\.setKeyframe\s*\(/,
    suggestion:
      "Use api.keyframe(layerId, frame, dict) instead of api.setKeyframe()",
  },
  {
    // api.getSceneLayers() does not exist — use api.getAllSceneLayers() or api.getCompLayers(false)
    pattern: /\bapi\.getSceneLayers\s*\(/,
    suggestion:
      "Use api.getAllSceneLayers() or api.getCompLayers(false) instead of api.getSceneLayers()",
  },
  {
    // api.getInFrame() requires a layerId argument
    pattern: /\bapi\.getInFrame\s*\(\s*\)/,
    suggestion:
      "api.getInFrame() requires a layerId argument: api.getInFrame(layerId)",
  },
  {
    // api.getOutFrame() requires a layerId argument
    pattern: /\bapi\.getOutFrame\s*\(\s*\)/,
    suggestion:
      "api.getOutFrame() requires a layerId argument: api.getOutFrame(layerId)",
  },
  {
    // api.duplicateSelection() does not exist
    pattern: /\bapi\.duplicateSelection\s*\(/,
    suggestion:
      "Use api.duplicate(layerId, withInputConnections) instead of api.duplicateSelection()",
  },
  {
    // api.loadScene() does not exist — the correct call is api.openScene()
    pattern: /\bapi\.loadScene\s*\(/,
    suggestion: "Use api.openScene(path, force?) instead of api.loadScene(path)",
  },
];

function validateScript(code: string): ValidationResult {
  for (const { pattern, suggestion } of BANNED_PATTERNS) {
    if (pattern.test(code)) {
      return {
        ok: false,
        error: `Unsupported Cavalry API call detected. ${suggestion}`,
      };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Utility: escape a string for safe embedding inside a JS double-quoted string
// ---------------------------------------------------------------------------
function escapeForJS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// ---------------------------------------------------------------------------
// Tool: cavalry_ping
// Check if Cavalry is running and Stallion is reachable.
// ---------------------------------------------------------------------------
server.tool(
  "cavalry_ping",
  "Check if Cavalry is running and the Stallion bridge is reachable",
  {},
  async () => {
    const reachable = await pingStallion();
    return {
      content: [
        {
          type: "text",
          text: reachable
            ? "Cavalry is reachable via Stallion."
            : "Cavalry is not reachable. Make sure Cavalry is running and the Stallion script is active (Scripts > Stallion).",
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: cavalry_run_script
// Execute validated JavaScript inside Cavalry via the Stallion bridge.
// Scripts must use only documented Cavalry 2.7 APIs.
// ---------------------------------------------------------------------------
server.tool(
  "cavalry_run_script",
  `Execute JavaScript in Cavalry's Script Editor via Stallion.

Rules:
- Use console.log() for all output (NOT api.log — that function does not exist).
- Valid top-level namespaces: api, cavalry, console.
- Blocked (unsupported) calls that will be rejected:
    api.log()               → use console.log()
    api.setCurrentFrame()   → use api.setFrame(frame)
    api.setKeyframe()       → use api.keyframe(layerId, frame, dict)
    api.getSceneLayers()    → use api.getAllSceneLayers() or api.getCompLayers(false)
    api.getInFrame()        → requires layerId: api.getInFrame(layerId)
    api.getOutFrame()       → requires layerId: api.getOutFrame(layerId)
    api.duplicateSelection()→ use api.duplicate(layerId, withInputConnections)
    api.loadScene()         → use api.openScene(path, force?)

Key documented functions (Cavalry 2.7):
  api.create(type, name?)              → layerId
  api.primitive(type, name)            → layerId  (rectangle, ellipse, polygon, star, …)
  api.set(layerId, dict)               → void
  api.get(layerId, attrId)             → value
  api.keyframe(layerId, frame, dict)   → keyframeId
  api.magicEasing(layerId, attrId, frame, easingName, expr?)
  api.connect(fromId, fromAttr, toId, toAttr, force?)
  api.getActiveComp()                  → compId
  api.getCompLayers(topLevel)          → string[]
  api.getAllSceneLayers()              → string[]
  api.getSelection()                   → string[]
  api.select(idArray)
  api.getNiceName(layerId)             → string
  api.getLayerType(layerId)            → string
  api.setFrame(frame)
  api.getFrame()                       → number
  api.getInFrame(layerId)              → number
  api.getOutFrame(layerId)             → number
  api.renderPNGFrame(filePath, scale%)
  api.saveScene()                      → boolean
  api.saveSceneAs(filePath)            → boolean
  api.openScene(path, force?)
  api.duplicate(layerId, withInputConnections)
  api.deleteLayer(layerId)             → single string only, not array
  api.getBoundingBox(layerId, worldSpace)
  api.setGenerator(layerId, attrId, generatorType)
  api.addDynamic(layerId, attrId, attrType)`,
  {
    code: z
      .string()
      .describe("JavaScript to execute in Cavalry. Must use documented APIs."),
  },
  async ({ code }) => {
    const validation = validateScript(code);
    if (!validation.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Script rejected — ${validation.error}`,
          },
        ],
      };
    }
    const result = await runScript(code);
    return { content: [{ type: "text", text: result }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: cavalry_create_text
// Create a Text Shape layer with specified content and basic styling.
// ---------------------------------------------------------------------------
server.tool(
  "cavalry_create_text",
  "Create a Text Shape layer in the active Cavalry composition.",
  {
    text: z.string().describe("The text content to display"),
    name: z
      .string()
      .optional()
      .describe("Layer name in the scene (defaults to the text value)"),
    x: z.number().optional().describe("Horizontal position in pixels (default 0)"),
    y: z.number().optional().describe("Vertical position in pixels (default 0)"),
    fontSize: z.number().optional().describe("Font size in points (default 72)"),
    color: z
      .string()
      .optional()
      .describe('Fill colour as hex, e.g. "#ffffff" (default white)'),
  },
  async ({ text, name, x, y, fontSize, color }) => {
    const safeText = escapeForJS(text);
    const safeName = escapeForJS(name ?? text);
    const px = x ?? 0;
    const py = y ?? 0;
    const fs = fontSize ?? 72;
    const col = color ?? "#ffffff";

    const code = `
try {
  var id = api.create("textShape", "${safeName}");
  api.set(id, {
    text: "${safeText}",
    fontSize: ${fs},
    "position.x": ${px},
    "position.y": ${py},
    "material.materialColor": "${col}"
  });
  console.log(id);
} catch (e) {
  console.log("Error: " + e.message);
}
`.trim();

    const result = await runScript(code);
    return {
      content: [
        { type: "text", text: `Text layer created: ${result.trim()}` },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: cavalry_create_shape
// Create a primitive shape layer with optional position and colour.
// ---------------------------------------------------------------------------
const PRIMITIVE_TYPES = [
  "rectangle",
  "ellipse",
  "polygon",
  "star",
  "superEllipse",
  "circle",
] as const;

type PrimitiveType = (typeof PRIMITIVE_TYPES)[number];

server.tool(
  "cavalry_create_shape",
  `Create a primitive shape layer in the active Cavalry composition.
Supported types: rectangle, ellipse, polygon, star, superEllipse, circle.`,
  {
    primitiveType: z
      .enum(PRIMITIVE_TYPES)
      .describe("Primitive shape type"),
    name: z
      .string()
      .optional()
      .describe("Layer name (defaults to the primitive type)"),
    x: z.number().optional().describe("Horizontal position in pixels (default 0)"),
    y: z.number().optional().describe("Vertical position in pixels (default 0)"),
    color: z
      .string()
      .optional()
      .describe('Fill colour as hex, e.g. "#ff0000"'),
  },
  async ({ primitiveType, name, x, y, color }: {
    primitiveType: PrimitiveType;
    name?: string;
    x?: number;
    y?: number;
    color?: string;
  }) => {
    const safeName = escapeForJS(name ?? primitiveType);
    const px = x ?? 0;
    const py = y ?? 0;

    const attrs: Record<string, unknown> = {
      "position.x": px,
      "position.y": py,
    };
    if (color) {
      attrs["material.materialColor"] = color;
    }

    const code = `
try {
  var id = api.primitive("${primitiveType}", "${safeName}");
  api.set(id, ${JSON.stringify(attrs)});
  console.log(id);
} catch (e) {
  console.log("Error: " + e.message);
}
`.trim();

    const result = await runScript(code);
    return {
      content: [
        { type: "text", text: `Shape layer created: ${result.trim()}` },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: cavalry_set_attribute
// api.set(layerId, dictionary) — documented at api.d.ts line 647
// ---------------------------------------------------------------------------
server.tool(
  "cavalry_set_attribute",
  `Set one or more attributes on a Cavalry layer using api.set(layerId, dictionary).
Attribute paths use dot-notation, e.g. "position.x", "material.materialColor", "fontSize".`,
  {
    layerId: z.string().describe("The layer ID to modify"),
    attributes: z
      .record(z.unknown())
      .describe(
        'Key-value map of attribute paths to values, e.g. {"fontSize": 48, "position.x": 100}',
      ),
  },
  async ({ layerId, attributes }) => {
    const safeId = escapeForJS(layerId);
    const attrsJson = JSON.stringify(attributes);
    const code = `
try {
  api.set("${safeId}", ${attrsJson});
  console.log("OK");
} catch (e) {
  console.log("Error: " + e.message);
}
`.trim();
    const result = await runScript(code);
    return {
      content: [{ type: "text", text: `set on ${layerId}: ${result.trim()}` }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: cavalry_get_attribute
// api.get(layerId, attrId) — documented at api.d.ts line 661
// ---------------------------------------------------------------------------
server.tool(
  "cavalry_get_attribute",
  "Read the current value of an attribute from a Cavalry layer using api.get(layerId, attrId).",
  {
    layerId: z.string().describe("The layer ID"),
    attrPath: z
      .string()
      .describe('The attribute path, e.g. "position.x", "fontSize", "material.materialColor"'),
  },
  async ({ layerId, attrPath }) => {
    const safeId = escapeForJS(layerId);
    const safeAttr = escapeForJS(attrPath);
    const code = `
try {
  var val = api.get("${safeId}", "${safeAttr}");
  console.log(JSON.stringify(val));
} catch (e) {
  console.log("Error: " + e.message);
}
`.trim();
    const result = await runScript(code);
    return { content: [{ type: "text", text: result.trim() }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: cavalry_keyframe
// api.keyframe(layerId, frame, dictionary) — documented at api.d.ts line 893
// ---------------------------------------------------------------------------
server.tool(
  "cavalry_keyframe",
  `Set keyframe values on a layer attribute at a specific frame using api.keyframe(layerId, frame, dictionary).
Returns the keyframe ID. Example attributes: {"position.x": 0}, {"scale.x": 2}.`,
  {
    layerId: z.string().describe("The layer ID"),
    frame: z.number().describe("The frame number to set the keyframe on"),
    attributes: z
      .record(z.unknown())
      .describe(
        'Key-value map of attribute paths to values at this frame, e.g. {"position.x": 0}',
      ),
  },
  async ({ layerId, frame, attributes }) => {
    const safeId = escapeForJS(layerId);
    const attrsJson = JSON.stringify(attributes);
    const code = `
try {
  var kfId = api.keyframe("${safeId}", ${frame}, ${attrsJson});
  console.log(kfId);
} catch (e) {
  console.log("Error: " + e.message);
}
`.trim();
    const result = await runScript(code);
    return {
      content: [
        {
          type: "text",
          text: `Keyframe on ${layerId} at frame ${frame}: ${result.trim()}`,
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: cavalry_get_selection
// api.getSelection() — documented at api.d.ts line 258
// ---------------------------------------------------------------------------
server.tool(
  "cavalry_get_selection",
  "Return the currently selected layers in Cavalry with their IDs, types, and names.",
  {},
  async () => {
    const code = `
try {
  var sel = api.getSelection();
  var info = [];
  for (var i = 0; i < sel.length; i++) {
    var layerId = sel[i];
    info.push(layerId + " | " + api.getLayerType(layerId) + " | " + api.getNiceName(layerId));
  }
  console.log(info.length > 0 ? info.join("\\n") : "No layers selected.");
} catch (e) {
  console.log("Error: " + e.message);
}
`.trim();
    const result = await runScript(code);
    return { content: [{ type: "text", text: result.trim() }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: cavalry_select_layers
// api.select(array) — documented at api.d.ts line 265
// ---------------------------------------------------------------------------
server.tool(
  "cavalry_select_layers",
  "Select specific layers in Cavalry by their IDs using api.select(array).",
  {
    layerIds: z
      .array(z.string())
      .describe("Array of layer IDs to select"),
  },
  async ({ layerIds }) => {
    const idsJson = JSON.stringify(layerIds);
    const code = `
try {
  api.select(${idsJson});
  console.log("Selected " + ${idsJson}.length + " layer(s).");
} catch (e) {
  console.log("Error: " + e.message);
}
`.trim();
    const result = await runScript(code);
    return {
      content: [{ type: "text", text: result.trim() }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: cavalry_connect
// api.connect(fromId, fromAttrId, toId, toAttrId, force?) — api.d.ts line 812
// ---------------------------------------------------------------------------
server.tool(
  "cavalry_connect",
  `Connect an output attribute of one layer to an input attribute of another using api.connect().
Use "id" as fromAttrId to connect a layer's main output (e.g. connecting a shape into a duplicator).
The optional force flag overwrites any existing connection on the target attribute.`,
  {
    fromLayerId: z.string().describe("Source layer ID"),
    fromAttr: z
      .string()
      .describe('Source attribute path — use "id" for the layer\'s main output'),
    toLayerId: z.string().describe("Target layer ID"),
    toAttr: z.string().describe("Target attribute path"),
    force: z
      .boolean()
      .optional()
      .describe("If true, overwrite any existing connection on the target attribute"),
  },
  async ({ fromLayerId, fromAttr, toLayerId, toAttr, force }) => {
    const safeFrom = escapeForJS(fromLayerId);
    const safeFromAttr = escapeForJS(fromAttr);
    const safeTo = escapeForJS(toLayerId);
    const safeToAttr = escapeForJS(toAttr);
    const forceArg = force === true ? ", true" : "";
    const code = `
try {
  api.connect("${safeFrom}", "${safeFromAttr}", "${safeTo}", "${safeToAttr}"${forceArg});
  console.log("Connected ${safeFrom}.${safeFromAttr} -> ${safeTo}.${safeToAttr}");
} catch (e) {
  console.log("Error: " + e.message);
}
`.trim();
    const result = await runScript(code);
    return {
      content: [{ type: "text", text: result.trim() }],
    };
  },
);

// ---------------------------------------------------------------------------
// cavalry_create_title_scene — high-level animated title scene builder
// ---------------------------------------------------------------------------

interface TitleSceneStyleConfig {
  bgColor: string;
  titleColor: string;
  subtitleColor: string;
  accentColor: string;
  accentAltColor: string;
  titleFontSize: number;
  subtitleFontSize: number;
}

const TITLE_SCENE_STYLES: Record<string, TitleSceneStyleConfig> = {
  clean: {
    bgColor: "#070712",
    titleColor: "#ffffff",
    subtitleColor: "#8888aa",
    accentColor: "#4a9eff",
    accentAltColor: "#2255cc",
    titleFontSize: 80,
    subtitleFontSize: 32,
  },
  bold: {
    bgColor: "#0a0000",
    titleColor: "#ffffff",
    subtitleColor: "#e94560",
    accentColor: "#e94560",
    accentAltColor: "#880022",
    titleFontSize: 96,
    subtitleFontSize: 36,
  },
  playful: {
    bgColor: "#0d1117",
    titleColor: "#ffffff",
    subtitleColor: "#f59e0b",
    accentColor: "#6c63ff",
    accentAltColor: "#f59e0b",
    titleFontSize: 72,
    subtitleFontSize: 30,
  },
};

function buildTitleSceneScript(
  title: string,
  subtitle: string | undefined,
  canvasWidth: number,
  canvasHeight: number,
  durationFrames: number,
  style: string,
): string {
  const cfg = TITLE_SCENE_STYLES[style] ?? TITLE_SCENE_STYLES["clean"];
  const halfW = canvasWidth / 2;
  const halfH = canvasHeight / 2;
  const marginX = Math.round(canvasWidth * 0.10);
  const marginY = Math.round(canvasHeight * 0.10);
  const hasSubtitle = !!subtitle;

  // ── Typography & vertical layout ────────────────────────────────────────
  const { titleFontSize, subtitleFontSize } = cfg;
  const titleLineH   = Math.round(titleFontSize * 1.15);
  const subLineH     = Math.round(subtitleFontSize * 1.20);
  const groupGap     = 28;
  const groupH       = hasSubtitle ? titleLineH + groupGap + subLineH : titleLineH;
  // Centre the group vertically; positive Y = up in Cavalry
  const titleFinalY  = Math.round(groupH / 2 - titleLineH / 2);
  const subtitleFinalY = hasSubtitle
    ? Math.round(titleFinalY - titleLineH / 2 - groupGap - subLineH / 2)
    : 0;

  // ── Entrance positions (outside canvas — above, per spec) ────────────────
  const titleFromY    = Math.round(halfH) + 150;
  const subtitleFromY = Math.round(halfH) + 220;

  // ── Timing (relative to durationFrames) ─────────────────────────────────
  const titleInEnd    = Math.round(durationFrames * 0.44);
  const subInStart    = Math.round(durationFrames * 0.15);
  const subInEnd      = Math.round(durationFrames * 0.65);
  const accentInStart = Math.round(durationFrames * 0.05);
  const accentInEnd   = Math.round(durationFrames * 0.40);

  // ── Accent positions — distributed, not clustered in centre ─────────────
  // Top-left, bottom-right, left-mid — all outside the central text area
  const ax1 = Math.round(-halfW + marginX * 1.4);
  const ay1 = Math.round( halfH - marginY * 1.6);
  const ax2 = Math.round( halfW - marginX * 1.4);
  const ay2 = Math.round(-halfH + marginY * 1.6);
  const ax3 = Math.round(-halfW + marginX * 1.0);
  const ay3 = Math.round(-canvasHeight * 0.08);

  // ── Accent shape block (style-specific) ─────────────────────────────────
  let accentBlock = "";

  if (style === "bold") {
    const bW = Math.round(canvasWidth  * 0.04);
    const bH1 = Math.round(canvasHeight * 0.12);
    const bH2 = Math.round(canvasHeight * 0.08);
    const bH3 = Math.round(canvasHeight * 0.03);
    const bW3 = Math.round(canvasWidth  * 0.08);
    accentBlock = `
  var a1 = api.primitive("rectangle", "Accent Block 1");
  api.set(a1, { "generator.dimensions": [${bW}, ${bH1}], "position.x": ${ax1}, "position.y": ${ay1}, "material.materialColor": "${cfg.accentColor}" });
  api.keyframe(a1, ${accentInStart},     { "scale.y": 0 });
  api.keyframe(a1, ${accentInEnd},       { "scale.y": 1 });
  var a2 = api.primitive("rectangle", "Accent Block 2");
  api.set(a2, { "generator.dimensions": [${bW}, ${bH2}], "position.x": ${ax2}, "position.y": ${ay2}, "material.materialColor": "${cfg.accentColor}" });
  api.keyframe(a2, ${accentInStart + 8}, { "scale.y": 0 });
  api.keyframe(a2, ${accentInEnd + 8},   { "scale.y": 1 });
  var a3 = api.primitive("rectangle", "Accent Block 3");
  api.set(a3, { "generator.dimensions": [${bW3}, ${bH3}], "position.x": ${ax3}, "position.y": ${ay3}, "material.materialColor": "${cfg.accentAltColor}" });
  api.keyframe(a3, ${accentInStart + 4}, { "scale.x": 0 });
  api.keyframe(a3, ${accentInEnd + 4},   { "scale.x": 1 });`;
  } else if (style === "playful") {
    const r1 = Math.round(canvasHeight * 0.07);
    const r2 = Math.round(canvasHeight * 0.05);
    const r3 = Math.round(canvasHeight * 0.03);
    accentBlock = `
  var a1 = api.primitive("circle", "Accent Circle 1");
  api.set(a1, { "generator.radius": ${r1}, "position.x": ${ax1}, "position.y": ${ay1}, "material.materialColor": "${cfg.accentColor}" });
  api.keyframe(a1, ${accentInStart},     { "scale.x": 0, "scale.y": 0 });
  api.keyframe(a1, ${accentInEnd},       { "scale.x": 1, "scale.y": 1 });
  var a2 = api.primitive("circle", "Accent Circle 2");
  api.set(a2, { "generator.radius": ${r2}, "position.x": ${ax2}, "position.y": ${ay2}, "material.materialColor": "${cfg.accentAltColor}" });
  api.keyframe(a2, ${accentInStart + 8}, { "scale.x": 0, "scale.y": 0 });
  api.keyframe(a2, ${accentInEnd + 8},   { "scale.x": 1, "scale.y": 1 });
  var a3 = api.primitive("circle", "Accent Circle 3");
  api.set(a3, { "generator.radius": ${r3}, "position.x": ${ax3}, "position.y": ${ay3}, "material.materialColor": "${cfg.accentColor}" });
  api.keyframe(a3, ${accentInStart + 4}, { "scale.x": 0, "scale.y": 0 });
  api.keyframe(a3, ${accentInEnd + 4},   { "scale.x": 1, "scale.y": 1 });`;
  } else {
    // clean: thin lines + dot
    const lw1 = Math.round(canvasWidth * 0.14);
    const lw2 = Math.round(canvasWidth * 0.09);
    const dr  = Math.round(canvasHeight * 0.014);
    accentBlock = `
  var a1 = api.primitive("rectangle", "Accent Line 1");
  api.set(a1, { "generator.dimensions": [${lw1}, 2], "position.x": ${ax1}, "position.y": ${ay1}, "material.materialColor": "${cfg.accentColor}" });
  api.keyframe(a1, ${accentInStart},     { "scale.x": 0 });
  api.keyframe(a1, ${accentInEnd},       { "scale.x": 1 });
  var a2 = api.primitive("rectangle", "Accent Line 2");
  api.set(a2, { "generator.dimensions": [${lw2}, 2], "position.x": ${ax2}, "position.y": ${ay2}, "material.materialColor": "${cfg.accentColor}" });
  api.keyframe(a2, ${accentInStart + 6}, { "scale.x": 0 });
  api.keyframe(a2, ${accentInEnd + 6},   { "scale.x": 1 });
  var a3 = api.primitive("circle", "Accent Dot");
  api.set(a3, { "generator.radius": ${dr}, "position.x": ${ax3 + Math.round(canvasWidth * 0.04)}, "position.y": ${ay3}, "material.materialColor": "${cfg.accentColor}" });
  api.keyframe(a3, ${accentInStart + 3}, { "scale.x": 0, "scale.y": 0 });
  api.keyframe(a3, ${accentInEnd + 3},   { "scale.x": 1, "scale.y": 1 });`;
  }

  // ── Subtitle block ───────────────────────────────────────────────────────
  const subtitleBlock = hasSubtitle
    ? `
  var sub = api.create("textShape", "Subtitle");
  api.set(sub, {
    text: "${escapeForJS(subtitle!)}",
    fontSize: ${subtitleFontSize},
    "position.x": 0,
    "material.materialColor": "${cfg.subtitleColor}",
    "textLayout.horizontalAlignment": 1
  });
  api.keyframe(sub, ${subInStart}, { "position.y": ${subtitleFromY} });
  api.keyframe(sub, ${subInEnd},   { "position.y": ${subtitleFinalY} });`
    : "";

  return `
try {
  // ── Background (full canvas) ────────────────────────────
  var bg = api.primitive("rectangle", "BG");
  api.set(bg, {
    "generator.dimensions": [${canvasWidth}, ${canvasHeight}],
    "position.x": 0,
    "position.y": 0,
    "material.materialColor": "${cfg.bgColor}"
  });

  // ── Accent shapes (distributed, not centred) ────────────
  ${accentBlock.trim()}

  // ── Main title (enters from above, y: ${titleFromY} → ${titleFinalY}) ──
  var title = api.create("textShape", "Title");
  api.set(title, {
    text: "${escapeForJS(title)}",
    fontSize: ${titleFontSize},
    "position.x": 0,
    "material.materialColor": "${cfg.titleColor}",
    "textLayout.horizontalAlignment": 1
  });
  api.keyframe(title, 0,           { "position.y": ${titleFromY} });
  api.keyframe(title, ${titleInEnd}, { "position.y": ${titleFinalY} });

  // ── Subtitle (enters from above, y: ${subtitleFromY} → ${subtitleFinalY}) ─
  ${subtitleBlock.trim()}

  console.log("Title scene created.");
} catch (e) {
  console.log("Error: " + e.message);
}`.trim();
}

server.tool(
  "cavalry_create_title_scene",
  `Create a complete animated title scene in Cavalry with background, title, optional subtitle, and accent shapes.
All layout is calculated from canvas dimensions with safe margins. Text layers never overlap.
Entrance animations start outside the canvas bounds.

Styles:
  clean   — dark navy bg, white title, blue accents, thin lines
  bold    — black bg, white title, red accents, thick rectangles
  playful — dark bg, white title, gold subtitle, purple/gold circles`,
  {
    title: z.string().describe("Main title text"),
    subtitle: z.string().optional().describe("Optional subtitle text"),
    canvasWidth: z.number().optional().describe("Canvas width in pixels (default 1920)"),
    canvasHeight: z.number().optional().describe("Canvas height in pixels (default 1080)"),
    durationFrames: z.number().optional().describe("Total animation duration in frames (default 90)"),
    style: z
      .enum(["clean", "bold", "playful"])
      .optional()
      .describe("Visual style preset (default: clean)"),
  },
  async ({ title, subtitle, canvasWidth, canvasHeight, durationFrames, style }) => {
    const cW  = canvasWidth    ?? 1920;
    const cH  = canvasHeight   ?? 1080;
    const dur = durationFrames ?? 90;
    const sty = style          ?? "clean";

    const code = buildTitleSceneScript(title, subtitle, cW, cH, dur, sty);
    const result = await runScript(code);
    return {
      content: [
        {
          type: "text",
          text: `Title scene "${title}" created (style: ${sty}, ${cW}×${cH}, ${dur} frames): ${result.trim()}`,
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start cavalry-mcp server:", err);
  process.exit(1);
});
