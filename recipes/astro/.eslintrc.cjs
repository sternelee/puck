module.exports = {
  extends: "eslint:recommended",
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-unused-vars": "warn",
  },
  ignorePatterns: ["dist", ".astro", "node_modules"],
};
