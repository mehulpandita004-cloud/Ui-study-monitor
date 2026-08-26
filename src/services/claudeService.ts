// ==========================================
// AI Study Coach Service
// Supports Google Gemini (Gemini 3.6 Flash / 3.5 Flash Lite), Anthropic Claude, and OpenAI
// ==========================================

import {
  StudySession,
  FocusScoreBreakdown,
  StudyState,
  AIReport,
  AICoachTip,
  SessionGoal,
  AIModelChoice,
  CoachPersonality,
} from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// ---- Helpers ----

function getApiKey(): string {
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_CLAUDE_API_KEY ||
    import.meta.env.VITE_AI_API_KEY ||
    import.meta.env.VITE_OPENAI_API_KEY ||
    ''
  );
}

function getModelId(model: AIModelChoice): string {
  if (model === 'auto') return 'gemini-3.6-flash';
  return model;
}

function getCoachSystemPrompt(style: CoachPersonality): string {
  const base = `You are an expert AI study coach embedded inside a real-time AI-powered study monitor app. The app uses computer vision (face tracking, eye aspect ratio, head pose, phone detection, posture analysis) to monitor the student's focus during study sessions.`;

  switch (style) {
    case 'encouraging':
      return `${base}\n\nYour tone is warm, supportive, and motivating. You celebrate wins, gently address struggles, and always end with encouragement. Use emojis sparingly but effectively (🌟 ✨ 💪). You are like a kind mentor who genuinely cares about the student's growth.`;
    case 'strict':
      return `${base}\n\nYour tone is direct, no-nonsense, and disciplined. You hold the student to high standards. You are blunt about weaknesses but always constructive. Think of yourself as a respected coach who pushes their athlete to peak performance. Avoid excessive praise.`;
    case 'socratic':
      return `${base}\n\nYour tone is thoughtful, curious, and intellectual. You ask reflective questions to help the student understand their own patterns. You connect study habits to cognitive science. You guide through inquiry rather than commands. Think like a professor having a one-on-one office hours conversation.`;
  }
}

function formatSessionData(session: StudySession, breakdown?: FocusScoreBreakdown | null): string {
  const totalActiveSec =
    session.totalFocusedSec +
    session.totalDistractedSec +
    session.totalDrowsySec +
    session.totalPhoneSec +
    session.totalAwaySec;

  const focusRatio = totalActiveSec > 0 ? Math.round((session.totalFocusedSec / totalActiveSec) * 100) : 100;

  return `
SESSION DATA:
- Cycle Type: ${session.cycleType.replace('_', ' ')}
- Duration: ${Math.round(totalActiveSec / 60)} minutes active study
- Focus Score: ${session.finalFocusScore}/100
- Focus Time Ratio: ${focusRatio}%
- Focused Time: ${Math.round(session.totalFocusedSec / 60)}m ${session.totalFocusedSec % 60}s
- Distracted Time: ${Math.round(session.totalDistractedSec / 60)}m ${session.totalDistractedSec % 60}s
- Drowsy Time: ${Math.round(session.totalDrowsySec / 60)}m ${session.totalDrowsySec % 60}s
- Phone Usage Time: ${Math.round(session.totalPhoneSec / 60)}m ${session.totalPhoneSec % 60}s
- Looking Away Time: ${Math.round(session.totalLookingAwaySec / 60)}m ${session.totalLookingAwaySec % 60}s
- Away From Desk Time: ${Math.round(session.totalAwaySec / 60)}m ${session.totalAwaySec % 60}s
- Break Time: ${Math.round(session.totalBreakSec / 60)}m ${session.totalBreakSec % 60}s
- Average Posture Score: ${session.averagePostureScore}%
- Warning Nudges Triggered: ${session.warningCount}
- Manual Overrides Used: ${session.overridesUsed}
- Completed Cycles: ${session.completedCycles}
${breakdown ? `
FOCUS SCORE BREAKDOWN:
- Current Raw Score: ${breakdown.currentScore}
- Smoothed Score: ${breakdown.smoothedScore}
- Distraction Penalty: -${breakdown.distractionPenalty.toFixed(1)}
- Drowsy Penalty: -${breakdown.drowsyPenalty.toFixed(1)}
- Phone Penalty: -${breakdown.phonePenalty.toFixed(1)}
- Away Penalty: -${breakdown.awayPenalty.toFixed(1)}
- Warning Penalty: -${breakdown.warningPenalty.toFixed(1)}
- Posture Bonus: +${breakdown.postureBonus.toFixed(1)}
` : ''}
- Session Started: ${new Date(session.startedAt).toLocaleString()}
- Session Ended: ${session.endedAt ? new Date(session.endedAt).toLocaleString() : 'In Progress'}
  `.trim();
}

