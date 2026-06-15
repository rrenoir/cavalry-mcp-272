# cavalry-mcp-272

MCP server for controlling **Cavalry 2.7.x** from **Claude Desktop** and **Claude Cowork**.

✅ Tested with:

- Cavalry 2.7.2
- Stallion
- Node.js >= 18
- Claude Desktop / Cowork

---

## Install

```bash
npm install
npm run build
```

Start Stallion in Cavalry:

```text
Scripts → Stallion
```

---

## Claude Configuration

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

Restart Claude afterwards.

---

## Available Tools

- `cavalry_ping`
- `cavalry_run_script` (validated)
- `cavalry_create_text`
- `cavalry_create_shape`
- `cavalry_set_attribute`
- `cavalry_get_attribute`
- `cavalry_keyframe`
- `cavalry_get_selection`
- `cavalry_select_layers`
- `cavalry_connect`

---

## Notes

- Built and tested for Cavalry 2.7.2.
- Uses a smaller, validated toolset.
- `console.log()` output remains inside Cavalry.
- Some APIs from the original project behaved differently in this environment and were therefore removed or replaced.

---

## Original Project

Based on:

https://github.com/kacperchlebowicz/Cavalry-mcp

Original branch:

https://github.com/kacperchlebowicz/Cavalry-mcp/tree/claude/mcp-cavalry-plugin-ltNOc

---

## Architecture

```text
Claude
↓
MCP
↓
Stallion
↓
Cavalry
```

MIT License