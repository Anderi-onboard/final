/* Structural checks against a small spec language, used for every model output
   and for the packet. A spec is:
     'string' | 'number' | 'boolean'   a scalar
     { nullable: spec }                 the value or null
     [spec]                             an array of spec items
     { key: spec, ... }                 an object with exactly these keys
     { enum: [...] }                    one of the listed scalars
   Extra or missing keys are errors. Returns a list of problems. */

export function checkSpec(value, spec, path = 'value', errors = []) {
  if (spec === 'string' || spec === 'number' || spec === 'boolean') {
    if (typeof value !== spec) errors.push(`${path}: expected ${spec}`);
    return errors;
  }
  if (spec && spec.enum) {
    if (!spec.enum.includes(value)) errors.push(`${path}: must be one of ${spec.enum.join(' | ')}`);
    return errors;
  }
  if (spec && spec.nullable !== undefined) {
    if (value === null) return errors;
    return checkSpec(value, spec.nullable, path, errors);
  }
  if (Array.isArray(spec)) {
    if (!Array.isArray(value)) { errors.push(`${path}: expected array`); return errors; }
    value.forEach((item, i) => checkSpec(item, spec[0], `${path}[${i}]`, errors));
    return errors;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${path}: expected object`);
    return errors;
  }
  const keys = Object.keys(spec);
  for (const k of Object.keys(value)) if (!keys.includes(k)) errors.push(`${path}.${k}: unexpected key`);
  for (const k of keys) {
    if (!(k in value)) errors.push(`${path}.${k}: missing`);
    else checkSpec(value[k], spec[k], `${path}.${k}`, errors);
  }
  return errors;
}
