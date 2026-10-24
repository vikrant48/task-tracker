// Password rules for new accounts. Shared by the signup form (live hints) and the server action (enforced).
export const PASSWORD_RULES = [
    { id: 'length', label: 'At least 6 characters', test: (p: string) => p.length >= 6 },
    { id: 'upper', label: 'One capital letter (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
    { id: 'special', label: 'One special character (e.g. ! @ # $ %)', test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
] as const;

export const isStrongPassword = (password: string) => PASSWORD_RULES.every((rule) => rule.test(password));
