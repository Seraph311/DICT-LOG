import assert from 'node:assert/strict';
import { calculateForecast, metrics } from '../src/forecast.js';

const handComputedDaily = [10, 20, 30, 40, 50, 60, 70, 80].map((count, index) => ({
  day: `2026-01-${String(index * 7 + 5).padStart(2, '0')}`,
  count,
}));
const result = calculateForecast({ daily: handComputedDaily, granularity: 'week' });

// Fit [10, 20, 30, 40], then recursively forecast with a four-period moving average.
assert.deepEqual(
  result.forecast.slice(0, 4).map((point) => Number(point.count.toFixed(6))),
  [25, 28.75, 30.9375, 31.171875],
);
assert.equal(result.metrics.model.mae, 36.03515625);
assert.equal(result.metrics.model.mape, 54.7305152529762);
assert.equal(result.metrics.naive.mae, 25);
assert.equal(result.metrics.naive.mape, 36.547619047619044);

const zeroActualMetrics = metrics([0, 10], [4, 5]);
assert.equal(zeroActualMetrics.mae, 4.5);
assert.equal(zeroActualMetrics.mape, 50);

console.log('Forecast hand-computed example: PASS');
console.log('Zero-actual MAPE handling: PASS');
