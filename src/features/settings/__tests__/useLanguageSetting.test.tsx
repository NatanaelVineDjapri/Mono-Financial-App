import { act, renderHook } from '@testing-library/react-native';

import { setSetting } from '@/data/repo/settings';
import { useChatStore } from '@/features/ai_chat/chatStore';
import { useLanguage } from '@/i18n/lang';

import { LANGUAGE_SETTING, useLanguageSetting } from '../useLanguageSetting';

jest.mock('@/data/db/DbProvider', () => ({ useDb: () => ({ fake: 'db' }) }));
jest.mock('@/data/repo/settings', () => ({ setSetting: jest.fn(async () => {}), getSetting: jest.fn(async () => null) }));

const mockSetSetting = setSetting as jest.MockedFunction<typeof setSetting>;

beforeEach(() => jest.clearAllMocks());

describe('useLanguageSetting', () => {
  test('choosing a language changes it at once and keeps the choice in settings.language', async () => {
    useLanguage.setState({ language: 'en' });
    const { result } = await renderHook(() => useLanguageSetting());
    expect(result.current.language).toBe('en');

    await act(async () => result.current.change('id'));
    expect(useLanguage.getState().language).toBe('id');
    expect(result.current.language).toBe('id');
    expect(mockSetSetting).toHaveBeenCalledWith({ fake: 'db' }, LANGUAGE_SETTING, 'id');

    await act(async () => result.current.change('en'));
    expect(useLanguage.getState().language).toBe('en');
    expect(mockSetSetting).toHaveBeenLastCalledWith({ fake: 'db' }, 'language', 'en');
  });

  test('the chat starts again, because its sentences were written in the old language', async () => {
    useChatStore.getState().addMessage({ role: 'user', text: 'coffee 25k' });
    const { result } = await renderHook(() => useLanguageSetting());
    await act(async () => result.current.change('id'));
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  test('a database error does not undo the change on screen', async () => {
    mockSetSetting.mockRejectedValueOnce(new Error('disk full'));
    const { result } = await renderHook(() => useLanguageSetting());
    await act(async () => result.current.change('en'));
    expect(useLanguage.getState().language).toBe('en');
  });
});
