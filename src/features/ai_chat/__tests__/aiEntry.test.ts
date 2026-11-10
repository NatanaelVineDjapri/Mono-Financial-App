import { aiEntryRoute } from '../aiEntry';

describe('aiEntryRoute', () => {
  test('opens the chat once AI is set up, the setup flow before that', () => {
    expect(aiEntryRoute(true)).toBe('/ai-chat');
    expect(aiEntryRoute(false)).toBe('/ai-setup');
  });
});
