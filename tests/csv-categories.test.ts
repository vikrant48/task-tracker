import { describe, it, expect } from 'vitest';
import { buildCsv, csvCell } from '@/lib/csv';
import { buildCategoryOptions, matchesCategory } from '@/lib/categories';

describe('csvCell', () => {
    it('quotes values and escapes quotes', () => {
        expect(csvCell('Read "Atomic Habits", daily')).toBe('"Read ""Atomic Habits"", daily"');
    });

    it.each(['=HYPERLINK("x")', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])('neutralises formula-like value %j', (value) => {
        expect(csvCell(value).startsWith(`"'`)).toBe(true);
    });

    it('builds a CSV with a header row', () => {
        expect(buildCsv(['Task', 'Done'], [['Water', 'Yes']])).toBe('"Task","Done"\n"Water","Yes"');
    });
});

describe('categories', () => {
    it('lists All, the built-ins, then custom categories once', () => {
        const options = buildCategoryOptions([{ category: 'Fitness' }, { category: 'Health' }, { category: 'Fitness' }]);
        expect(options).toEqual(['All', 'General', 'Work', 'Health', 'Personal', 'Fitness']);
    });

    it('treats a missing category as General', () => {
        expect(matchesCategory({ category: null }, 'General')).toBe(true);
        expect(matchesCategory({ category: 'Work' }, 'All')).toBe(true);
        expect(matchesCategory({ category: 'Work' }, 'Health')).toBe(false);
    });
});
