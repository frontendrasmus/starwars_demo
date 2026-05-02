

export type ModelId = `${string}/${string}`;


export interface ModelDescriptor {
  id: ModelId;
  label: string;
  provider: "anthropic" | "openai" | "drawthings";
}


export type PromptId = string;


export interface PromptDescriptor {
  id: PromptId;
  label: string;

  description: string;

  tools: string[];
}
