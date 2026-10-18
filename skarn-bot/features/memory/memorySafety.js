const SENSITIVE_PATTERNS = [
  /\b(health|medical|doctor|dentist|diagnos(?:is|ed)|medication|prescription|therapy|therapist|psychiatr(?:ic|ist)|disability|symptom|surgery)\b/i,
  /\b(trauma|abuse|assault|self[- ]?harm|suicid(?:e|al)|crisis|panic attack)\b/i,
  /\b(sexual|sex life|orientation|intimate|pregnan(?:t|cy)|miscarriage)\b/i,
  /\b(breakup|divorce|relationship conflict|family conflict|domestic violence)\b/i,
  /\b(bank account|credit card|debit card|routing number|salary|income|debt|tax return|social security|ssn)\b/i,
  /\b(password|passcode|secret key|api key|access token|recovery code|private key|seed phrase)\b/i,
  /\b(home address|street address|phone number|email address|passport number|license number)\b/i,
];

function isSensitiveMemoryCandidate(value) {
  if (typeof value !== 'string' || !value.trim()) return true;
  return SENSITIVE_PATTERNS.some(function(pattern) { return pattern.test(value); });
}

module.exports = { isSensitiveMemoryCandidate };
