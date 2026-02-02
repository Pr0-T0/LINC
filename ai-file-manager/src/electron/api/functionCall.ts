import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import * as z from "zod";

import { executeSQL } from "../db/exeSQL.js";
import { displayResult } from "../test/displaySQL.js";
import "dotenv/config";
import { createFolder } from "../tools/createFolder.js";


// const model = new ChatGoogleGenerativeAI({
//   model : "gemini-2.5-flash",
//   temperature: 0,
//   apiKey: process.env.GEMINI_API_KEY,
// });

import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "llama-3.3-70b-versatile", // or other Groq models
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
  configuration: {
    baseURL: "https://api.groq.com/openai/v1",
  },
});



const query_file_index = tool(
  async ({ query , purpose }) => {
    console.log("query_file_index called with:", query ,  purpose);
    log("info","Searching Files..");

    const rows = queryFiles(query);
    const result = normalizeSQLResult(rows);

    return { result , purpose };
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
      purpose: z.enum(["display", "resolve"]).describe(
        "display = user-visible results, resolve = internal path lookup"
      ),
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



//augment with tools

const toolsByName = {
  [createfolder.name] : createfolder,
  [query_file_index.name] : query_file_index,
  [display_result_to_ui.name] : display_result_to_ui,
  [moveorcopypath.name] : moveorcopypath,
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
      new SystemMessage(
        "You are a helpfull file manager assistant named LINC tasked with performing file operations.all file metadata information is stored in a sql db which is not visible or known to the user.always try to display the final result to the user not only the text responce"

      ),
      ...state.messages,
    ]),
    llmCalls: (state.llmCalls ?? 0) + 1,
  };
}

//tool node def

import { isAIMessage, ToolMessage } from "@langchain/core/messages";

async function toolNode(state:z.infer<typeof MessagesState>) {
  const LastMessage = state.messages.at(-1);

  if (LastMessage == null || !isAIMessage(LastMessage)){
    return { messages: []}
  }

  const result: ToolMessage[] = [];
  for (const toolCall of LastMessage.tool_calls ?? []){
    const tool = toolsByName[toolCall.name];
    const observation = await (tool as Runnable).invoke(toolCall);
    result.push(observation);
  }

  return { messages: result};
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
  .compile();

// Invoke
import { HumanMessage } from "@langchain/core/messages";
// import { clear } from "console";
import { moveorCopyPath } from "../tools/moveorCopyPath.js";
import { normalizeSQLResult } from "../tools/normalizeSQLResult.js";
import { queryFiles } from "../db/db.js";
import { log } from "../logger.js";
import { Runnable } from "@langchain/core/runnables";

// import { console } from "inspector"; this import ruined two days of development :)
// const result = await agent.invoke({
//   messages: [new HumanMessage("who are you")],
// });


export async function runAgent(userInput: string) {
  let aggregatedItems: any[] = [];
  let aggregatedKind: "files" | null = null;



  const result = await agent.invoke({
    messages: [new HumanMessage(userInput)],
  });

  for (const message of result.messages) {
    console.log(`[${message.getType()}]: ${message.text}`);
  }

  //capture file paths and meta information
  for (const msg of result.messages) {
    if (msg.getType() === "tool" && msg.name === "query_file_index") {
      const parsed = JSON.parse(msg.text);

      if (parsed.purpose === "display") {
        if (parsed.result?.items?.length) {
          aggregatedItems.push(...parsed.result.items);
          aggregatedKind = parsed.result.kind;
        }
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