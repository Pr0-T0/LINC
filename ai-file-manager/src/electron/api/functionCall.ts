import { tool } from "@langchain/core/tools";
import * as z from "zod";


import "dotenv/config";
import { createFolder } from "../tools/createFolder.js";
import { MemorySaver } from "@langchain/langgraph";


const memory = new MemorySaver(); //defines the agent memory

// const model = new ChatGoogleGenerativeAI({
//   model : "gemini-2.5-flash",
//   temperature: 0,
//   apiKey: process.env.GEMINI_API_KEY,
// });

const resultCache = new Map<string, any[]>();
function generateResultId(){
  return "res_" + Math.random().toString(36).slice(2, 10);
}

import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "openai/gpt-oss-120b", // or other Groq models
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
  configuration: {
    baseURL: "https://api.groq.com/openai/v1",
  },
});


const query_file_index = tool(
  async ({ query, purpose }) => {
    console.log("query_file_index called with:", query, purpose);
    log("info", "Searching Files..");

    const rows = queryFiles(query);
    const result = normalizeSQLResult(rows);

    const resultId = generateResultId();

    if (result.kind === "files") {
      resultCache.set(resultId, result.items);
    } else {
      resultCache.set(resultId, []);
    }
    const preview = result.kind === "files" ? result.items.slice(0,5) : [];


    return {
      result_id: resultId,
      purpose,
      result: {
        kind: result.kind,
        count: result.kind === "files" ? result.items.length : 0,
        preview
      },
    };
  },
  {
    name: "query_file_index",
    description:
      "Query the indexed file system using a structured query object. " +
      "Do NOT generate SQL. Do NOT guess paths.",
    schema: z.object({
      query: z.object({
        parentName: z.string().optional(),
        type: z.enum(["file", "directory"]).optional(),
        extension: z.string().optional(),
        nameLike: z.string().optional(),
        sortBy: z.enum(["name", "modified_at", "size"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        limit: z.number().optional(),
      }),
      purpose: z.enum(["display", "resolve"]),
    }),
  }
);


export const display_result_to_ui = tool(
  async ({ result, message }) => {
    // No side effects here.
    // Just declare the final UI payload.
    log("info","Trying To display Result");
    return {
      payload: {
        ...result,   // { kind, items | metric/value }
        message,     // brief human-readable explanation
      },
    };
  },
  {
    name: "display_result_to_ui",
    description:
      "Finalize the AI response and make it available to the frontend UI. " +
      "This tool marks the end of reasoning.",
    schema: z.object({
      result: z.object({
        kind: z.enum(["files", "aggregate","conversation"]),
      }).passthrough(),
      message: z
        .string()
        .describe("Short, user-facing explanation of the result"),
    }),
  }
);



const createfolder = tool(
  async ( { path } ) => {
    console.log("createFolder called");
    log("info","Creating Folder");


    const result = await createFolder(path);
    if ("error" in result) {
      return {
        status : "error : Absolute path required. Use query_file_index to fetch a file path from the target directory",
        error : result.error,
      };
    }
    return {
      status : "created",
      path : result.path,
    };
  }, 
  {
    name : "createfolder",
    description : "Create a new folder at the given absolute path and update the index file database.- The path must already be resolved.- Do not guess or fabricate paths.- Use query_file_index to resolve directory paths when needed.",
    schema : z.object({
      path : z.string().describe("Absolute path of the folder to create"),
    }),
  }
);
const moveorcopypath = tool(
  async ({ sourcePath, destinationPath, operation }) => {
    console.log("moveOrCopyPath called");
    log("info","Moving Files...");

    const result = await moveorCopyPath(
      sourcePath,
      destinationPath,
      operation
    );

    if ("error" in result) {
      return {
        status:
          "error : Absolute paths required. Do not guess paths. Use query_file_index to resolve file or directory paths before calling this tool.",
        error: result.error,
      };
    }

    return {
      status: operation === "cut" ? "moved" : "copied",
      path: result.path,
    };
  },
  {
    name: "moveorcopypath",
    description:
      "Copy or move (cut) a file or folder from a resolved absolute source path to a resolved absolute destination path. " +
      "Do not fabricate paths. " +
      "Use sqlgen_exesql to resolve both source and destination paths before calling this tool.",
    schema: z.object({
      sourcePath: z
        .string()
        .describe("Absolute path of the source file or folder"),
      destinationPath: z
        .string()
        .describe(
          "Absolute destination directory or full target path"
        ),
      operation: z
        .enum(["copy", "cut"])
        .describe("Operation type: copy (duplicate) or cut (move)"),
    }),
  }
);

const sendfiles = tool(
  async ({ peerName, filePaths }) => {
    log("info","Sending Files...");

    const result = await sendFilesTool({
      peerName,
      filePaths,
    });

    if (!result.success) {
      return {
        status:
          "error: Could not send files. Ensure peer is online and paths are resolved using query_file_index.",
        error: result.error,
      };
    }

    return {
      status: result.accepted ? "accepted" : "rejected",
      accepted: result.accepted,
    };
  },
  {
    name: "sendfiles",
    description:
      "Send resolved files to a peer device over LAN. " +
      "Do NOT guess file paths. " +
      "Use query_file_index with purpose='resolve' to get exact file paths before calling this tool.",
    schema: z.object({
      peerName: z.string().describe("Exact discovered device name"),
      filePaths: z
        .array(z.string())
        .describe("Absolute file paths already resolved"),
    }),
  }
);

const getOnlinePeers = tool(
  async () => {
    const peers = getLanDevices();

    if (!peers.length) {
      return "No peers are currently online.";
    }

    return peers.map(p => ({
      name: p.name,
      deviceId: p.deviceId,
      address: p.address,
      port: p.httpPort,
      uptime: p.uptime
    }));
  },
  {
    name: "get_online_peers",
    description:
      "Returns a list of currently online LAN peers available for file transfer.",
    schema: z.object({}) // no input needed
  }
);



//augment with tools

const toolsByName = {
  [createfolder.name] : createfolder,
  [query_file_index.name] : query_file_index,
  [display_result_to_ui.name] : display_result_to_ui,
  [moveorcopypath.name] : moveorcopypath,
  [sendfiles.name]: sendfiles,
  [getOnlinePeers.name]: getOnlinePeers,
};
const tools = Object.values(toolsByName);
const modelWithTools = model.bindTools(tools);

//define states
import { StateGraph, START, END, MessagesZodMeta } from "@langchain/langgraph";
import { registry } from "@langchain/langgraph/zod";
import { type BaseMessage } from "@langchain/core/messages";

const MessagesState = z.object({
  messages: z
      .array(z.custom<BaseMessage>())
      .register(registry, MessagesZodMeta),
    llmCalls: z.number().optional(),
});

//model node defenition
import { SystemMessage } from "@langchain/core/messages";

async function llmCall(state:z.infer<typeof MessagesState>) {
  return {
    messages:  await modelWithTools.invoke([
      new SystemMessage(`
        You are LINC, a strict and reliable file system assistant.

        CRITICAL RULES:

        1. NEVER fabricate file paths.
        2. NEVER guess directories.
        3. All file metadata exists ONLY inside the indexed SQL database.
        4. To locate files or folders, ALWAYS use query_file_index.
        5. If performing operations (create, move, copy, send):
          - First resolve paths using query_file_index with purpose="resolve".
          - Then call the appropriate tool.

        6. If the user requests to SEND files:
          - Resolve file paths first.
          - Ensure peer name matches discovered device.
          - Then call sendfiles tool.

        7. When finished reasoning, ALWAYS call display_result_to_ui.
          - This marks the final response.
          - Do not end with plain text unless it is purely conversational.

        8. If something fails:
          - Explain clearly.
          - Do not hallucinate success.

        9. Do NOT generate SQL.
        10. Do NOT expose internal database structure.

        Behavior Model:

        User intent → Resolve metadata → Execute tool → Display result.

        Be deterministic.
        Be safe.
        Be accurate.
        `),
      ...state.messages,
    ]),
    llmCalls: (state.llmCalls ?? 0) + 1,
  };
}

//tool node def

import { isAIMessage, ToolMessage } from "@langchain/core/messages";

// async function toolNode(state:z.infer<typeof MessagesState>) {
//   const LastMessage = state.messages.at(-1);

//   if (LastMessage == null || !isAIMessage(LastMessage)){
//     return { messages: []}
//   }

//   const result: ToolMessage[] = [];
//   for (const toolCall of LastMessage.tool_calls ?? []){
//     const tool = toolsByName[toolCall.name];
//     const observation = await (tool as Runnable).invoke(toolCall);
//     result.push(observation);
//   }

//   return { messages: result};
// }

async function toolNode(state: z.infer<typeof MessagesState>) {
  const lastMessage = state.messages.at(-1);

  if (!lastMessage || !isAIMessage(lastMessage)) {
    return { messages: [] };
  }

  const results: ToolMessage[] = [];

  for (const toolCall of lastMessage.tool_calls ?? []) {
    const tool = toolsByName[toolCall.name];
    if (!tool) continue;

    const rawOutput = await (tool as Runnable).invoke(toolCall.args);

    const content =
      typeof rawOutput === "string"
        ? rawOutput
        : JSON.stringify(rawOutput);

    results.push(
      new ToolMessage({
        tool_call_id: toolCall.id!,
        name: toolCall.name,          // CRITICAL FOR GROQ
        content,                      // MUST BE STRING
      })
    );
  }

  return { messages: results };
}

//end or continue
async function shouldContinue(state: z.infer<typeof MessagesState>) {
  const lastMessage = state.messages.at(-1);
  if (lastMessage == null || !isAIMessage(lastMessage)) return END;

  // If the LLM makes a tool call, then perform an action
  if (lastMessage.tool_calls?.length) {
    return "toolNode";
  }

  // Otherwise, we stop (reply to the user)
  return END;
}

// Step 6: Build and compile the agent

const agent = new StateGraph(MessagesState)
  .addNode("llmCall", llmCall)
  .addNode("toolNode", toolNode)
  .addEdge(START, "llmCall")
  .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END])
  .addEdge("toolNode", "llmCall")
  .compile({
    checkpointer: memory
  });

