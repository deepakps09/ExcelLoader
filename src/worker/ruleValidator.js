import validator from 'validator';
export function validateCell(val, rule) {
  let s = "";
  if (val instanceof Date) {
    s = val.toISOString(); 
  } else {
    s = String(val ?? "").trim();
  }
  switch (rule.type) {
    case 'required':
      return !validator.isEmpty(s, { ignore_whitespace: true });
    case 'isEmail':
      return validator.isEmail(s);
    case 'isNumeric':
      return validator.isNumeric(s, rule.options);
    case 'isLength':
      return validator.isLength(s, rule.options);
    case 'contains':
      return validator.contains(s, rule.options.seed || "");
    case 'matches':
      return validator.matches(s, new RegExp(rule.options.pattern));
    case 'isIn':
      return validator.isIn(s, rule.options.values || []);
    case 'isURL':
      return validator.isURL(s);
    case 'isMobilePhone':
      return validator.isMobilePhone(s, rule.options.locale || 'any');
    case 'isDate':
      return validator.isDate(s);
    case 'isAfter':
      return validator.isAfter(s, rule.options.date);
    case 'isBefore':
      return validator.isBefore(s, rule.options.date);
    default:
      console.warn(`Unknown rule type: ${rule.type}`);
      return true;
  }
}