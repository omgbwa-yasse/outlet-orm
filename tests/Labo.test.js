'use strict';

const { runLab } = require('../labo/src/lab');

jest.setTimeout(60000);

describe('Labo integration runner', () => {
  test('runLab executes all labo scenarios successfully', async () => {
    const report = await runLab({ reset: true });

    expect(report.totalScenarios).toBeGreaterThanOrEqual(11);
    expect(report.results).toHaveLength(report.totalScenarios);
    expect(report.results.every((result) => typeof result.durationMs === 'number')).toBe(true);

    const scenarioNames = report.results.map((result) => result.name);
    expect(scenarioNames).toEqual(expect.arrayContaining([
      'Schema + migration helpers',
      'API layer (MockAdapter)',
      'Reverse / CLI core',
      'AI + MCP local surfaces'
    ]));
  });
});