// ---- Google Gemini Handler ----

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  key: string,
  maxTokens: number = 1024
): Promise<string> {
  const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];
  let lastError = '';

  for (const modelName of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
      const payload: any = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userMessage}` }],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.7,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }

      const errJson = await res.json().catch(() => null);
      lastError = errJson?.error?.message || `HTTP ${res.status}`;
    } catch (err: any) {
      lastError = err.message || 'Network error';
    }
  }

  throw new Error(`Google Gemini API error: ${lastError}`);
}

// ---- Core Multi-Provider AI Call ----

async function callAI(
  systemPrompt: string,
  userMessage: string,
  model: AIModelChoice,
  apiKey?: string,
  maxTokens: number = 1024
): Promise<string> {
  const key = (apiKey || getApiKey()).trim();
  if (!key) {
    throw new Error('No AI API key configured. Add your key in Settings → AI Engine.');
  }

  // 1. Google Gemini Key (starts with AIzaSy)
  if (key.startsWith('AIzaSy') || key.startsWith('AIza')) {
    return await callGemini(systemPrompt, userMessage, key, maxTokens);
  }

  const modelId = getModelId(model);

  // 2. Anthropic Claude Key (starts with sk-ant-)
  if (key.startsWith('sk-ant-')) {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: modelId.startsWith('gemini') ? 'claude-3-5-sonnet-20241022' : modelId,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.content && data.content.length > 0 && data.content[0].type === 'text') {
        return data.content[0].text;
      }
    }

    const errorBody = await response.text();
    if (response.status === 401) {
      throw new Error('Claude API key was rejected (401 Unauthorized). Please check your key on console.anthropic.com.');
    }
    throw new Error(`Claude API error (${response.status}): ${errorBody}`);
  }

  // 3. OpenAI / OpenRouter Fallback (standard sk-...)
  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: maxTokens,
      }),
    });

    if (openAiResponse.ok) {
      const data = await openAiResponse.json();
      return data.choices?.[0]?.message?.content || '';
    }
    const errText = await openAiResponse.text();
    throw new Error(`AI API error (${openAiResponse.status}): ${errText}`);
  } catch (openAiErr: any) {
    throw new Error(`API error: ${openAiErr.message}`);
  }
}

// ==========================================
// Public API Methods
// ==========================================

/**
 * Generate comprehensive post-session insights and coaching report.
 */
export async function generatePostSessionInsights(
  session: StudySession,
  breakdown: FocusScoreBreakdown | null,
  style: CoachPersonality = 'encouraging',
  model: AIModelChoice = 'auto',
  apiKey?: string
): Promise<AIReport> {
  const systemPrompt = getCoachSystemPrompt(style);

  const userMessage = `Analyze this study session and provide a comprehensive coaching report.

${formatSessionData(session, breakdown)}

Respond STRICTLY in this JSON format (no markdown fences, pure JSON):
{
  "executiveSummary": "2-3 sentence executive evaluation of the session quality and the student's focus patterns",
  "distractionAnalysis": "2-3 sentences analyzing which distraction types were most problematic and WHY they might have occurred (time of day, fatigue, habit patterns)",
  "actionSteps": ["actionable tip 1", "actionable tip 2", "actionable tip 3"],
  "productivityArchetype": "A creative 2-3 word productivity badge name (e.g. 'Flow State Titan', 'Hyper-Focus Apprentice', 'Rising Strategist')",
  "archetypeEmoji": "single emoji that represents the archetype"
}`;

  const raw = await callAI(systemPrompt, userMessage, model, apiKey, 800);

  // Parse JSON from response
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      id: `ai_report_${Date.now()}`,
      sessionId: session.id,
      generatedAt: Date.now(),
      executiveSummary: parsed.executiveSummary || '',
      distractionAnalysis: parsed.distractionAnalysis || '',
      actionSteps: parsed.actionSteps || [],
      productivityArchetype: parsed.productivityArchetype || 'Study Explorer',
      archetypeEmoji: parsed.archetypeEmoji || '🎯',
      rawMarkdown: raw,
    };
  } catch {
    return {
      id: `ai_report_${Date.now()}`,
      sessionId: session.id,
      generatedAt: Date.now(),
      executiveSummary: raw,
      distractionAnalysis: '',
      actionSteps: [],
      productivityArchetype: 'Study Explorer',
      archetypeEmoji: '🎯',
      rawMarkdown: raw,
    };
  }
}

/**
 * Generate a quick contextual coaching tip during a live study session.
 */
export async function generateLiveCoachingTip(
  currentState: StudyState,
  sessionDurationMin: number,
  warningCount: number,
  postureScore: number,
  focusScore: number,
  style: CoachPersonality = 'encouraging',
  model: AIModelChoice = 'auto',
  apiKey?: string
): Promise<AICoachTip> {
  const systemPrompt = `${getCoachSystemPrompt(style)}\n\nKeep your response to 1-2 sentences maximum. Be concise, contextual, and immediately actionable. Do NOT use JSON format — just give the coaching tip as plain text.`;

  const userMessage = `The student is currently in "${currentState}" state.
