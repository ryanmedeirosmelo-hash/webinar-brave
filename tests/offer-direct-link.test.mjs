import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/components/TimedOffer.tsx', import.meta.url), 'utf8');
function component() {
  const clicks = [];
  const module = { exports: {} };
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require(name) {
      if (name === '@/app/actions/offer-clicks') return { recordOfferClick: args => { clicks.push(args); return Promise.resolve(); } };
      if (name === '@/lib/public-locale') return { publicLocaleFor: language => language?.startsWith('es') ? 'es' : 'pt' };
      if (name === './HwKit') return { hwButton: '' };
      return require(name);
    },
    window: { get VirtusTrack() { throw Error('Checkout must not inspect tracking identifiers'); } },
    document: { get cookie() { throw Error('Checkout must not inspect tracking cookies'); } },
  });
  return { TimedOffer: module.exports.TimedOffer, clicks };
}
function anchor(element) {
  if (!element || typeof element !== 'object') return null;
  if (element.type === 'a') return element;
  for (const child of [element.props?.children].flat(Infinity)) { const found = anchor(child); if (found) return found; }
  return null;
}
for (const language of ['pt-BR', 'es-ES']) {
  test(`opens the exact saved offer URL without injected tracking (${language})`, () => {
    const { TimedOffer, clicks } = component();
    for (const url of ['https://pay.hotmart.com/I106470697A?off=t4tymrgk&checkoutMode=10&bid=1784924577553', 'https://example.com/checkout?src=meu-codigo&sck=meu-codigo#oferta']) {
      const button = anchor(TimedOffer({ offers: [{ id: 'offer', title: 'Oferta', cta_label: 'Comprar', cta_url: url, show_at_seconds: 0, open_same_window: false }], elapsed: 1, webinarId: 'webinar', registrationToken: 'registration', sessionStartIso: '2026-10-29T12:00:00Z', language }));
      assert.equal(button.props.href, url);
      assert.equal(button.props.target, '_blank');
      let intercepted = false;
      button.props.onClick({ preventDefault() { intercepted = true; } });
      assert.equal(intercepted, false);
    }
    assert.equal(clicks.length, 2);
  });
}
test('same-window preference and preview keep the saved destination intact', () => {
  const { TimedOffer, clicks } = component();
  const url = 'https://example.com/oferta?off=produto';
  const button = anchor(TimedOffer({ offers: [{ id: 'offer', title: 'Oferta', cta_label: 'Comprar', cta_url: url, show_at_seconds: 0, open_same_window: true }], elapsed: 1, webinarId: 'webinar', previewMode: true, language: 'es-ES' }));
  assert.equal(button.props.href, url);
  assert.equal(button.props.target, '_self');
  button.props.onClick();
  assert.equal(clicks.length, 0);
});
