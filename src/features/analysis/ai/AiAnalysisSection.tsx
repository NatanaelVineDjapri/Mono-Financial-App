// The AI review of the Analysis screen: the hook (what to show, when to ask) and the card (how it looks), wired to
// the router for "Set up AI". This folder is the only part of the Analysis feature allowed to touch the AI module.
import { useRouter } from 'expo-router';

import type { AnalysisData } from '../data';
import { AiAnalysisCard } from './AiAnalysisCard';
import { useAiAnalysis } from './useAiAnalysis';

export function AiAnalysisSection({ data }: { data: AnalysisData }) {
  const router = useRouter();
  const ai = useAiAnalysis(data);
  return (
    <AiAnalysisCard
      state={ai.state}
      onSetup={() => router.push('/ai-setup' as never)}
      onAllow={() => void ai.allow()}
      onNotNow={ai.notNow}
      onTurnOff={() => void ai.turnOff()}
      onRetry={ai.retry}
    />
  );
}
