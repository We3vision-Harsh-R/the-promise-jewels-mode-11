/** @type {import("prettier").Config} */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  overrides: [
    {
      // The Express codebase is TypeScript and already written with semicolons
      // and double quotes; keep it that way so a format pass does not churn it.
      files: 'server/**/*.ts',
      options: { semi: true, singleQuote: false },
    },
  ],
}
