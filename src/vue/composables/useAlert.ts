import { type InjectionKey, provide, type Ref, ref } from 'vue';

export interface AlertState {
	message: string;
	level: 'success' | 'error' | 'info' | '';
	undoId: string;
}

export interface AlertApi {
	alert: Ref<AlertState>;
	show: (message: string, level?: AlertState['level'], undoId?: string) => void;
	clear: () => void;
	undo: (commandId: string) => Promise<void>;
}

export const alertKey: InjectionKey<AlertApi> = Symbol('alert');

export function useAlert(onUndo?: (commandId: string) => Promise<void>) {
	const alert = ref<AlertState>({ message: '', level: '', undoId: '' });

	function show(message: string, level: AlertState['level'] = 'info', undoId = '') {
		alert.value = { message, level, undoId };
	}

	function clear() {
		alert.value = { message: '', level: '', undoId: '' };
	}

	async function undo(commandId: string) {
		clear();
		if (onUndo) {
			await onUndo(commandId);
		}
	}

	const api: AlertApi = { alert, show, clear, undo };
	provide(alertKey, api);

	return api;
}
