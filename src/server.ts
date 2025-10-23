import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import dotenv from "dotenv";

// Carrega as variáveis definidas no arquivo .env
dotenv.config({ path: "/.env" });

// Create an MCP server
const server = new McpServer({
  name: "demo-server",
  version: "1.0.0",
});

// Add an addition tool
server.registerTool(
  "add",
  {
    title: "Addition Tool",
    description: "Add two numbers",
    inputSchema: { a: z.number(), b: z.number() },
    outputSchema: { result: z.number() },
  },
  async ({ a, b }) => {
    const output = { result: a + b };
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    };
  }
);

// https://openlibrary.org/search.json?q=the+lord+of+the+rings
// --------------------------------------------------
// Tool: search_books
// --------------------------------------------------
server.registerTool(
  "search-books",
  {
    title: "Search books",
    description:
      "Search for books in the Open Library API by title, author, or keyword",
    inputSchema: { query: z.string() },
    outputSchema: {
      docs: z.array(
        z.object({
          title: z.string(),
          author: z.string(),
          first_publish_year: z.number(),
          edition_count: z.number(),
        })
      ),
    },
  },
  async ({ query }) => {
    const url = `${process.env.OPENLIBRARY_URL}?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const data = await response.json();
    const output = (data.docs || []).slice(0).map((book: any) => ({
      title: book.title,
      author: book.author_name ? book.author_name.join(", ") : "Unknown",
      first_publish_year: book.first_publish_year,
      edition_count: book.edition_count,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    };
  }
);

// Set up Express and HTTP transport
const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  // Create a new transport for each request to prevent request ID collisions
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || "3000");
app
  .listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
  })
  .on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
