// Reviewed intent-to-policy metadata. These are routing constraints, never business answers.
export const policyDomains: [RegExp, string][] = [
  [/\b(leave|time.off)\b/i, 'HR-POL-001'],
  [/\b(recruitment|onboarding|new hire)\b/i, 'HR-POL-002'],
  [/\b(expense|reimburse\w*)\b/i, 'FIN-POL-001'],
  [/\b(approv\w*|approval limit|authority|matrix)\b/i, 'FIN-POL-002'],
  [/\b(procurement|purchase|supplier)\b/i, 'PROC-POL-001'],
  [/\b(inventory|stock|reorder|write.off)\b/i, 'INV-POL-001'],
  [/\b(incident|service desk|P1)\b/i, 'IT-POL-002'],
  [/\b(system access|access profile|provision\w*)\b/i, 'IT-POL-001'],
  [
    /\b(privacy|personal data|customer data|data protection)\b/i,
    'COMP-POL-001',
  ],
  [/\b(bribery|conflict.of.interest|bribe)\b/i, 'COMP-POL-002'],
];
export function policyNeeds(question: string) {
  return policyDomains
    .filter(([pattern]) => pattern.test(question))
    .map(([, id]) => id);
}
