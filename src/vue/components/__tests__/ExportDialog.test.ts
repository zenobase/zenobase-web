import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Constraint } from '../../../utils/constraint';
import { mountDialog } from '../../__tests__/mount';
import api, { ApiError } from '../../api';
import ExportDialog from '../ExportDialog.vue';

interface ExportVM {
	media: string;
	infoMessage: string;
	submit(): Promise<void>;
}

function open(total: number, constraints: string[] = []) {
	return mountDialog<ExportVM>(ExportDialog, { bucketId: 'b1', total, constraints: constraints.map((c) => Constraint.parse(c)) });
}

describe('ExportDialog', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('downloads all events as json', async () => {
		const download = vi.spyOn(api, 'download').mockResolvedValue();
		const { wrapper, vm } = await open(5);

		await vm.submit();

		expect(vm.infoMessage).toBe('');
		expect(download).toHaveBeenCalledWith('/buckets/b1/', 'b1.json');
		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
	});

	it('downloads only matching events as csv', async () => {
		const download = vi.spyOn(api, 'download').mockResolvedValue();
		const { vm } = await open(5, ['tag:run', '-tag:walk']);

		vm.media = 'csv';
		await vm.submit();

		expect(vm.infoMessage).toMatch(/^Only events matching/);
		expect(download).toHaveBeenCalledWith('/buckets/b1/?q=tag%3Arun&q=-tag%3Awalk&accept=text%2Fplain', 'b1.csv');
	});

	it('disables csv above the export limit', async () => {
		await open(10001, ['tag:run']);

		expect(document.body.textContent).toContain('csv export is limited to 10000 events');
		expect(document.querySelector<HTMLInputElement>('input[value=csv]')?.disabled).toBe(true);
	});

	it('stays open and alerts when the download fails', async () => {
		vi.spyOn(api, 'download').mockRejectedValue(new ApiError(500, 'boom'));
		const { wrapper, vm, alertApi } = await open(5);

		await vm.submit();

		expect(alertApi.alert.value).toMatchObject({ message: 'API error: 500', level: 'error' });
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});
});
