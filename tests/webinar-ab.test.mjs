import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abTestSchema } from '../src/lib/ab-tests.ts';
const a = '10000000-0000-4000-8000-000000000001';
const b = '10000000-0000-4000-8000-000000000002';
const c = '10000000-0000-4000-8000-000000000003';
const parse = (variants, name = 'Teste') => abTestSchema.safeParse({ name, variants });
test('accepts 70/30 and three variants totaling 100', () => {
  assert.equal(parse([{ webinar_id: a, weight: 70 }, { webinar_id: b, weight: 30 }]).success, true);
  assert.equal(parse([{ webinar_id: a, weight: 50 }, { webinar_id: b, weight: 30 }, { webinar_id: c, weight: 20 }]).success, true);
});
test('rejects totals other than 100, duplicate webinars, invalid IDs and fractional weights', () => {
  for (const variants of [
    [{ webinar_id: a, weight: 50 }, { webinar_id: b, weight: 40 }],
    [{ webinar_id: a, weight: 50 }, { webinar_id: a, weight: 50 }],
    [{ webinar_id: 'invalid', weight: 50 }, { webinar_id: b, weight: 50 }],
    [{ webinar_id: a, weight: 50.5 }, { webinar_id: b, weight: 49.5 }],
    [{ webinar_id: a, weight: -1 }, { webinar_id: b, weight: 101 }],
    [{ webinar_id: a, weight: 100 }],
  ]) assert.equal(parse(variants).success, false);
});
test('accepts a zero-weight variant and rejects empty names', () => {
  const variants = [{ webinar_id: a, weight: 0 }, { webinar_id: b, weight: 100 }];
  assert.equal(parse(variants).success, true);
  assert.equal(parse(variants, '   ').success, false);
});
