module.exports = {
  "extends": "standard-with-typescript",
  "root": true,
  "parserOptions": {
    "project": ["./tsconfig.base.json", "./packages/*/tsconfig.json"],
    "tsconfigRootDir": __dirname
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-misused-promises": [
      "error",
      {
        "checksVoidReturn": {
          "arguments": false
        }
      }
    ],
    "@typescript-eslint/explicit-function-return-type": [
      "error",
      {
//        "allowTypedFunctionExpressions": true
        "allowExpressions": true,
        "allowHigherOrderFunctions": true
      }
    ],
    "@typescript-eslint/strict-boolean-expressions": [
      "error",
      {
        "allowString": true,
        "allowNumber": true
      }
    ],
    "@typescript-eslint/promise-function-async": [
      "error",
      {
        "checkArrowFunctions": false
      }
    ]
  },
  "ignorePatterns": ["*.js"]
}
