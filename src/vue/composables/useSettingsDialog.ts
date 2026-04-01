import type { ComputedRef, Ref } from 'vue';
import type { WidgetSettings } from '../../types';

export const settingsDialogKey = Symbol('widgetSettingsDialog');

export interface SettingsDialogContext {
	draft: Ref<WidgetSettings>;
	onInit: (fn: (draft: WidgetSettings) => void) => void;
	onBeforeSave: (fn: (settings: WidgetSettings) => void) => void;
	setCanSubmit: (value: ComputedRef<boolean>) => void;
}
