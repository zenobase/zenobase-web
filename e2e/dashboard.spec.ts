import { expect, test } from './fixtures';
import bucket from './fixtures/bucket.json' with { type: 'json' };
import searchResults from './fixtures/search.json' with { type: 'json' };

const ECHARTS_WIDGETS = new Set(['histogram', 'timeline', 'polar', 'scatterplot']);

test('renders every widget type', async ({ page }) => {
	await page.goto('/#/buckets/b1/');

	for (const widget of bucket.widgets) {
		const tab = page.getByRole('tab').filter({ hasText: widget.label });
		const panel = page.locator('.widget-panel').filter({ has: tab });
		await tab.click();
		const content = panel.locator('.v-window-item--active');
		await expect(content.locator('.loading-state'), widget.type).toHaveCount(0);
		if (ECHARTS_WIDGETS.has(widget.type)) {
			await expect(content.locator('canvas').first(), widget.type).toBeVisible();
		} else {
			// Table widgets render one row per fixture entry.
			const entries = searchResults[widget.id as keyof typeof searchResults] as unknown[];
			await expect(content.locator('tbody tr'), widget.type).toHaveCount(entries.length);
		}
	}
});
