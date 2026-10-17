import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import {
    aiRequestSchema,
    breakdownResponseSchema,
    naturalLogResponseSchema,
    weeklyReportResponseSchema,
    HABIT_CATEGORIES,
    type AIRequest,
} from '@/lib/ai-schemas';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_TIMEOUT_MS = 30_000;

const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

// Groq retires models regularly, so the account's model list is checked at runtime and the choice
// cached. Preferred chat models, best first. Set GROQ_MODEL to pin a specific model instead.
const PREFERRED_MODELS = [
    'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
    'llama-3.1-8b-instant',
];
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000;
const MODEL_CACHE_TTL_ON_ERROR_MS = 5 * 60 * 1000;

// Listed models that can't do chat completions (speech-to-text, text-to-speech, safety classifiers)
const NON_CHAT_MODEL_PATTERN = /whisper|orpheus|tts|guard/i;
// Reasoning models: keep reasoning short so it doesn't consume the output token budget
const REASONING_MODEL_PATTERN = /gpt-oss|qwen3/i;

let cachedModel: { id: string; expiresAt: number } | null = null;

async function resolveModel(apiKey: string): Promise<string> {
    if (process.env.GROQ_MODEL) return process.env.GROQ_MODEL;
    if (cachedModel && cachedModel.expiresAt > Date.now()) return cachedModel.id;

    try {
        const res = await fetch(`${GROQ_BASE_URL}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(5_000),
        });

        if (res.ok) {
            const data = (await res.json()) as { data?: { id: string; active?: boolean }[] };
            const available = (data.data ?? [])
                .filter((m) => m.active !== false && !NON_CHAT_MODEL_PATTERN.test(m.id))
                .map((m) => m.id);
            const model = PREFERRED_MODELS.find((id) => available.includes(id)) ?? available[0] ?? DEFAULT_MODEL;
            cachedModel = { id: model, expiresAt: Date.now() + MODEL_CACHE_TTL_MS };
            return model;
        }
        console.warn('Groq models list returned', res.status);
    } catch (e) {
        console.warn('Could not fetch Groq models list, using default:', e);
    }

    // Retry discovery sooner when the lookup itself failed
    cachedModel = { id: DEFAULT_MODEL, expiresAt: Date.now() + MODEL_CACHE_TTL_ON_ERROR_MS };
    return DEFAULT_MODEL;
}

type GroqResult = { ok: true; content: string } | { ok: false; status: number };

async function callGroq(apiKey: string, model: string, system: string, user: string, jsonMode: boolean): Promise<GroqResult> {
    const body: Record<string, unknown> = {
        model,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ],
        temperature: 0.5,
        max_completion_tokens: 1200,
    };
    if (jsonMode) body.response_format = { type: 'json_object' };
    if (REASONING_MODEL_PATTERN.test(model)) body.reasoning_effort = 'low';

    const post = () =>
        fetch(`${GROQ_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
        });

    let res = await post();

    // A 400 usually means this model rejects an optional parameter: retry once without them.
    // Other failures (429, 5xx) are not retried so we don't double the load.
    if (res.status === 400 && (body.response_format || body.reasoning_effort)) {
        console.warn(`Groq 400 with optional params (${model}):`, await res.text());
        delete body.response_format;
        delete body.reasoning_effort;
        res = await post();
    }

    if (!res.ok) {
        console.error(`Groq API error (${model}, ${res.status}):`, await res.text());
        // Model retired / not found: rediscover on the next request
        if (res.status === 400 || res.status === 404) cachedModel = null;
        return { ok: false, status: res.status };
    }

    const data = await res.json();
    return { ok: true, content: String(data.choices?.[0]?.message?.content ?? '') };
}

// Parse model JSON (tolerating a ```json fence) and validate its shape
function parseModelJson<T>(content: string, schema: ZodType<T>): T | null {
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try {
        const result = schema.safeParse(JSON.parse(cleaned));
        return result.success ? result.data : null;
    } catch {
        return null;
    }
}

function buildPrompt(request: AIRequest): { system: string; user: string } {
    switch (request.action) {
        case 'breakdown':
            return {
                system: `You are an expert habit coach following "Atomic Habits" by James Clear.
The user gives you a high-level goal. Break it down into 3 to 4 small, specific, actionable daily micro-habits.
Each category must be exactly one of: ${HABIT_CATEGORIES.join(', ')}.
Respond ONLY with valid JSON in this format:
{"habits":[{"name":"10 pushups after morning coffee","category":"Health"},{"name":"Walk for 15 minutes at lunch","category":"Health"}]}`,
                user: `Goal: ${JSON.stringify(request.payload.goal)}`,
            };

        case 'natural_log':
            return {
                system: `You are a natural language parser for a habit tracking app.
The user describes what they completed today. You also get their active habits as {id, name} pairs.
Return the ids of the habits the user says they completed. Only use ids from the provided list; if nothing matches, return an empty array.
Respond ONLY with valid JSON in this format:
{"matchedTaskIds":["id-1","id-2"],"explanation":"Matched 'reading' to 'Read 30 mins' and 'water' to 'Drink 2L Water'"}`,
                user: `User input: ${JSON.stringify(request.payload.input)}\nActive habits: ${JSON.stringify(request.payload.tasks)}`,
            };

        case 'coach':
            return {
                system: `You are a supportive, high-energy habit coach.
You get the user's real habit data. Fields per habit: currentStreak (consecutive days completed), doneToday, completedLast7 (days completed out of the last 7).
Write 2-3 sentences of personalised, actionable coaching. Refer only to the data provided and never invent numbers.
Celebrate a strong streak if there is one, and suggest one small, concrete adjustment for the weakest habit.
Plain text only (no markdown); a couple of emojis are fine.`,
                user: request.payload.habits.length
                    ? `Habits: ${JSON.stringify(request.payload.habits)}`
                    : 'The user has not created any habits yet. Encourage them to start with one tiny habit.',
            };

        case 'weekly_report':
            return {
                system: `You are an AI performance analyst for the FocusFlow habit tracker.
You get the user's real data. Fields per habit: completedLast7/trackedLast7 (days done / days the habit existed in the last 7 days), completedPrev7/trackedPrev7 (the 7 days before that), currentStreak, longestStreak. bestWeekday and worstWeekday cover the last 6 months (null if unknown).
Use ONLY this data and never invent numbers. If there is little or no data, say so honestly.
Respond ONLY with valid JSON in this format, one sentence per field:
{"topWin":"the strongest result this week","riskAlert":"the habit most at risk (biggest drop or lowest completion)","customTip":"one concrete tip for next week"}`,
                user: `Data: ${JSON.stringify(request.payload)}`,
            };
    }
}

export async function POST(req: Request) {
    try {
        // Verify the session here too; the proxy alone is not a sufficient auth boundary
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const limit = rateLimit(`ai:${user.id}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
        if (!limit.allowed) {
            return NextResponse.json(
                { error: 'Too many AI requests. Please try again later.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
            );
        }

        const parsed = aiRequestSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
        }
        const request = parsed.data;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error('GROQ_API_KEY is not set');
            return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 });
        }

        const model = await resolveModel(apiKey);
        const { system, user: userPrompt } = buildPrompt(request);
        const groq = await callGroq(apiKey, model, system, userPrompt, request.action !== 'coach');

        if (!groq.ok) {
            const busy = groq.status === 429;
            return NextResponse.json(
                { error: busy ? 'The AI service is busy. Please try again in a minute.' : 'AI service is temporarily unavailable.' },
                { status: busy ? 503 : 502 }
            );
        }

        const badResponse = () =>
            NextResponse.json({ error: 'The AI returned an unexpected response. Please try again.' }, { status: 502 });

        switch (request.action) {
            case 'breakdown': {
                const result = parseModelJson(groq.content, breakdownResponseSchema);
                if (!result) return badResponse();
                return NextResponse.json(result);
            }

            case 'natural_log': {
                const result = parseModelJson(groq.content, naturalLogResponseSchema);
                if (!result) return badResponse();
                // Never trust ids from the model: keep only habits the client actually sent
                const knownIds = new Set(request.payload.tasks.map((t) => t.id));
                return NextResponse.json({
                    matchedTaskIds: Array.from(new Set(result.matchedTaskIds.filter((id) => knownIds.has(id)))),
                    explanation: result.explanation,
                });
            }

            case 'weekly_report': {
                const result = parseModelJson(groq.content, weeklyReportResponseSchema);
                if (!result) return badResponse();
                return NextResponse.json(result);
            }

            case 'coach': {
                const advice = groq.content.trim().slice(0, 1200);
                if (!advice) return badResponse();
                return NextResponse.json({ result: advice });
            }
        }
    } catch (err) {
        console.error('AI Route Handler Error:', err);
        return NextResponse.json({ error: 'Internal AI service error' }, { status: 500 });
    }
}
