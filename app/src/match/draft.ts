// Pick-screen drafts (F29/F30): what each side is while the user is choosing - a profile, the "Enter details" form,
// a typed code or a scanned code - and the pure conversion to a MatchSide (the result route's input). Entered details
// are encoded to a 20-character code (lossless to the minute and to 0.01 deg, the same rounding the gazetteer uses).
import { encodeShareCode } from '@shubhvela/engine';
import type { Profile } from '../db/profiles';
import type { Lang, TFn } from '../i18n';
import { EMPTY_FORM, validateForm, type BirthFormValue, type FormErrors } from '../profiles/validate';
import type { Tradition } from '../db/settings';
import { decodeShared, payloadFromForm, typedCodeProgress } from '../share/payload';
import type { MatchSide } from './model';

export type SideDraft =
  | { mode: 'profile'; id: number }
  | { mode: 'enter'; form: BirthFormValue; errors: FormErrors }
  | { mode: 'type'; text: string; touched: boolean }
  | { mode: 'scan'; code: string | null };

export type DraftMode = SideDraft['mode'];

export function emptyEnterDraft(defaults: { tradition: Tradition; pdfLanguage: Lang }): SideDraft {
  return { mode: 'enter', form: EMPTY_FORM({ ...defaults, relationship: 'other' }), errors: {} };
}

export type DraftProblem = 'empty' | 'form' | 'code' | 'scan';

export type DraftResult = { ok: true; side: MatchSide } | { ok: false; problem: DraftProblem; draft: SideDraft };

/** Validates a draft and returns the MatchSide, or the problem with the draft updated (form errors, touched flag). */
export function draftToSide(draft: SideDraft, now: Date = new Date()): DraftResult {
  switch (draft.mode) {
    case 'profile':
      return { ok: true, side: { kind: 'profile', id: draft.id } };
    case 'enter': {
      const errors = validateForm(draft.form, now);
      if (Object.keys(errors).length) return { ok: false, problem: 'form', draft: { ...draft, errors } };
      const code = encodeShareCode(payloadFromForm(draft.form));
      const name = draft.form.name.trim();
      return { ok: true, side: { kind: 'code', code, label: name || null, source: 'entered' } };
    }
    case 'type': {
      const payload = decodeShared(draft.text, now.getTime());
      if (!payload) return { ok: false, problem: 'code', draft: { ...draft, touched: true } };
      return { ok: true, side: { kind: 'code', code: encodeShareCode(payload), label: null, source: 'typed' } };
    }
    case 'scan':
      if (!draft.code) return { ok: false, problem: 'scan', draft };
      return { ok: true, side: { kind: 'code', code: draft.code, label: null, source: 'scanned' } };
  }
}

/** Typed-field state: null while the user is still typing (not yet 20 characters and untouched), else valid/invalid. */
export function typedState(text: string, touched: boolean, nowMs: number): 'typing' | 'valid' | 'invalid' {
  const p = typedCodeProgress(text);
  if (p.complete || touched) return decodeShared(text, nowMs) ? 'valid' : 'invalid';
  return 'typing';
}

/** Both sides are stored profiles and the same one. */
export function sameProfile(a: SideDraft | null, b: SideDraft | null): boolean {
  return !!a && !!b && a.mode === 'profile' && b.mode === 'profile' && a.id === b.id;
}

/** Display label of a draft (for the summary line under the chips). */
export function draftLabel(draft: SideDraft | null, profiles: readonly Profile[], t: TFn): string | null {
  if (!draft) return null;
  if (draft.mode === 'profile') {
    const p = profiles.find((x) => x.id === draft.id);
    return p ? (p.name?.trim() ? p.name : t(`family.relation.${p.relationship}`)) : null;
  }
  if (draft.mode === 'enter') return draft.form.name.trim() || t('match.enteredDetails');
  return t('match.fromCode');
}
