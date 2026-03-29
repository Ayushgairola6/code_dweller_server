import type { Request, Response } from "express";
import {
  ExtractFields,
  GenerateStructuredResponse,
} from "../LLMhandler/ResponseController.ts";

// handles the recursive reasoning
const HandleOrchestration = async (
  prompt: string,
  step: any,
  session_id: string
) => {
  if (!prompt) return { status: false, message: "Invalid prompt" };
  const Modelresponse = await GenerateStructuredResponse(prompt);

  if (Modelresponse?.status === false) {
    return { status: false, error_detail: `The agent is facing some traffic` };
  }
  // await new Promise((resolve) => resolve(2000)); /// 3 second cooldown

  const extractedFields = ExtractFields(Modelresponse?.response, session_id);

  if (extractedFields?.status === false) {
    return {
      status: false,
      message: "The agent is quite busy right now.",
    };
  }

  //  if ai asked for filename

  if (extractedFields.filename) {
    return { status: true, filename: extractedFields.filename };
  }

  if (extractedFields.code_file) {
    return { status: true, code_file: extractedFields.code_file };
  }

  if (extractedFields.final_response) {
    return { status: true, final_response: extractedFields.final_response };
  }
};
type K = string; //type of key
type V = object; //type of value

// cenetral request handler
export const sessions = new Map<
  string,
  {
    memory: any[];
    error_information: any[];
    files_read: Map<K, V>;
    code_files_read: Map<K, V>;
    read_data: string[];
  }
>(); //map to handle file that have been already read
export async function RequestHandler(req: Request, res: Response) {
  try {
    const {
      error_message,
      error_value,
      files,
      options,
      file_content,
      session_id,
      step,
      ///the unique error session_id
    } = req.body;
    // RequestHandler — add file_content to prompt

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({
        status: false,
        message: "Please add necessary markdown files for llm reasoning.",
      });
    }

    if (!session_id || typeof session_id !== "string") {
      return res
        .status(400)
        .json({ status: false, message: "Invalid or missing session_id." });
    }
    // if this the first step create a temprorary buffer for llm error memory
    if (step && step == 1) {
      sessions.set(session_id, {
        memory: [],
        error_information: [{ error_message, error_value }],
        files_read: new Map(),
        code_files_read: new Map(),
        read_data: [],
      });
    }
    const session = sessions.get(session_id);

    if (file_content && file_content.length > 0) {
      session?.read_data.push(...file_content); //update the already ready information
    }
    if (step && step >= 6) {
      return res.status(400).json({
        status: false,
        message: "The agent has reached maximum threshold",
      });
    }

    const prompt = `
${JSON.stringify(session?.error_information)}
previous_summary=${JSON.stringify(session?.memory)}
available_files=${JSON.stringify(files)}
already_read_files=${JSON.stringify(
      Array.from(session?.files_read?.keys() ?? [])
    )}
already_read_code_files=${JSON.stringify(
      Array.from(session?.code_files_read?.keys() ?? [])
    )}
alredy_read_information=${JSON.stringify(
      Array.from(session?.read_data?.keys() ?? [])
    )}
${
  options.allowCodeRead === true
    ? "code_access=allowed"
    : "code_access=not_allowed"
}
`;

    const OrchestratedResults = await HandleOrchestration(
      prompt,
      step,
      session_id
    );

    const orchestration_message = OrchestratedResults?.message;
    // if there was a problem
    if (OrchestratedResults?.status === false) {
      return res
        .status(400)
        .json({ status: false, message: orchestration_message });
    }
    // if file was asked for
    if (OrchestratedResults?.filename) {
      sessions.get(session_id)?.files_read?.set(OrchestratedResults?.filename, {
        content: file_content,
      });
      return res.status(200).json({
        status: true,
        filename: OrchestratedResults.filename,
        code_file: null,
        final_response: null,
      });
    }

    if (OrchestratedResults?.code_file) {
      return res.status(200).json({
        status: true,
        filename: null,
        code_file: OrchestratedResults.code_file,
        final_response: null,
      });
    }

    // clean the memory
    sessions.delete(req?.body?.session_id);

    if (OrchestratedResults?.final_response) {
      return res.status(200).json({
        status: true,
        filename: null,
        code_file: null,
        final_response: OrchestratedResults.final_response,
      });
    }

    return res.status(400).json({
      status: false,
      filename: null,
      code_file: null,
      final_response: null,
    });
  } catch (error: any) {
    if (req?.body?.session_id) {
      sessions.delete(req?.body?.session_id);
    }
    return res.status(500).json({
      status: false,
      message: "There was an error while processing your request",
    });
  }
}
