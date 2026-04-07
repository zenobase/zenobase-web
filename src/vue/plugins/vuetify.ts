import '@mdi/font/css/materialdesignicons.css';
// @ts-expect-error vuetify/styles has no type declarations
import 'vuetify/styles';
import { createVuetify } from 'vuetify';

export const BRAND_BLUE = '#3B86C6';
export const BRAND_BLUE_RGB = '59, 134, 198';

export default createVuetify({
	theme: {
		defaultTheme: 'light',
		themes: {
			light: {
				colors: {
					primary: BRAND_BLUE,
					secondary: '#546E7A',
					accent: '#FF6D00',
					error: '#D32F2F',
					warning: '#F9A825',
					info: BRAND_BLUE,
					success: '#2E7D32',
					background: '#FFFFFF',
					surface: '#FFFFFF',
				},
			},
		},
	},
	defaults: {
		VAppBar: {
			elevation: 0,
		},
		VBtn: {
			variant: 'text',
		},
		VTextField: {
			variant: 'underlined',
			density: 'default',
			color: 'primary',
			clearIcon: 'mdi-close',
		},
		VSelect: {
			variant: 'underlined',
			density: 'default',
			color: 'primary',
			clearIcon: 'mdi-close',
		},
		VAutocomplete: {
			variant: 'underlined',
			density: 'default',
			color: 'primary',
			clearIcon: 'mdi-close',
		},
		VTextarea: {
			variant: 'underlined',
			density: 'default',
			color: 'primary',
		},
		VCheckbox: {
			density: 'compact',
			color: 'primary',
		},
		VRadio: {
			color: 'primary',
		},
		VTabs: {
			color: 'primary',
			density: 'compact',
		},
		VTab: {},
		VChip: {
			size: 'small',
			variant: 'tonal',
		},
		VAlert: {
			density: 'compact',
			variant: 'tonal',
		},
		VDialog: {
			maxWidth: 600,
		},
		VCard: {
			elevation: 0,
		},
		VTable: {
			density: 'compact',
		},
	},
});
