function linearRegression(X: number[], Y: number[]) {
	const N = X.length;
	let SX = 0;
	let SY = 0;
	let SXX = 0;
	let SXY = 0;
	for (let i = 0; i < N; ++i) {
		SX += X[i];
		SY += Y[i];
		SXY += X[i] * Y[i];
		SXX += X[i] * X[i];
	}
	const slope = (N * SXY - SX * SY) / (N * SXX - SX * SX);
	const intercept = (SY - slope * SX) / N;
	return { slope, intercept };
}

function pearson(x: number[], y: number[]): number {
	const n = x.length;
	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumX2 = 0;
	let sumY2 = 0;
	for (let i = 0; i < n; ++i) {
		sumX += x[i];
		sumY += y[i];
		sumXY += x[i] * y[i];
		sumX2 += x[i] * x[i];
		sumY2 += y[i] * y[i];
	}
	return (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
}

function rank(x: number[]): number[] {
	return x.map((a) => {
		let r = 1;
		let freq = 0;
		for (const b of x) {
			if (b > a) ++r;
			else if (b === a) ++freq;
		}
		return freq > 1 ? (freq * (2 * r + freq - 1)) / (2 * freq) : r;
	});
}

function log1p(x: number): number {
	if (x <= -1) return Number.NEGATIVE_INFINITY;
	if (x < 0 || x > 1) return Math.log(1 + x);
	let value = 0;
	for (let i = 1; i < 50; ++i) {
		value += (i % 2 === 0 ? -1 : 1) * (x ** i / i);
	}
	return value;
}

function tanh(x: number): number {
	const e = Math.exp(2 * x);
	return (e - 1) / (e + 1);
}

function atanh(x: number): number {
	return 0.5 * (log1p(x) - log1p(-x));
}

function confidence(r: number, n: number): [number, number] {
	const stderr = 1.0 / Math.sqrt(n - 3);
	const delta = 1.96 * stderr;
	return [tanh(atanh(r) - delta), tanh(atanh(r) + delta)];
}

export const statistics = {
	regression(data: number[][]): { data: number[][]; slope: number; intercept: number } | null {
		const x: number[] = [];
		const y: number[] = [];
		let min = 0;
		let max = 0;
		for (let i = 0; i < data.length; ++i) {
			x.push(data[i][0]);
			y.push(data[i][1]);
			if (data[i][0] > data[max][0]) max = i;
			if (data[i][0] < data[min][0]) min = i;
		}
		const params = linearRegression(x, y);
		if (Number.isNaN(params.slope)) return null;
		return {
			data: [
				[x[min], params.slope * x[min] + params.intercept],
				[x[max], params.slope * x[max] + params.intercept],
			],
			slope: params.slope,
			intercept: params.intercept,
		};
	},

	correlate(data: number[][], ranked?: boolean): { r: number; lower: number; upper: number } {
		let x = data.map((d) => d[0]);
		let y = data.map((d) => d[1]);
		if (ranked) {
			x = rank(x);
			y = rank(y);
		}
		const r = pearson(x, y);
		const [lower, upper] = confidence(r, x.length);
		return { r, lower, upper };
	},
};
