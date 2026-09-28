#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerAccountTools } from "./tools/account.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerTaskTools } from "./tools/tasks.js";
import { VERSION } from "./version.js";

const server = new McpServer({ name: "ticktick-mcp", version: VERSION });

registerTaskTools(server);
registerProjectTools(server);
registerAccountTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`ticktick-mcp ${VERSION} running on stdio`);
