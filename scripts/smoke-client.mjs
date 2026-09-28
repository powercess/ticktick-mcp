/**
 * Stdio smoke client: connects to the built MCP server and invokes one tool.
 * Usage: node scripts/smoke-client.mjs [tool] [argsJson]
 * Credentials come from the environment (TICKTICK_COOKIE / TICKTICK_TOKEN) or
 * ~/.ticktick-mcp/credentials.json.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tool = process.argv[2] ?? "list_projects";
const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(__dirname, "..", "dist", "index.js")],
  // The SDK filters env to a safe allowlist; forward ours so TICKTICK_* reach the server.
  env: Object.fromEntries(
    Object.entries(process.env).filter((entry) => typeof entry[1] === "string"),
  ),
});
const client = new Client({ name: "smoke", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
console.log("tools:", tools.tools.map((t) => t.name).join(", "));

const res = await client.callTool({ name: tool, arguments: args });
console.log("result:", res.content?.[0]?.text ?? JSON.stringify(res));

await client.close();
