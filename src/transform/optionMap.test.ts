import test from 'node:test';
import assert from 'node:assert/strict';
import { mapOptionValue } from './optionMap';

test('translation works for case-insensitive match', () => {
  const result = mapOptionValue('classification.seniority_level', '  viCe PresIdenT ', {
    'classification.seniority_level': {
      'vice president': 'Vice President'
    }
  });

  assert.equal(result.value, 'Vice President');
  assert.equal(result.translated, true);
  assert.equal(result.missingMapping, false);
});

test('passthrough on missing mapping', () => {
  const result = mapOptionValue('classification.seniority_level', 'Principal', {
    'classification.seniority_level': {
      director: 'Director'
    }
  });

  assert.equal(result.value, 'Principal');
  assert.equal(result.translated, false);
  assert.equal(result.missingMapping, true);
});
