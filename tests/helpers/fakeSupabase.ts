// Minimal in-memory stand-in for the Supabase JS client, covering the query-builder calls the app
// makes. It records every call so tests can assert on what would have been sent to the database.

type Row = Record<string, unknown>;
type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete';
type Filter = { kind: 'eq' | 'gte' | 'lte'; column: string; value: unknown };

export interface RecordedCall {
    table: string;
    op: Op;
    payload?: unknown;
    filters: Filter[];
}

export interface FakeSupabaseOptions {
    user?: { id: string; email: string } | null;
    rpc?: Record<string, (args: Record<string, unknown>) => { data: unknown; error: unknown }>;
    // Return an error for a given operation instead of applying it
    failOn?: (call: RecordedCall) => { message: string; code?: string } | null;
}

let idCounter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`;

export function createFakeSupabase(db: Record<string, Row[]>, options: FakeSupabaseOptions = {}) {
    const calls: RecordedCall[] = [];
    const user = options.user === undefined ? { id: 'user-1', email: 'me@example.com' } : options.user;

    const matches = (row: Row, filters: Filter[]) =>
        filters.every((f) => {
            const v = row[f.column] as string;
            if (f.kind === 'eq') return v === f.value;
            if (f.kind === 'gte') return v >= (f.value as string);
            return v <= (f.value as string);
        });

    function execute(call: RecordedCall & { range?: [number, number]; single?: boolean; returning?: boolean }) {
        const failure = options.failOn?.(call);
        if (failure) return { data: null, error: failure };

        const table = (db[call.table] ??= []);

        switch (call.op) {
            case 'select': {
                let rows = table.filter((r) => matches(r, call.filters));
                if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1);
                return { data: rows.map((r) => ({ ...r })), error: null };
            }
            case 'insert': {
                const items = (Array.isArray(call.payload) ? call.payload : [call.payload]) as Row[];
                const inserted = items.map((item) => ({
                    id: newId(),
                    archived: false,
                    created_at: new Date().toISOString(),
                    ...item,
                }));
                table.push(...inserted);
                return { data: call.single ? inserted[0] : inserted, error: null };
            }
            case 'upsert': {
                const items = (Array.isArray(call.payload) ? call.payload : [call.payload]) as Row[];
                // Mirrors UNIQUE (task_id, user_id, entry_date)
                for (const item of items) {
                    const existing = table.find(
                        (r) => r.task_id === item.task_id && r.user_id === item.user_id && r.entry_date === item.entry_date
                    );
                    if (existing) Object.assign(existing, item);
                    else table.push({ id: newId(), ...item });
                }
                return { data: null, error: null };
            }
            case 'update': {
                const updated = table.filter((r) => matches(r, call.filters));
                updated.forEach((r) => Object.assign(r, call.payload as Row));
                return { data: call.returning ? updated.map((r) => ({ id: r.id })) : null, error: null };
            }
            case 'delete': {
                const removed = table.filter((r) => matches(r, call.filters));
                db[call.table] = table.filter((r) => !removed.includes(r));
                // ON DELETE CASCADE for tasks
                if (call.table === 'tasks') {
                    const ids = new Set(removed.map((r) => r.id));
                    for (const child of ['entries', 'task_shares']) {
                        if (db[child]) db[child] = db[child].filter((r) => !ids.has(r.task_id));
                    }
                }
                return { data: call.returning ? removed.map((r) => ({ id: r.id })) : null, error: null };
            }
        }
    }

    function from(table: string) {
        const call: RecordedCall & { range?: [number, number]; single?: boolean; returning?: boolean } = {
            table,
            op: 'select',
            filters: [],
        };
        calls.push(call);

        const builder = {
            select: () => {
                if (call.op !== 'select') call.returning = true;
                return builder;
            },
            insert: (payload: unknown) => ((call.op = 'insert'), (call.payload = payload), builder),
            upsert: (payload: unknown) => ((call.op = 'upsert'), (call.payload = payload), builder),
            update: (payload: unknown) => ((call.op = 'update'), (call.payload = payload), builder),
            delete: () => ((call.op = 'delete'), builder),
            eq: (column: string, value: unknown) => (call.filters.push({ kind: 'eq', column, value }), builder),
            gte: (column: string, value: unknown) => (call.filters.push({ kind: 'gte', column, value }), builder),
            lte: (column: string, value: unknown) => (call.filters.push({ kind: 'lte', column, value }), builder),
            order: () => builder,
            range: (fromIdx: number, toIdx: number) => ((call.range = [fromIdx, toIdx]), builder),
            single: () => ((call.single = true), builder),
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                Promise.resolve().then(() => execute(call)).then(resolve, reject),
        };
        return builder;
    }

    const client = {
        from,
        rpc: async (name: string, args: Record<string, unknown>) => {
            const handler = options.rpc?.[name];
            return handler ? handler(args) : { data: null, error: { message: `rpc ${name} not mocked` } };
        },
        auth: {
            getUser: async () => ({ data: { user }, error: null }),
        },
    };

    return { client, calls, db };
}
