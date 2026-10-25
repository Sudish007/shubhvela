// Tiny JSON-Schema (draft-07 subset) validator for the content tests: type, required, properties,
// additionalProperties (false | schema), propertyNames.pattern, items, minItems, minProperties, enum, pattern,
// minLength, minimum, maximum. Test-only: nothing in the app validates at runtime. It replaces the planned `ajv`
// devDependency because A05 ran while package-lock.json was being edited by a concurrent step (see
// verification-a05.md); the schemas use only the keywords listed above.
export interface Schema {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  propertyNames?: { pattern?: string };
  items?: Schema;
  minItems?: number;
  minProperties?: number;
  enum?: unknown[];
  pattern?: string;
  minLength?: number;
  minimum?: number;
  maximum?: number;
  [k: string]: unknown;
}

export interface ValidationError {
  path: string;
  message: string;
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeMatches(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  if (expected === 'number' && actual === 'integer') return true;
  return false;
}

export function validate(schema: Schema, value: unknown, path = '$', errors: ValidationError[] = []): ValidationError[] {
  const push = (message: string): void => {
    errors.push({ path, message });
  };
  const actual = typeOf(value);
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(t, actual))) {
      push(`expected ${types.join('|')}, got ${actual}`);
      return errors;
    }
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) push(`value ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
  if (actual === 'string') {
    const s = value as string;
    if (schema.minLength !== undefined && Array.from(s).length < schema.minLength) push(`shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(s)) push(`does not match ${schema.pattern}`);
  }
  if (actual === 'number' || actual === 'integer') {
    const n = value as number;
    if (schema.minimum !== undefined && n < schema.minimum) push(`below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && n > schema.maximum) push(`above maximum ${schema.maximum}`);
  }
  if (actual === 'array') {
    const arr = value as unknown[];
    if (schema.minItems !== undefined && arr.length < schema.minItems) push(`fewer than ${schema.minItems} items`);
    if (schema.items) arr.forEach((item, i) => validate(schema.items as Schema, item, `${path}[${i}]`, errors));
  }
  if (actual === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) push(`fewer than ${schema.minProperties} properties`);
    for (const r of schema.required ?? []) if (!(r in obj)) push(`missing required "${r}"`);
    if (schema.propertyNames?.pattern) {
      const re = new RegExp(schema.propertyNames.pattern, 'u');
      for (const k of keys) if (!re.test(k)) errors.push({ path: `${path}.${k}`, message: `property name does not match ${schema.propertyNames.pattern}` });
    }
    for (const k of keys) {
      const sub = schema.properties?.[k];
      if (sub) {
        validate(sub, obj[k], `${path}.${k}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push({ path: `${path}.${k}`, message: 'additional property not allowed' });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validate(schema.additionalProperties, obj[k], `${path}.${k}`, errors);
      }
    }
  }
  return errors;
}

export function assertValid(schema: Schema, value: unknown, label: string): void {
  const errors = validate(schema, value);
  if (errors.length) {
    const lines = errors.slice(0, 20).map((e) => `  ${e.path}: ${e.message}`);
    throw new Error(`${label}: ${errors.length} schema error(s)\n${lines.join('\n')}${errors.length > 20 ? '\n  …' : ''}`);
  }
}
