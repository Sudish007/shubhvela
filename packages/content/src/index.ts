// @shubhvela/content: loaders, t() and completeness tests arrive in A05.
export const CONTENT_LANGUAGES = ['en', 'hi', 'bho'] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];
