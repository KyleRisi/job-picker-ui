export function formatPercent(decimalValue) {
  return `${(decimalValue * 100).toFixed(2)}%`;
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

export function formatFloat(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

export function safeDivide(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return numerator / denominator;
}

export function trendWord(current, previous) {
  if (previous === 0 && current > 0) {
    return 'up sharply versus prior period';
  }
  if (current === previous) {
    return 'flat versus prior period';
  }

  const diffRatio = safeDivide(current - previous, previous || 1);
  if (diffRatio > 0.15) {
    return 'up meaningfully versus prior period';
  }
  if (diffRatio > 0.03) {
    return 'up slightly versus prior period';
  }
  if (diffRatio < -0.15) {
    return 'down meaningfully versus prior period';
  }
  if (diffRatio < -0.03) {
    return 'down slightly versus prior period';
  }
  return 'roughly flat versus prior period';
}
