import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { SYSTEM_PROMPT } from "../Prompts/prompt.ts";
import { sessions } from "../Orchestration/Orchestrator.main.ts";
dotenv.config();
const GEMINI_KEY = process.env.GEMINI_KEY;
export const memory: any = [];
export const error_information: any = [];
const gemini = new GoogleGenAI({ apiKey: GEMINI_KEY });

// strcuture of the repsonse it generates
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description:
        "Simple memory points so that you can easily understand in the next step, what you did and thought",
    },
    filename: {
      type: Type.STRING,
      nullable: true,
      description:
        "MUST be an exact filename from the files array provided in the input. DO NOT invent or guess filenames. Null if not needed.",
    },
    code_file: {
      type: Type.STRING,
      nullable: true,
      description:
        "MUST be an exact filepath from the files array provided in the input. Only set this after reading architecture files first. Null if not needed.",
    },
    final_response: {
      type: Type.STRING,
      nullable: true,
      description:
        "Complete fix explanation. Only set when you have enough context. Null if you still need to read files.",
    },
  },
  required: ["summary"],
};

// generates strcutued response with extractable fields

export async function GenerateStructuredResponse(StructuredQuery: string) {
  const result = await gemini.models.generateContent({
    model: "gemini-2.0-flash-lite",

    contents: [
      {
        role: "user",
        parts: [
          {
            text: StructuredQuery,
          },
        ],
      },
    ],

    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7,
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });

  if (result.text) {
    const response = JSON.parse(result?.text);

    return { status: true, response: response };
  }

  return { status: false, response: null };
}

// utility function to extract fields from the llm response
export function ExtractFields(JsonResponse: any, session_id: string) {
  if (!JsonResponse) return { status: false, message: "Invalid response type" };

  // push summary first always
  if (JsonResponse?.summary) {
    sessions.get(session_id)?.memory.push({ summary: JsonResponse.summary });
  }

  if (JsonResponse?.filename)
    return { status: true, filename: JsonResponse.filename };

  if (JsonResponse?.code_file)
    return { status: true, code_file: JsonResponse.code_file };

  if (JsonResponse?.final_response)
    return { status: true, final_response: JsonResponse.final_response };

  return { status: false, message: "No information was asked by the llm" };
}