// Invoke
import { HumanMessage } from "@langchain/core/messages";
// import { clear } from "console";
import { moveorCopyPath } from "../tools/moveorCopyPath.js";
import { normalizeSQLResult } from "../tools/normalizeSQLResult.js";
import { queryFiles } from "../db/db.js";
import { log } from "../logger.js";
import { Runnable } from "@langchain/core/runnables";
import { sendFilesTool } from "../p2p/sendFile.js";
import { getLanDevices } from "../p2p/presence.js";

// import { console } from "inspector"; this import ruined two days of development :)
// const result = await agent.invoke({
//   messages: [new HumanMessage("who are you")],
// });


export async function runAgent(userInput: string, sessionId: string) {
  let aggregatedItems: any[] = [];
  let aggregatedKind: "files" | null = null;



  const result = await agent.invoke(
    {
    messages: [new HumanMessage(userInput)],
    },
    {
      configurable: {thread_id: sessionId}
    }
  );

  for (const message of result.messages) {
    console.log(`[${message.getType()}]: ${message.text}`);
  }

  //capture file paths and meta information
  for (const msg of result.messages) {
    if (msg.getType() === "tool" && msg.name === "query_file_index") {
      const parsed = JSON.parse(msg.text);

      if (parsed.purpose === "display") {
        const cached = resultCache.get(parsed.result_id) ?? [];

        
          aggregatedItems = [...cached];
          aggregatedKind = "files";
      }
    }
  }



  //For sending Data to Frontend
  for (const msg of result.messages) {
    if (msg.getType() === "tool" && msg.name === "display_result_to_ui") {
      const parsed = JSON.parse(msg.text);

      return {
        kind: aggregatedKind ?? parsed.payload.kind,
        items: aggregatedItems,
        message: parsed.payload.message,
      };
    }
  }

  // coversational fallback
  const lastAI = [...result.messages]
    .reverse()
    .find(m => m.getType() === "ai");
  if (lastAI) {
    return {
      kind: "conversation",
      message: lastAI.text,
    };
  }

  // fallback (important)
  return {
    kind: "aggregate",
    metric: "error",
    value: "No displayable result",
    message: "AI did not produce a UI result.",
  };

 // return result; // full result including messages + tool traces
}


// for (const message of result.messages) {
//   console.log(`[${message.getType()}]: ${message.text}`);
// }