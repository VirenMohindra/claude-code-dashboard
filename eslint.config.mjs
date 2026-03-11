export default [
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        structuredClone: "readonly",
      },
    },
    rules: {
      // Errors
      "no-undef": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-constant-condition": "error",
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-unsafe-negation": "error",
      "use-isnan": "error",
      "valid-typeof": "error",

      // Best practices
      eqeqeq: ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-throw-literal": "error",
      "prefer-const": "error",
      "no-var": "error",

      // Style (light touch — prettier handles formatting)
      "no-trailing-spaces": "error",
      "no-multiple-empty-lines": ["error", { max: 2 }],
    },
  },
  {
    ignores: ["node_modules/", "dashboard.html"],
  },
];
