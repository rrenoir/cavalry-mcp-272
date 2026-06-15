# cavalry-mcp (Patched for Cavalry 2.7.x)

A patched version of **cavalry-mcp** compatible with:

- Cavalry 2.7.x (tested with 2.7.2)
- Stallion
- Claude Desktop / Claude Cowork
- Node.js >= 18

This project is based on the original **cavalry-mcp** by Kacper Chlebowicz and adapts the MCP server for the current Cavalry 2.7 scripting environment by removing undocumented or incompatible API calls and introducing a smaller, validated toolset.

## Original Project

Original repository:

https://github.com/kacperchlebowicz/Cavalry-mcp

Original experimental branch:

https://github.com/kacperchlebowicz/Cavalry-mcp/tree/claude/mcp-cavalry-plugin-ltNOc

---

## How it works

```text
Claude <--MCP (stdio)--> cavalry-mcp <--HTTP POST--> Stallion <---> Cavalry
```

The MCP server sends JavaScript to Cavalry via the [Stallion](https://github.com/scenery-io/stallion) bridge, an HTTP server running inside Cavalry on:

```text
127.0.0.1:8080
```

---

## Prerequisites

- Cavalry 2.7.x (tested with 2.7.2)
- Stallion installed and running
- Node.js >= 18
- Claude Desktop or Claude Cowork

In Cavalry:

```text
Scripts → Stallion
```

---

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/cavalry-mcp-272.git
cd cavalry-mcp-272
```

Install dependencies:

```bash
npm install
```

Build the server:

```bash
npm run build
```

---

## Configure in Claude Desktop

Add the following to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cavalry": {
      "command": "node",
      "args": [
        "/absolute/path/to/cavalry-mcp/dist/index.js"
      ]
    }
  }
}
```

After building or updating the server:

1. Start Stallion inside Cavalry.
2. Restart Claude Desktop or Claude Cowork.

---

# Available Tools

| Tool | Description |
|------|-------------|
| `cavalry_ping` | Check if Cavalry and Stallion are reachable |
| `cavalry_run_script` | Execute validated JavaScript in Cavalry |
| `cavalry_create_text` | Create a text layer |
| `cavalry_create_shape` | Create a primitive shape |
| `cavalry_set_attribute` | Set layer attributes |
| `cavalry_get_attribute` | Read a layer attribute |
| `cavalry_keyframe` | Create keyframes |
| `cavalry_get_selection` | Read current selection |
| `cavalry_select_layers` | Select layers |
| `cavalry_connect` | Connect compatible attributes |

---

# Removed Tools

The following tools were removed because they relied on undocumented, incompatible, or outdated Cavalry APIs:

- `cavalry_create_layer`
- `cavalry_magic_easing`
- `cavalry_get_scene_layers`
- `cavalry_get_selected_layers`
- `cavalry_delete_layers`
- `cavalry_get_composition_info`
- `cavalry_set_current_frame`
- `cavalry_render_png`
- `cavalry_set_generator`
- `cavalry_duplicate_layer`
- `cavalry_get_bounding_box`
- `cavalry_save_scene`
- `cavalry_open_scene`
- `cavalry_add_dynamic_attribute`

---

# Validation

This version rejects known unsupported calls such as:

- `api.log`
- `api.setKeyframe`
- `api.getSceneLayers`
- `api.setCurrentFrame`
- other undocumented APIs not available in Cavalry 2.7.x

All generated scripts are wrapped in:

```javascript
(function () {
  try {
    // generated code
  } catch (err) {
    console.log("MCP Error: " + err.message);
  }
})();
```

---

# Current Limitations

- Not all Cavalry attributes are currently mapped.
- Text alignment attributes are not yet fully supported.
- `console.log()` output remains inside Cavalry and is not automatically returned to Claude.
- Complex motion design works best when generated from higher-level scene plans rather than arbitrary scripts.

---

# Development Philosophy

This project intentionally uses a smaller and safer toolset.

The goal is not to expose every Cavalry scripting function directly to the language model, but to provide reliable building blocks that can be composed into more complex scenes and animations.

Typical workflow:

```text
Prompt
↓
Scene Plan
↓
Validated MCP Tools
↓
Stallion
↓
Cavalry
```

---

# License

MIT

---

# Credits

Original project:

**Kacper Chlebowicz**  
https://github.com/kacperchlebowicz/Cavalry-mcp

Stallion:

https://github.com/scenery-io/stallion

Cavalry:

https://cavalry.scenegroup.co