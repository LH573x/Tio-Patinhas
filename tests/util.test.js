import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerNumero } from '../js/util.js';

test('lerNumero: vírgula decimal e ponto de milhar', () => {
  assert.equal(lerNumero('8,50'), 8.5);
  assert.equal(lerNumero('1.200'), 1200);
  assert.equal(lerNumero('1.234,56'), 1234.56);
  assert.equal(lerNumero('R$ 3.500'), 3500);
  assert.equal(lerNumero('12.5'), 12.5);
  assert.equal(lerNumero('-100'), -100);
  assert.equal(lerNumero(''), null);
});
