// The one place that knows WHICH model "Ask my chart" runs (F35, plan.md section 1 Gemma facts, verified 2026-10-24
// against the Hugging Face API): repo litert-community/gemma-4-E2B-it-litert-lm, file gemma-4-E2B-it.litertlm,
// 2,588,147,712 bytes, SHA-256 below. Every size the UI prints is computed from MODEL_BYTES (D8: nothing typed twice).
export const MODEL_REPO = 'litert-community/gemma-4-E2B-it-litert-lm';
export const MODEL_FILE_NAME = 'gemma-4-E2B-it.litertlm';
export const MODEL_URL = `https://huggingface.co/${MODEL_REPO}/resolve/main/${MODEL_FILE_NAME}`;
export const MODEL_BYTES = 2_588_147_712;
export const MODEL_SHA256 = '181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c';
/** Gemma terms of use (the consent screen links to it; the HF repo is tagged apache-2.0, the weights carry Gemma's terms). */
export const GEMMA_TERMS_URL = 'https://ai.google.dev/gemma/terms';
/** Sub-directory of the app's documents directory that holds the model (design 10.7: "storage location" on consent). */
export const MODEL_DIR_NAME = 'models';

const GB = 1_000_000_000;

/** "2.6 GB": decimal gigabytes to one decimal, the way Hugging Face and Android's storage settings print sizes. */
export function gbLabel(bytes: number): string {
  return `${(bytes / GB).toFixed(1)} GB`;
}

/** The model's size for every consent / row / delete string ("2.6 GB" for 2,588,147,712 bytes). */
export function modelSizeLabel(): string {
  return gbLabel(MODEL_BYTES);
}
