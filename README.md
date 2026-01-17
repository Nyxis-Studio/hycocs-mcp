# Hydocs Documentation MCP Server

A Model Context Protocol (MCP) server that provides programmatic access to Hydocs API documentation. Built with TypeScript and the Streamable HTTP transport.

## Features

- TypeScript with strict typing
- Streamable HTTP MCP transport
- Fast class search and full doc retrieval
- Health check endpoint
- Optional monitoring integrations

## Architecture

```
MCP Client
   |
   | Streamable HTTP
   v
Hydocs MCP Server (port 3000)
```

## Project Structure

```
mcp/
├── src/
│   ├── index.ts
│   ├── types/
│   ├── utils/
│   └── tools/
├── nyxis-monitoring/
│   ├── docker-compose.monitoring.yml
│   └── monitoring/
│       ├── prometheus.yml
│       ├── loki-config.yml
│       └── grafana/
│           ├── datasources.yml
│           ├── dashboards.yml
│           └── dashboards/
│               └── hydocs-mcp-overview.json
├── Dockerfile
├── package.json
└── README.md
```

## Requirements

- Node.js 18+
- Hydocs documentation build output available (see `DOCS_DIR`)

## Configuration

Create a `.env` file based on `.env.example` or `.env.production.example`.

Minimal config for local development:

```env
PORT=3000
DOCS_DIR=../build
LOG_LEVEL=info
```

Optional monitoring config (Nyxis stack):

```env
ENABLE_LOKI_PUSH=true
LOKI_URL=http://loki:3100

ENABLE_METRICS_PUSH=true
PUSHGATEWAY_URL=http://pushgateway:9091
METRICS_PUSH_INTERVAL=10000
```

## Local Development

```bash
npm install
npm run build
npm start
```

Server endpoints:

- MCP: `POST http://localhost:3000/mcp`
- Health: `GET http://localhost:3000/health`

## Docker Build (single image)

```bash
docker build -t hydocs-mcp:local .

docker run --rm -p 3000:3000 \
  -e DOCS_DIR=/app/docs \
  -v /path/to/build:/app/docs:ro \
  hydocs-mcp:local
```

## Monitoring Support

This project can integrate with the Nyxis monitoring stack if you want metrics and logs. The monitoring stack is maintained under `nyxis-monitoring/` and can be used by any Nyxis service.

To use it here, wire the MCP container to the stack and set the environment variables shown in the configuration section.

## MCP Tools

### search_hydocs_classes

Search for API classes by name.

Input:

```json
{
  "query": "Player"
}
```

Output (example):

```
- com.hypixel.hydocs.player.Player (class)
- com.hypixel.hydocs.player.PlayerManager (class)
- com.hypixel.hydocs.player.PlayerData (class)
```

### read_hydocs_class_docs

Read full documentation for a class.

Input:

```json
{
  "full_class_name": "com.hypixel.hydocs.player.Player"
}
```

Output (example):

```markdown
# Player

Full markdown documentation for the Player class...
```

## MCP Client Example

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/http.js";

const transport = new StreamableHTTPClientTransport({
  endpoint: "http://localhost:3000/mcp",
});

const client = new Client(
  { name: "my-client", version: "1.0.0" },
  { capabilities: {} }
);

await client.connect(transport);

const result = await client.callTool({
  name: "search_hydocs_classes",
  arguments: { query: "Entity" },
});

console.log(result);
```

## Monitoring (Optional)

If you want metrics and logs, connect the MCP service to the Nyxis monitoring stack and enable the monitoring environment variables. The stack is reusable across Nyxis services.

## Troubleshooting

- If the server cannot find documentation, verify `DOCS_DIR` and `class_lookup.json`.
- If metrics are missing, ensure the MCP container can reach the Pushgateway.
- If logs are missing, set `LOG_LEVEL=info` or `debug`.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Add tests or examples where appropriate.
4. Open a pull request with a clear description.

## License

See `LICENSE`.
