// Runs scripts/ai-eval.ts (npm run ai-eval). Separate from the app's test projects on purpose:
// it talks to the real Gemini API and only runs when GEMINI_API_KEY is set.
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['<rootDir>/scripts/ai-eval.ts'],
};
