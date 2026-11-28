const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // Offline-first (CLAUDE.md rule 8): only src/features/ai_chat, src/features/fx and
    // src/features/portfolio (stock prices) may call the network.
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['src/features/ai_chat/**', 'src/features/fx/**', 'src/features/portfolio/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'fetch is only allowed inside src/features/ai_chat or src/features/fx (CLAUDE.md rule 8).' },
      ],
    },
  },
  {
    // The financial health score is a formula (Analysis tab): the AI chat must never read or use it.
    files: ['src/features/ai_chat/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/domain/health', '@/domain/health/*', '**/domain/health', '**/domain/health/*'], message: 'The AI chat must not import the health score (src/domain/health).' },
            { group: ['@/features/analysis', '@/features/analysis/*', '**/features/analysis', '**/features/analysis/*'], message: 'The AI chat must not import src/features/analysis.' },
          ],
        },
      ],
    },
  },
  {
    // ...and the score never calls a language model: no AI module inside it.
    // (Only src/features/analysis/ai, the optional AI review's own folder, may use it.)
    files: ['src/domain/health/**/*.{ts,tsx}', 'src/features/analysis/**/*.{ts,tsx}'],
    ignores: ['src/features/analysis/ai/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/features/ai_chat', '@/features/ai_chat/*', '**/features/ai_chat', '**/features/ai_chat/*'], message: 'The health score is a formula: it must not use the AI module.' },
          ],
        },
      ],
    },
  },
];
