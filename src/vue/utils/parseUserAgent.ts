import { UAParser } from 'ua-parser-js';

export interface ParsedUserAgent {
	browser: string;
	os: string;
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
	if (!userAgent) {
		return { browser: 'Unknown browser', os: 'Unknown OS' };
	}
	const result = new UAParser(userAgent).getResult();
	const browserName = result.browser.name || '';
	const browserVersion = result.browser.version ? result.browser.version.split('.')[0] : '';
	const osName = result.os.name || '';
	const osVersion = result.os.version || '';
	const browser = [browserName, browserVersion].filter(Boolean).join(' ') || 'Unknown browser';
	const os = [osName, osVersion].filter(Boolean).join(' ') || 'Unknown OS';
	return { browser, os };
}
