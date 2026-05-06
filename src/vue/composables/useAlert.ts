import { type InjectionKey, type Ref, ref } from 'vue';

export interface AlertAction {
	label: string;
	url: string;
}

export interface AlertState {
	message: string;
	level: 'success' | 'error' | 'info' | '';
	undoId: string;
	action?: AlertAction;
}

export interface AlertApi {
	alert: Ref<AlertState>;
	show: (message: string, level?: AlertState['level'], undoId?: string, action?: AlertAction) => void;
	clear: () => void;
	undo: (commandId: string) => Promise<void>;
}

export const alertKey: InjectionKey<AlertApi> = Symbol('alert');

export function useAlert(onUndo?: (commandId: string) => Promise<void>) {
	const alert = ref<AlertState>({ message: '', level: '', undoId: '' });

	function show(message: string, level: AlertState['level'] = 'info', undoId = '', action?: AlertAction) {
		alert.value = { message, level, undoId, action };
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

	return api;
}
