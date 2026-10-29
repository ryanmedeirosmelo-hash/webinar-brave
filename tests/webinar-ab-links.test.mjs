import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AB_PAGES, abDestinationPath, abPublicPath, isABPage } from '../src/lib/ab-links.ts';
import { abTestSchema } from '../src/lib/ab-tests.ts';
const id = '10000000-0000-4000-8000-000000000001';
const variants = [{ webinar_id: id, weight: 50 }, { webinar_id: '10000000-0000-4000-8000-000000000002', weight: 50 }];
test('exposes all normal webinar entry points and the main page', () => {
  assert.deepEqual(AB_PAGES.map(p => p.key), ['principal','sala','entrar','cadastro','obrigado','captura']);
  for (const page of AB_PAGES) {
    assert.equal(abDestinationPath('aula-teste', page.key), `${page.prefix}/aula-teste`);
    const url = new URL(abPublicPath({ id, slug: 'meu-teste' }, page.key), 'https://example.com');
    assert.equal(url.pathname, '/ab/meu-teste');
    assert.equal(url.searchParams.get('pagina'), page.key === 'principal' ? null : page.key);
  }
  assert.equal(abPublicPath({id}, 'principal'), `/ab/${id}`);
});
test('rejects unknown destinations and invalid friendly addresses', () => {
  assert.equal(isABPage('https://outside.example'), false);
  assert.equal(isABPage('captura'), true);
  for (const slug of ['UPPER', 'com espaço', '../admin', id, 'a'.repeat(81)]) {
    assert.equal(abTestSchema.safeParse({name:'Teste',slug,variants}).success, false);
  }
  for (const slug of ['', 'teste-2026']) assert.equal(abTestSchema.safeParse({name:'Teste',slug,variants}).success, true);
});
