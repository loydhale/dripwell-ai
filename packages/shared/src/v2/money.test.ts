import test from 'node:test';
import assert from 'node:assert/strict';
import { currencyMinorUnitDigits, formatMoney, parsePriceToMinorUnits } from './money.js';
import { currencySchema } from './contracts.js';

test('USD, JPY and KWD prices parse to their actual smallest currency unit', () => {
  assert.equal(currencyMinorUnitDigits('USD'), 2);
  assert.equal(currencyMinorUnitDigits('JPY'), 0);
  assert.equal(currencyMinorUnitDigits('KWD'), 3);
  assert.equal(parsePriceToMinorUnits('125.95', 'USD'), 12595);
  assert.equal(parsePriceToMinorUnits('125', 'JPY'), 125);
  assert.equal(parsePriceToMinorUnits('125.950', 'KWD'), 125950);
  assert.equal(parsePriceToMinorUnits('.01', 'USD'), 1);
  assert.equal(parsePriceToMinorUnits(' 0001.5 ', 'USD'), 150);
  assert.equal(parsePriceToMinorUnits('0', 'JPY'), 0);
});

test('decimal parsing rejects excess precision and unsafe amounts without rounding', () => {
  assert.throws(() => parsePriceToMinorUnits('0.009', 'USD'), /fractional digits/);
  assert.throws(() => parsePriceToMinorUnits('1.000', 'USD'), /fractional digits/);
  assert.throws(() => parsePriceToMinorUnits('1.0', 'JPY'), /fractional digits/);
  assert.throws(() => parsePriceToMinorUnits('0.0001', 'KWD'), /fractional digits/);
  assert.equal(parsePriceToMinorUnits('90071992547409.91', 'USD'), Number.MAX_SAFE_INTEGER);
  assert.throws(() => parsePriceToMinorUnits('90071992547409.92', 'USD'), /integer amount/);
});

test('official prices reject symbols, grouping, negative values and exponential notation', () => {
  for (const value of [
    '',
    ' ',
    '$1.00',
    '1,000.00',
    '-1.00',
    '+1.00',
    '1e2',
    'NaN',
    'Infinity',
    '1.',
  ]) {
    assert.throws(() => parsePriceToMinorUnits(value, 'USD'), /nonnegative decimal/);
  }
  assert.throws(() => parsePriceToMinorUnits('1', 'usd'), /ISO currency/);
  assert.throws(() => parsePriceToMinorUnits('1', 'XYZ'), /ISO currency/);
  assert.equal(currencySchema.safeParse('XYZ').success, false);
  assert.equal(currencySchema.safeParse('USD').success, true);
});

test('formatting respects currency precision and preserves existing USD cents', () => {
  assert.equal(formatMoney(12595, 'USD'), '$125.95');
  assert.equal(formatMoney(125, 'JPY'), '¥125');
  assert.equal(formatMoney(125950, 'KWD'), 'KWD\u00a0125.950');
  assert.equal(formatMoney(1, 'KWD'), 'KWD\u00a00.001');
  assert.equal(formatMoney(1, 'USD'), '$0.01');
  assert.equal(formatMoney(-1, 'USD'), '-$0.01');
  assert.equal(formatMoney(-125, 'JPY'), '-¥125');
});

test('formatting avoids precision loss at safe-integer limits and rejects noninteger amounts', () => {
  assert.equal(formatMoney(Number.MAX_SAFE_INTEGER, 'USD'), '$90,071,992,547,409.91');
  assert.equal(formatMoney(Number.MAX_SAFE_INTEGER, 'KWD'), 'KWD\u00a09,007,199,254,740.991');
  assert.equal(formatMoney(12595, 'EUR', 'de-DE'), '125,95\u00a0€');
  assert.equal(
    formatMoney(12595, 'USD', 'ar-EG'),
    new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'USD' }).format(125.95),
  );
  for (const value of [1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => formatMoney(value, 'USD'), /safe integer/);
  }
});
