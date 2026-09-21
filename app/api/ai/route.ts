import { NextResponse } from 'next/server';

// Priority order of preferred models for Groq AI
const PREFERRED_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama3-70b-8192',
    'llama-3.1-8b-instant',
    'llama3-8b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
    'gemma-7b-it',
];

async function resolveAvailableModel(apiKey: string): Promise<string> {
    try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });

        if (res.ok) {
            const data = await res.json();
            const availableModelIds: string[] = (data.data || []).map((m: any) => m.id);

            // Find first preferred model available in user's account
            for (const preferred of PREFERRED_MODELS) {
                if (availableModelIds.includes(preferred)) {
                    return preferred;
                }
            }

            // Fallback to any available chat model if preferred list doesn't match
            if (availableModelIds.length > 0) {
                return availableModelIds[0];
            }
        }
    } catch (e) {
        console.warn('Could not fetch Groq models list, falling back to default:', e);
    }

    // Default fallback
    return 'llama3-8b-8192';
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { action, payload = {} } = body;

        if (!action) {
            return NextResponse.json({ error: 'Missing action in request body.' }, { status: 400 });
        }

        const apiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Groq API Key missing. Please set GROQ_API_KEY in environment variables.' },
                { status: 500 }
            );
        }

        // Dynamically discover available model for user's key
        const activeModel = await resolveAvailableModel(apiKey);

        let systemPrompt = '';
        let userPrompt = '';

        if (action === 'breakdown') {
            const goal = String(payload?.goal || 'Get organized').slice(0, 300);
            systemPrompt = `You are an expert habit coach following "Atomic Habits" by James Clear. 
The user will give you a high-level goal. Break it down into 3 to 4 actionable, bite-sized daily micro-habits.
You MUST respond ONLY with valid JSON in the following format (no markdown formatting outside json):
{
  "habits": [
    { "name": "10 pushups after morning coffee", "category": "Health" },
    { "name": "Walk for 15 minutes at lunch", "category": "Health" },
    { "name": "Drink 1 glass of water after waking up", "category": "Health" }
  ]
}`;
            userPrompt = `Goal: "${goal}"`;
        } else if (action === 'natural_log') {
            const input = String(payload?.input || '').slice(0, 300);
            const tasks = payload?.tasks || [];
            systemPrompt = `You are an AI natural language parser for a habit tracking app.
The user will give a statement of what they completed today.
You are provided with a list of active habit tasks with their IDs and names.
Match the user's input to the active tasks and return an array of task IDs that the user completed.
You MUST respond ONLY with valid JSON in the following format:
{
  "matchedTaskIds": ["id-1", "id-2"],
  "explanation": "Matched 'reading' to 'Read 30 mins' and 'water' to 'Drink 2L Water'"
}`;
            userPrompt = `User Input: "${input}"\nActive Tasks: ${JSON.stringify(tasks)}`;
        } else if (action === 'coach') {
            const { tasks = [], completionStats = {} } = payload;
            systemPrompt = `You are a supportive, high-energy AI habit coach.
Analyze the user's habit tracking stats and provide 2-3 sentences of personalized, actionable behavioral coaching.
Be encouraging, cite specific habits if helpful, and suggest a micro-adjustment if completion drops.
Keep your response concise, friendly, and formatted in Markdown with emojis.`;
            userPrompt = `User Active Habits: ${JSON.stringify(tasks)}\nStats: ${JSON.stringify(completionStats)}`;
        } else if (action === 'weekly_report') {
            const { statsSummary = {} } = payload;
            systemPrompt = `You are an AI Performance Analyst for FocusFlow habit tracker.
Analyze the past week's completion data and provide a 3-part weekly performance report.
You MUST respond ONLY with valid JSON in the following format:
{
  "topWin": "Completed Morning Stretch 6 out of 7 days!",
  "riskAlert": "Weekend workout completion dropped by 40%.",
  "customTip": "Prepare workout clothes on Friday night to lower friction for Saturday morning."
}`;
            userPrompt = `Past Week Stats Summary: ${JSON.stringify(statsSummary)}`;
        } else {
            return NextResponse.json({ error: 'Invalid AI action specified.' }, { status: 400 });
        }

        // Only pass response_format if model is a Llama model that supports JSON mode
        const supportsJsonFormat = activeModel.toLowerCase().includes('llama');

        const requestBody: any = {
            model: activeModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.5,
            max_tokens: 600,
        };

        if (supportsJsonFormat && (action === 'breakdown' || action === 'natural_log' || action === 'weekly_report')) {
            requestBody.response_format = { type: 'json_object' };
        }

        let groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        // Fallback retry without response_format if 400 Bad Request occurs
        if (!groqResponse.ok && requestBody.response_format) {
            delete requestBody.response_format;
            groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(requestBody),
            });
        }

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            console.error(`Groq API error with model (${activeModel}):`, errorText);
            return NextResponse.json({ error: `Groq API error (${activeModel}): ${groqResponse.statusText}` }, { status: groqResponse.status });
        }

        const groqData = await groqResponse.json();
        let content = groqData.choices?.[0]?.message?.content || '';

        if (action === 'breakdown' || action === 'natural_log' || action === 'weekly_report') {
            try {
                // Strip markdown codeblocks if model wrapped JSON in ```json ... ```
                content = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
                const parsed = JSON.parse(content);
                return NextResponse.json(parsed);
            } catch (err) {
                console.error('Failed to parse JSON response from Groq:', content);
                return NextResponse.json({ rawContent: content });
            }
        }

        return NextResponse.json({ result: content, activeModel });
    } catch (err: any) {
        console.error('AI Route Handler Error:', err);
        return NextResponse.json({ error: err.message || 'Internal AI service error' }, { status: 500 });
    }
}