- Session running for: ${sessionDurationMin} minutes
- Current focus score: ${focusScore}/100
- Current posture quality: ${postureScore}%
- Warnings triggered so far: ${warningCount}

Give a brief, context-aware coaching nudge.`;

  const message = await callAI(systemPrompt, userMessage, model, apiKey, 150);

  return {
    id: `tip_${Date.now()}`,
    message: message.trim(),
    generatedAt: Date.now(),
    context: currentState,
    isExpanded: true,
  };
}

/**
 * Answer a user's free-form question during a study session.
 */
export async function askCoach(
  question: string,
  currentState: StudyState,
  focusScore: number,
  style: CoachPersonality = 'encouraging',
  model: AIModelChoice = 'auto',
  apiKey?: string
): Promise<string> {
  const systemPrompt = `${getCoachSystemPrompt(style)}\n\nThe student is asking you a question during their study session. They are currently in "${currentState}" state with a focus score of ${focusScore}/100. Answer helpfully and concisely (2-4 sentences max). If the question is about study techniques, memory, or productivity, give practical advice. If it's off-topic, gently redirect them back to studying.`;

  return await callAI(systemPrompt, question, model, apiKey, 300);
}

/**
 * Generate a session goal summary with flashcards and retention analysis.
 */
export async function summarizeSessionGoal(
  goal: SessionGoal,
  session: StudySession,
  style: CoachPersonality = 'encouraging',
  model: AIModelChoice = 'auto',
  apiKey?: string
): Promise<{ summary: string; flashcards: string[]; completionPercent: number }> {
  const systemPrompt = `${getCoachSystemPrompt(style)}\n\nAnalyze the student's study goal completion and generate a structured summary.`;

  const userMessage = `STUDY GOAL: "${goal.topic}"
SESSION NOTES: "${goal.notes || 'No notes provided'}"

${formatSessionData(session)}

Respond STRICTLY in this JSON format (no markdown fences):
{
  "summary": "2-3 sentence recap of what was accomplished in this session relative to the goal",
  "flashcards": ["flashcard Q&A 1 (format: 'Q: ... | A: ...')", "flashcard Q&A 2", "flashcard Q&A 3"],
  "completionPercent": 75
}`;

  const raw = await callAI(systemPrompt, userMessage, model, apiKey, 600);

  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || '',
      flashcards: parsed.flashcards || [],
      completionPercent: Math.min(100, Math.max(0, parsed.completionPercent || 0)),
    };
  } catch {
    return {
      summary: raw,
      flashcards: [],
      completionPercent: 0,
    };
  }
}

/**
 * Test API connection.
 */
export async function testApiConnection(
  apiKey: string,
  model: AIModelChoice = 'auto'
): Promise<{ success: boolean; message: string; modelUsed: string }> {
  try {
    const response = await callAI(
      'You are a helpful assistant.',
      'Reply with exactly: "Connection verified." Nothing else.',
      model,
      apiKey,
      25
    );
    return {
      success: true,
      message: response.trim(),
      modelUsed: apiKey.startsWith('AIzaSy') ? 'Google Gemini 3.6 Flash' : getModelId(model),
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Unknown error',
      modelUsed: getModelId(model),
    };
  }
}

export const claudeService = {
  generatePostSessionInsights,
  generateLiveCoachingTip,
  askCoach,
  summarizeSessionGoal,
  testApiConnection,
};
