import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": 1,
      "no-prototype-builtins": 1,
      "@typescript-eslint/no-unused-vars": 1,
      "semi": ["warn", "always"]
    }
  }
);