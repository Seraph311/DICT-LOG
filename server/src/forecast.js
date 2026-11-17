const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function mondayOf(value) {
  const date = parseDate(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return formatDate(date);
}

function addDays(value, days) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function addMonths(value, months) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return date.toISOString().slice(0, 7);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function metrics(actual, predicted) {
  const errors = actual.map((value, index) => Math.abs(value - predicted[index]));
  const percentageErrors = actual
    .map((value, index) => (value === 0 ? null : Math.abs(value - predicted[index]) / value))
    .filter((value) => value !== null);

  return {
    mae: mean(errors),
    mape: percentageErrors.length ? mean(percentageErrors) * 100 : null,
  };
}

function movingAverage(history, window) {
  return mean(history.slice(-window));
}

function seasonalIndexes(daily) {
  const totals = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const point of daily) {
    const weekday = parseDate(point.day).getUTCDay();
    totals[weekday] += point.count;
    counts[weekday] += 1;
  }
  const overallDailyAverage = mean(daily.map((point) => point.count));
  if (!overallDailyAverage) return Array(7).fill(1);
  return totals.map((total, weekday) =>
    counts[weekday] ? total / counts[weekday] / overallDailyAverage : 1,
  );
}

function buildPeriods(daily, granularity) {
  const periods = new Map();
  for (const point of daily) {
    const period =
      granularity === 'week' ? mondayOf(point.day) : point.day.slice(0, 7);
    periods.set(period, (periods.get(period) || 0) + point.count);
  }
  return [...periods.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, count]) => ({ period, count }));
}

function nextPeriod(period, granularity) {
  return granularity === 'week' ? addDays(period, 7) : addMonths(period, 1);
}

function forecastAt(history, granularity, daily, window, period) {
  const base = movingAverage(history.slice(-window), window);
  if (granularity === 'month') return base;

  const indexes = seasonalIndexes(daily);
  const start = parseDate(period);
  let seasonalTotal = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    seasonalTotal += indexes[(start.getUTCDay() + offset) % 7];
  }
  return (base / 7) * seasonalTotal;
}

export function calculateForecast({ daily, granularity }) {
  const minimumHistory = granularity === 'week' ? 8 : 4;
  const holdoutSize = granularity === 'week' ? 4 : 2;
  const window = granularity === 'week' ? 4 : 3;
  const periods = buildPeriods(daily, granularity);

  if (periods.length < minimumHistory) {
    return {
      observed: periods,
      forecast: [],
      heldOut: [],
      metrics: { model: { mae: null, mape: null }, naive: { mae: null, mape: null } },
      note: `Not enough history for a ${granularity} forecast. Need at least ${minimumHistory} periods.`,
    };
  }

  const fitPeriods = periods.slice(0, -holdoutSize);
  const heldOut = periods.slice(-holdoutSize);
  const fitDaily = daily.filter((point) => point.day < heldOut[0].period);
  const history = fitPeriods.map((point) => point.count);
  const modelPredictions = heldOut.map((point) => {
    const prediction = forecastAt(history, granularity, fitDaily, window, point.period);
    history.push(prediction);
    return prediction;
  });
  const naivePredictions = heldOut.map(() => fitPeriods.at(-1).count);
  const next = nextPeriod(periods.at(-1).period, granularity);
  const nextForecast = forecastAt(
    periods.map((point) => point.count),
    granularity,
    daily,
    window,
    next,
  );

  return {
    observed: periods,
    forecast: [
      ...heldOut.map((point, index) => ({
        period: point.period,
        count: modelPredictions[index],
        actual: point.count,
        type: 'held-out',
      })),
      { period: next, count: nextForecast, actual: null, type: 'future' },
    ],
    heldOut,
    metrics: {
      model: metrics(
        heldOut.map((point) => point.count),
        modelPredictions,
      ),
      naive: metrics(
        heldOut.map((point) => point.count),
        naivePredictions,
      ),
    },
    note: 'Accuracy depends on the amount of history available.',
  };
}

export { buildPeriods, metrics };
