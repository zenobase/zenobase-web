import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZenoEvent } from '../../../types';
import { apiResponse, mountDialog } from '../../__tests__/mount';
import api, { ApiError } from '../../api';
import ImportDialog from '../ImportDialog.vue';

interface ImportVM {
	formats: Array<{ id: string }>;
	selectedFormat: { id: string };
	settings: Record<string, unknown>;
	events: ZenoEvent[];
	message: string;
	submit(): Promise<void>;
}

async function open() {
	const result = await mountDialog<ImportVM>(ImportDialog, { bucketId: 'b1' });
	return { ...result, select: (format: string) => (result.vm.selectedFormat = result.vm.formats.find((f) => f.id === format)!) };
}

function chooseFile(content: BlobPart) {
	const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
	Object.defineProperty(input, 'files', { configurable: true, value: [new File([content], 'events.txt')] });
	input.dispatchEvent(new Event('change'));
}

// LibreView exports are UTF-16LE; Uint16Array is little-endian on all supported platforms
function utf16le(s: string) {
	return Uint16Array.from(s, (c) => c.charCodeAt(0));
}

describe('ImportDialog', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it.each([
		['a JSON array', '[{"tag":"run"}]'],
		['an export object', '{"events":[{"tag":"run"}]}'],
		['a CSV file', 'tag\nrun'],
	])('posts the events parsed from %s', async (_, content) => {
		const post = vi.spyOn(api, 'post').mockResolvedValue(apiResponse({}, { 'X-Command-ID': 'c1' }));
		const { wrapper, vm, alertApi } = await open();

		chooseFile(content);
		await vi.waitFor(() => expect(vm.events).toHaveLength(1));
		await vm.submit();

		expect(post).toHaveBeenCalledWith('/buckets/b1/', { events: [{ tag: 'run' }] });
		expect(alertApi.alert.value).toMatchObject({ message: 'Imported events.', level: 'success', undoId: 'c1' });
		expect(wrapper.emitted('imported')).toHaveLength(1);
		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
	});

	it('keeps the timezone and encoding after a file fails to parse', async () => {
		const { vm, select } = await open();
		select('libreview');
		await vi.waitFor(() => expect(vm.settings).toEqual({ timezone: 'UTC', encoding: 'UTF-16LE' }));
		vm.settings['timezone'] = 'Europe/Berlin';

		chooseFile(utf16le('a,b,c\nd,e,f\n"g,h'));
		await vi.waitFor(() => expect(vm.message).toMatch(/in row 2$/));

		expect(vm.events).toEqual([]);
		expect(vm.settings).toEqual({ timezone: 'Europe/Berlin', encoding: 'UTF-16LE' });
		expect(document.querySelector<HTMLInputElement>('input[type=file]')?.value).toBe('');
	});

	it('shows the server message when the import is rejected', async () => {
		vi.spyOn(api, 'post').mockRejectedValue(new ApiError(400, { message: 'Too many events' }));
		const { wrapper, vm } = await open();

		chooseFile('[{"tag":"run"}]');
		await vi.waitFor(() => expect(vm.events).toHaveLength(1));
		await vm.submit();

		expect(vm.message).toBe('Too many events');
		expect(vm.events).toEqual([]);
		expect(wrapper.emitted('imported')).toBeUndefined();
	});
});
