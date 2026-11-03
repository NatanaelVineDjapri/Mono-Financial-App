const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // Offline-first (CLAUDE.md rule 8): only src/features/ai_chat may call the network.
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['src/features/ai_chat/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'fetch is only allowed inside src/features/ai_chat (CLAUDE.md rule 8).' },
      ],
    },
  },
];
