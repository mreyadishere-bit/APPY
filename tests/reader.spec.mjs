import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width === 390 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8123/');
    await page.waitForFunction(async () => {
      const store = await import('/src/core/store.js');
      return store.state.ready;
    });
    await page.evaluate(async () => {
      const store = await import('/src/core/store.js');
      // In-memory fixture: never touches the user's IndexedDB data.
      store.state.books = [{ id: 'test-book', title: 'Reader test', cover: {} }];
      store.state.entries = Array.from({ length: 6 }, (_, i) => ({
        id: `entry-${i}`, bookId: 'test-book', title: `Entry ${i + 1}`,
        date: '2026-10-23', createdAt: i, body: `<p>Page ${i + 1} content.</p>`
      }));
      location.hash = '#/read/test-book';
    });
    await page.locator('[data-cover]').waitFor({ state: 'detached' });
    const count = () => page.locator('[data-page-count]').textContent();
    const first = width > 960 ? '1–2 of 6' : '1 of 6';
    const next = width > 960 ? '3–4 of 6' : '2 of 6';
    assert.equal(await count(), first);
    await page.locator('[data-engine="paper"]').waitFor();
    const box = await page.locator('.physics-page.--right').first().boundingBox();
    const x = box.x + box.width - 12;
    const y = box.y + box.height * 0.65;
    // Short, slow pull must return to the same spread.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 25, y, { steps: 6 });
    assert.equal(await page.locator('.reader').getAttribute('data-turn-state'), 'user_fold');
    assert.ok(await page.locator('.physics-page').evaluateAll(nodes => nodes.some(n => n.style.clipPath || n.style.transform.includes('rotate'))));
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.reader').dataset.turnState === 'read');
    assert.equal(await count(), first);
    // Full pull must advance; arrow back must restore the original spread.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - box.width * 1.2, y, { steps: 15 });
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.reader').dataset.turnState === 'read');
    assert.equal(await count(), next);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('.reader').dataset.turnState === 'read');
    assert.equal(await count(), first);
    // Verify genuine touch events, not mouse emulation at a narrow viewport.
    if (width === 390) {
      const client = await page.context().newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x,y}]});
      await page.waitForTimeout(300);
      for (let step=1; step<=12; step++) {
        await client.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:x-box.width*1.15*step/12,y:y-step*2}]});
      }
      await client.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(() => document.querySelector('.reader').dataset.turnState === 'read');
      assert.equal(await count(), next);
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => document.querySelector('.reader').dataset.turnState === 'read');
      assert.equal(await count(), first);
    }
    await page.screenshot({ path: `/tmp/appy-open-${width}.png` });
    await page.keyboard.press('End');
    await page.locator('[data-action="next"]:disabled').waitFor();
    await page.setViewportSize({ width: width > 960 ? 390 : 1440, height: 800 });
    await page.waitForTimeout(100);
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.stf__parent').count(), 1);
    assert.equal(await page.locator('#mobileBar').isVisible(), false);
    assert.ok(await page.locator('.re-title').filter({ hasText: 'Entry 5' }).count());
    await page.screenshot({ path: `/tmp/appy-reader-${width}.png` });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Reader: desktop/mobile drag completion, cancellation, keyboard, boundaries and resize passed.');
} finally {
  await browser.close();
}
