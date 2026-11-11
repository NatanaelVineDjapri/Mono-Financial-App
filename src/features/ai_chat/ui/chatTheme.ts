// The chat's own surfaces (AI-Chat board). They are the design's literal values, kept here the
// way the tab bar keeps its own palette: they are not part of the twelve colour tokens, and no
// control gets a gradient. Gold is not used in the chat at all; red marks a problem and is always
// paired with an icon and a sentence, and green only a plus-signed amount.
import { MonoColors } from '@/theme/tokens';

export const CHAT = {
  userFill: MonoColors.text, // #F5F5F5
  userText: MonoColors.bg, // #0A0A0A
  assistantFill: '#151516',
  assistantBorder: '#272728',
  draftFill: '#101011',
  draftBorder: '#737373', // dashed while a draft, 1px solid once saved
  barBorder: '#272728',
  errorBorder: MonoColors.negative, // #FF6B6B
} as const;

export const BUBBLE_MAX_WIDTH = '80%';
export const AVATAR_SIZE = 32;
export const CHECKBOX_SIZE = 22;
export const CHECKBOX_RADIUS = 6;
export const DRAFT_BORDER_WIDTH = 1.5;
export const ERROR_BORDER_WIDTH = 1.5;
