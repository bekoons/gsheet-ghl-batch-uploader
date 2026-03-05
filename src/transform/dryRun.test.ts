import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDryRunRowOutput } from './dryRun';

test('buildDryRunRowOutput includes resolved upsert body and translation log', () => {
  const output = buildDryRunRowOutput({
    sheetRowNumber: 8,
    linkedin_profile_url: 'https://www.linkedin.com/in/example',
    upsertBody: {
      locationId: 'loc_1',
      email: 'oops+li_abc@prospectif.ai',
      customFields: [{ id: 'x', value: 'Director' }]
    },
    usedSyntheticEmail: true,
    optionTranslations: [
      {
        engineKey: 'classification.seniority_level',
        customFieldId: 'x',
        rawValue: 'director',
        mappedValue: 'Director',
        translated: true,
        missingMapping: false
      }
    ]
  });

  assert.equal(output.sheetRowNumber, 8);
  assert.equal(output.usedSyntheticEmail, true);
  assert.deepEqual(output.upsertBody, {
    locationId: 'loc_1',
    email: 'oops+li_abc@prospectif.ai',
    customFields: [{ id: 'x', value: 'Director' }]
  });
  assert.equal(output.optionTranslations.length, 1);
});
