// Jest only: the app's default language is English, but most tests were written against the
// Indonesian sentences, so every test file starts in Indonesian. A test that is about English (or
// about switching) sets the language itself and puts it back.
import { useLanguage } from './lang';

beforeEach(() => {
  useLanguage.setState({ language: 'id' });
});
