# cavalry-mcp

MCP server that connects Claude to [Cavalry](https://cavalry.scenegroup.co) animation software. Create layers, set attributes, animate with keyframes, render frames, and more — all through natural language.

## How it works

```
Claude <--MCP (stdio)--> cavalry-mcp <--HTTP POST--> Stallion <---> Cavalry
```

The MCP server sends JavaScript to Cavalry via the [Stallion](https://github.com/scenery-io/stallion) bridge (an HTTP server running inside Cavalry on `127.0.0.1:8080`).

## Prerequisites

- [Cavalry](https://cavalry.scenegroup.co) (with Stallion script enabled: **Scripts > Stallion**)
- Node.js >= 18

## Setup

```bash
npm install
npm run build
```

## Configure in Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cavalry": {
      "command": "node",
      "args": ["/absolute/path/to/cavalry-mcp/dist/index.js"]
    }
  }
}
```

## Available tools

| Tool | Description |
|---|---|
| `cavalry_ping` | Check if Cavalry + Stallion are reachable |
| `cavalry_run_script` | Execute arbitrary JavaScript in Cavalry |
| `cavalry_create_layer` | Create a layer (textShape, basicShape, null, etc.) |
| `cavalry_set_attribute` | Set attributes on a layer |
| `cavalry_get_attribute` | Read an attribute value |
| `cavalry_connect` | Connect attributes between layers |
| `cavalry_keyframe` | Set a keyframe at a specific frame |
| `cavalry_magic_easing` | Apply easing to keyframed attributes |
| `cavalry_get_scene_layers` | List all layers in the scene |
| `cavalry_get_selected_layers` | Get currently selected layers |
| `cavalry_select_layers` | Select layers by ID |
| `cavalry_delete_layers` | Delete layers by ID |
| `cavalry_get_composition_info` | Get resolution, frame range, FPS |
| `cavalry_set_current_frame` | Move the playhead |
| `cavalry_render_png` | Render current frame as PNG |
| `cavalry_set_generator` | Set a generator on a layer (ellipse, rectangle, etc.) |
| `cavalry_duplicate_layer` | Duplicate a layer |
| `cavalry_get_bounding_box` | Get a layer's bounding box |
| `cavalry_save_scene` | Save the scene |
| `cavalry_open_scene` | Open a .cv scene file |
| `cavalry_add_dynamic_attribute` | Add a dynamic attribute to a layer |

## Example conversation

> **You:** Create a bouncing text that says "Hello World"
>
> Claude will:
> 1. Create a textShape layer
> 2. Set the text content, font size, and color
> 3. Add position keyframes for the bounce
> 4. Apply BounceOut easing

## Common layer types

`basicShape`, `textShape`, `null`, `colorPlane`, `group`, `subMesh`, `linearGradient`, `duplicator`, `connectShape`, `noiseDeformer`, `stagger`, `trail`, `javaScriptUtility`, `javaScriptShape`, `imageAsset`, `videoAsset`, `soundAsset`

## Common attribute paths

- `position.x`, `position.y` — Layer position
- `rotation` — Rotation in degrees
- `scale.x`, `scale.y` — Scale
- `opacity` — Layer opacity (0–100)
- `fontSize` — Text layer font size
- `fill.color` — Fill color (hex string)
- `stroke.color`, `stroke.width` — Stroke properties

## License

MIT
