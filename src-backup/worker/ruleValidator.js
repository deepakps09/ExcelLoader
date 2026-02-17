import validator from 'validator';

/**
 * Validates a single cell value against a specific rule.
 * @param {any} val - The raw value from Excel.
 * @param {Object} rule - The rule object { type, options, message }.
 * @returns {boolean}
 */
export function validateCell(val, rule) {
  // 1. Pre-process: Excel may provide actual Date objects or Numbers.
  // Validator.js only works with strings.
  let s = "";
  if (val instanceof Date) {
    s = val.toISOString(); 
  } else {
    s = String(val ?? "").trim();
  }

  switch (rule.type) {
    // --- BASIC RULES ---
    case 'required':
      return !validator.isEmpty(s, { ignore_whitespace: true });
    
    case 'isEmail':
      return validator.isEmail(s);
    
    case 'isNumeric':
      // options could be { no_symbols: true }
      return validator.isNumeric(s, rule.options);

    case 'isLength':
      // rule.options: { min: 2, max: 10 }
      return validator.isLength(s, rule.options);

    // --- TEXT CONTENT ---
    case 'contains':
      // rule.options: { seed: 'search_term' }
      return validator.contains(s, rule.options.seed || "");

    case 'matches':
      // Allows users to provide a custom Regex string
      // rule.options: { pattern: '^[A-Z]{3}$' }
      return validator.matches(s, new RegExp(rule.options.pattern));

    // --- DATA INTEGRITY ---
    case 'isIn':
      // rule.options: { values: ['Active', 'Inactive'] }
      // This is the "Whitelist" rule
      return validator.isIn(s, rule.options.values || []);

    case 'isURL':
      return validator.isURL(s);

    case 'isMobilePhone':
      // rule.options: { locale: 'en-US' }
      return validator.isMobilePhone(s, rule.options.locale || 'any');

    // --- DATE LOGIC ---
    case 'isDate':
      return validator.isDate(s);

    case 'isAfter':
      // rule.options: { date: '2023-01-01' }
      return validator.isAfter(s, rule.options.date);

    case 'isBefore':
      // rule.options: { date: '2023-01-01' }
      return validator.isBefore(s, rule.options.date);

    default:
      console.warn(`Unknown rule type: ${rule.type}`);
      return true;
  }
}