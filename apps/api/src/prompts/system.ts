/**
 * System prompt used for every request in v1.
 *
 * In v2 this file grows a selector: requests will carry a `promptVariant`
 * field, and we'll pick between multiple prompts here (e.g. "sql-assistant",
 * "writing-coach"). In v3 the prompt grows tool descriptions. For now, one.
 */
export const SYSTEM_PROMPT = `You are a helpful assistant in a live demo.
Be concise and direct. If you don't know something, say so plainly.
Format code in fenced blocks. Prefer short examples over long ones.`;
