import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVolumeHistogramBins,
  canAccessTab,
  computeLabVolumes,
  createInitialLessonState,
  gradeQuiz,
  normalizeShareUrl,
  QUIZ_QUESTIONS,
  submitPrediction,
} from './chemistryModel';
import { getAllMoleculeScenes, toSDF } from './molecularData';
import {
  computeMacroHeights,
  createMungBeanBatch,
  createPingPongBatch,
  DEFAULT_MACRO_CONFIG,
  stepMacroSimulation,
} from './macroParticles';

test('normalizeShareUrl strips autostart and falls back on invalid URLs', () => {
  assert.equal(
    normalizeShareUrl('https://example.com/lab?autostart=1&room=5', 'http://localhost:3000/'),
    'https://example.com/lab?room=5',
  );
  assert.equal(
    normalizeShareUrl('not-a-valid-url', 'http://localhost:3000/'),
    'http://localhost:3000/',
  );
});

test('POE prediction submission unlocks Tab 2 and validates inputs', () => {
  const initial = createInitialLessonState();
  assert.equal(canAccessTab(initial, 'predict'), true);
  assert.equal(canAccessTab(initial, 'observe'), false);

  const missingChoice = submitPrediction(initial, null, 'เหตุผลของฉัน');
  assert.equal(missingChoice.ok, false);
  assert.equal(missingChoice.nextState.tab2Unlocked, false);

  const missingReason = submitPrediction(initial, 'less', ' ');
  assert.equal(missingReason.ok, false);

  const valid = submitPrediction(
    initial,
    'less',
    'โมเลกุลน้ำขนาดเล็กแทรกเข้าช่องว่างของเอทิลแอลกอฮอล์',
  );
  assert.equal(valid.ok, true);
  assert.equal(valid.nextState.tab2Unlocked, true);
  assert.equal(valid.nextState.activeTab, 'observe');
  assert.equal(canAccessTab(valid.nextState, 'observe'), true);
  assert.equal(canAccessTab(valid.nextState, 'explain'), true);
  assert.equal(canAccessTab(valid.nextState, 'evaluate'), true);
});

test('computeLabVolumes returns accurate volume contraction and control mode volumes', () => {
  const empty = computeLabVolumes('empty', false);
  assert.equal(empty.actualMl, 0);

  const waterOnly = computeLabVolumes('water_added', false);
  assert.equal(waterOnly.actualMl, 12.0);
  assert.equal(waterOnly.contractionMl, 0);

  const ethanolSettled = computeLabVolumes('settled', false);
  assert.equal(ethanolSettled.theoreticalMl, 24.0);
  assert.equal(ethanolSettled.actualMl, 23.1);
  assert.equal(ethanolSettled.contractionMl, -0.9);

  const controlSettled = computeLabVolumes('settled', true);
  assert.equal(controlSettled.theoreticalMl, 24.0);
  assert.equal(controlSettled.actualMl, 24.0);
  assert.equal(controlSettled.contractionMl, 0.0);
});

test('buildVolumeHistogramBins returns 4 comparative bins with accurate ethanol and control values', () => {
  const ethanolBins = buildVolumeHistogramBins('settled', false);
  assert.equal(ethanolBins.length, 4);
  assert.equal(ethanolBins[0].volumeMl, 12.0);
  assert.equal(ethanolBins[1].volumeMl, 12.0);
  assert.equal(ethanolBins[2].volumeMl, 24.0);
  assert.equal(ethanolBins[3].volumeMl, 23.1);

  const controlBins = buildVolumeHistogramBins('settled', true);
  assert.equal(controlBins[2].volumeMl, 24.0);
  assert.equal(controlBins[3].volumeMl, 24.0);

  const mixingLive = buildVolumeHistogramBins('mixing', false, 23.6);
  assert.equal(mixingLive[3].volumeMl, 23.6);
});

test('quiz grading evaluates all 3 questions accurately', () => {
  assert.equal(QUIZ_QUESTIONS.length, 3);
  const partial = gradeQuiz({ q1: 'b' });
  assert.equal(partial.answeredCount, 1);
  assert.equal(partial.correctCount, 1);
  assert.equal(partial.isComplete, false);

  const allCorrect = gradeQuiz({ q1: 'b', q2: 'c', q3: 'a' });
  assert.equal(allCorrect.answeredCount, 3);
  assert.equal(allCorrect.correctCount, 3);
  assert.equal(allCorrect.isComplete, true);
});

test('molecularData builds 4 valid scenes with SDF output and H-bond segment', () => {
  const scenes = getAllMoleculeScenes();
  assert.equal(scenes.length, 4);
  assert.equal(scenes[0].atoms.length, 15); // 5 H2O * 3 atoms
  assert.equal(scenes[1].atoms.length, 36); // 4 C2H5OH * 9 atoms
  assert.equal(scenes[2].atoms.length, 12); // 1 H2O + 1 C2H5OH
  assert.ok(scenes[3].hBondSegment);

  for (const scene of scenes) {
    const sdf = toSDF(scene);
    assert.ok(sdf.includes('V2000'));
    assert.ok(sdf.includes('M  END'));
  }
});

test('macroParticles settles small mung beans into gaps so actual height < separate sum', () => {
  const big = createPingPongBatch(1, 24, DEFAULT_MACRO_CONFIG);
  const small = createMungBeanBatch(100, 96, DEFAULT_MACRO_CONFIG);
  const all = [...big, ...small];

  for (let i = 0; i < 180; i++) {
    stepMacroSimulation(all, DEFAULT_MACRO_CONFIG, 0.016);
  }

  const metrics = computeMacroHeights(all, DEFAULT_MACRO_CONFIG);
  assert.equal(metrics.ethanolCount, 24);
  assert.equal(metrics.waterCount, 96);
  assert.ok(metrics.actualFillHeight > 0);
  assert.ok(metrics.actualFillHeight < metrics.separateSumHeight);
  assert.ok(metrics.savedHeight > 0);
});
