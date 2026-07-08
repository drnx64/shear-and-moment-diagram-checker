import { describe, it, expect } from 'vitest';
import { solveBeam, computeInternalShearMoment } from './solver';
import type { BeamSupport, PointLoad, ConcentratedMoment, DistributedLoad } from '../types';

function support(id: string, type: 'fixed' | 'pin' | 'roller', position: number): BeamSupport {
  return { id, type, position };
}

function pointLoad(id: string, magnitude: number, position: number, direction: 'up' | 'down' = 'down', angle = 0): PointLoad {
  return { id, magnitude, position, direction, angle, loadCase: 'dead', repeatCount: 1, repeatInterval: 0 };
}

function moment(id: string, magnitude: number, position: number, direction: 'CW' | 'CCW' = 'CW'): ConcentratedMoment {
  return { id, magnitude, position, direction, loadCase: 'dead' };
}

function distLoad(id: string, startPos: number, endPos: number, startMag: number, endMag: number): DistributedLoad {
  return { id, startPos, endPos, startMag, endMag, loadCase: 'dead' };
}

describe('solver sign convention validation', () => {
  // Test 1: Simple beam (pin-roller), point load P at midspan
  it('simple beam with midspan point load', () => {
    const result = solveBeam(
      10,
      [support('s1', 'pin', 0), support('s2', 'roller', 10)],
      [pointLoad('p1', 10, 5, 'down')],
      [],
      [],
    );

    expect(result.reactions.length).toBe(2);
    const rLeft = result.reactions.find(r => r.supportId === 's1')!;
    const rRight = result.reactions.find(r => r.supportId === 's2')!;
    expect(rLeft.vertical).toBeCloseTo(5, 8);
    expect(rRight.vertical).toBeCloseTo(5, 8);

    // Shear: +P/2 left half, -P/2 right half
    const leftShear = computeInternalShearMoment(3, [support('s1', 'pin', 0), support('s2', 'roller', 10)], [pointLoad('p1', 10, 5, 'down')], [], [], result.reactions);
    expect(leftShear.shear).toBeCloseTo(5, 8);
    const rightShear = computeInternalShearMoment(7, [support('s1', 'pin', 0), support('s2', 'roller', 10)], [pointLoad('p1', 10, 5, 'down')], [], [], result.reactions);
    expect(rightShear.shear).toBeCloseTo(-5, 8);

    // Moment: PL/4 at midspan (sagging = positive)
    const midMoment = computeInternalShearMoment(5, [support('s1', 'pin', 0), support('s2', 'roller', 10)], [pointLoad('p1', 10, 5, 'down')], [], [], result.reactions);
    expect(midMoment.moment).toBeCloseTo(25, 8); // PL/4 = 10*10/4 = 25

    // Moment at quarter span: Px/2 = 10*2.5/2 = 12.5
    const quarterMoment = computeInternalShearMoment(2.5, [support('s1', 'pin', 0), support('s2', 'roller', 10)], [pointLoad('p1', 10, 5, 'down')], [], [], result.reactions);
    expect(quarterMoment.moment).toBeCloseTo(12.5, 8);
  });

  // Test 2: Simple beam, UDL w over full length
  it('simple beam with UDL', () => {
    const result = solveBeam(
      10,
      [support('s1', 'pin', 0), support('s2', 'roller', 10)],
      [],
      [],
      [distLoad('d1', 0, 10, 5, 5)],
    );

    expect(result.reactions.length).toBe(2);
    const rLeft = result.reactions.find(r => r.supportId === 's1')!;
    const rRight = result.reactions.find(r => r.supportId === 's2')!;
    expect(rLeft.vertical).toBeCloseTo(25, 8); // wL/2 = 5*10/2 = 25
    expect(rRight.vertical).toBeCloseTo(25, 8);

    // Max moment at midspan: wL²/8 = 5*100/8 = 62.5
    const midMoment = computeInternalShearMoment(5, [support('s1', 'pin', 0), support('s2', 'roller', 10)], [], [], [distLoad('d1', 0, 10, 5, 5)], result.reactions);
    expect(midMoment.moment).toBeCloseTo(62.5, 6);

    // Shear at quarter span: w(L/2 - x) = 5*(5-2.5) = 12.5
    const quarterShear = computeInternalShearMoment(2.5, [support('s1', 'pin', 0), support('s2', 'roller', 10)], [], [], [distLoad('d1', 0, 10, 5, 5)], result.reactions);
    expect(quarterShear.shear).toBeCloseTo(12.5, 6);
  });

  // Test 3: Cantilever (fixed at x=0), tip load P
  it('cantilever with tip point load', () => {
    const result = solveBeam(
      10,
      [support('s1', 'fixed', 0)],
      [pointLoad('p1', 10, 10, 'down')],
      [],
      [],
    );

    expect(result.reactions.length).toBe(1);
    const rFixed = result.reactions[0];
    expect(rFixed.vertical).toBeCloseTo(10, 8); // upward reaction = load
    expect(rFixed.moment).toBeCloseTo(-100, 6); // -PL (hogging, negative)

    // Reaction moment directly is -PL = -100 (the internal moment at x=0)
    expect(rFixed.moment).toBeCloseTo(-100, 6);

    // Moment at midspan: -P(L-x) = -10*(10-5) = -50
    const midMoment = computeInternalShearMoment(5, [support('s1', 'fixed', 0)], [pointLoad('p1', 10, 10, 'down')], [], [], result.reactions);
    expect(midMoment.moment).toBeCloseTo(-50, 6);

    // Shear should be +10 throughout (constant)
    const midShear = computeInternalShearMoment(5, [support('s1', 'fixed', 0)], [pointLoad('p1', 10, 10, 'down')], [], [], result.reactions);
    expect(midShear.shear).toBeCloseTo(10, 6);

    // Moment at tip should be 0 (free end)
    const tipMoment = computeInternalShearMoment(9.9999, [support('s1', 'fixed', 0)], [pointLoad('p1', 10, 10, 'down')], [], [], result.reactions);
    expect(Math.abs(tipMoment.moment)).toBeLessThan(0.01);
  });

  // Test 4: Cantilever with UDL
  it('cantilever with UDL', () => {
    const result = solveBeam(
      10,
      [support('s1', 'fixed', 0)],
      [],
      [],
      [distLoad('d1', 0, 10, 5, 5)],
    );

    expect(result.reactions.length).toBe(1);
    const rFixed = result.reactions[0];
    expect(rFixed.vertical).toBeCloseTo(50, 6); // wL = 5*10 = 50
    expect(rFixed.moment).toBeCloseTo(-250, 5); // -wL²/2 = -5*100/2 = -250 (internal moment at support)

    // Moment at midspan: -w(L-x)²/2 = -5*(10-5)²/2 = -62.5
    const midMoment = computeInternalShearMoment(5, [support('s1', 'fixed', 0)], [], [], [distLoad('d1', 0, 10, 5, 5)], result.reactions);
    expect(midMoment.moment).toBeCloseTo(-62.5, 5);
  });

  // Test 5: Simple beam with concentrated moment at midspan
  it('simple beam with concentrated CCW moment at midspan', () => {
    const result = solveBeam(
      10,
      [support('s1', 'pin', 0), support('s2', 'roller', 10)],
      [],
      [moment('m1', 20, 5, 'CCW')],
      [],
    );

    const rLeft = result.reactions.find(r => r.supportId === 's1')!;
    const rRight = result.reactions.find(r => r.supportId === 's2')!;
    expect(rLeft.vertical).toBeCloseTo(-2, 8); // -M₀/L = -20/10 = -2 (downward)
    expect(rRight.vertical).toBeCloseTo(2, 8);  // +M₀/L = +20/10 = +2 (upward)

    // Moment left of midspan: M₀·x/L = -20*x/10 = -2x (negative = hogging)
    const leftMoment = computeInternalShearMoment(3, [support('s1', 'pin', 0), support('s2', 'roller', 10)], [], [moment('m1', 20, 5, 'CCW')], [], result.reactions);
    expect(leftMoment.moment).toBeCloseTo(-6, 6); // -20*3/10 = -6

    // Moment right of midspan: M₀(1 - x/L) = 20(1-x/10) (positive = sagging)
    const rightMoment = computeInternalShearMoment(7, [support('s1', 'pin', 0), support('s2', 'roller', 10)], [], [moment('m1', 20, 5, 'CCW')], [], result.reactions);
    expect(rightMoment.moment).toBeCloseTo(6, 6); // 20(1-7/10) = 6
  });

  // Test 6: Cantilever with upward load (should give sagging = positive moment)
  it('cantilever with upward tip load', () => {
    const result = solveBeam(
      10,
      [support('s1', 'fixed', 0)],
      [pointLoad('p1', 10, 10, 'up')],
      [],
      [],
    );

    const rFixed = result.reactions[0];
    // Upward load at tip → beam bends upward → bottom fibers in tension at support → sagging → +M
    // Internal moment at support M(0+) = +P*L = +100
    // Reaction vertical = -P (downward) to balance upward load
    expect(rFixed.vertical).toBeCloseTo(-10, 8);
    expect(rFixed.moment).toBeCloseTo(100, 6);

    // Internal moment within the beam at x=5 should also be +P(L-x) = +10*(10-5) = +50
    const midMoment = computeInternalShearMoment(5, [support('s1', 'fixed', 0)], [pointLoad('p1', 10, 10, 'up')], [], [], result.reactions);
    expect(midMoment.moment).toBeCloseTo(50, 6);
  });

  // Test 7: dM/dx = V relationship
  it('dM/dx = V', () => {
    const supports = [support('s1', 'pin', 0), support('s2', 'roller', 10)];
    const loads = [pointLoad('p1', 10, 5, 'down')];
    const moments: ConcentratedMoment[] = [];
    const distLoads: DistributedLoad[] = [];
    const result = solveBeam(10, supports, loads, moments, distLoads);

    // At x=3, check V = dM/dx
    const at3 = computeInternalShearMoment(3, supports, loads, moments, distLoads, result.reactions);
    const at3_01 = computeInternalShearMoment(3.01, supports, loads, moments, distLoads, result.reactions);
    const dMdx = (at3_01.moment - at3.moment) / 0.01;
    expect(at3.shear).toBeCloseTo(dMdx, 2);

    // At x=7
    const at7 = computeInternalShearMoment(7, supports, loads, moments, distLoads, result.reactions);
    const at7_01 = computeInternalShearMoment(7.01, supports, loads, moments, distLoads, result.reactions);
    const dMdx7 = (at7_01.moment - at7.moment) / 0.01;
    expect(at7.shear).toBeCloseTo(dMdx7, 2);
  });
});

  // Test 8: Simple beam with CW concentrated moment (opposite of test 5)
  it('simple beam with concentrated CW moment at midspan', () => {
    const result = solveBeam(
      10,
      [support('s1', 'pin', 0), support('s2', 'roller', 10)],
      [],
      [moment('m1', 20, 5, 'CW')],
      [],
    );

    const rLeft = result.reactions.find(r => r.supportId === 's1')!;
    const rRight = result.reactions.find(r => r.supportId === 's2')!;
    // CW moment at midspan → left reaction upward (+), right reaction downward (-)
    expect(rLeft.vertical).toBeCloseTo(2, 8);
    expect(rRight.vertical).toBeCloseTo(-2, 8);

    // Moment left of midspan: +M₀·x/L = +20·3/10 = +6 (sagging)
    const leftMoment = computeInternalShearMoment(3, [support('s1', 'pin', 0), support('s2', 'roller', 10)], [], [moment('m1', 20, 5, 'CW')], [], result.reactions);
    expect(leftMoment.moment).toBeCloseTo(6, 6);
  });

describe('reaction computation edge cases', () => {
  it('simple beam with linearly varying distributed load', () => {
    const result = solveBeam(
      10,
      [support('s1', 'pin', 0), support('s2', 'roller', 10)],
      [],
      [],
      [distLoad('d1', 0, 10, 0, 10)],
    );

    const rLeft = result.reactions.find(r => r.supportId === 's1')!;
    const rRight = result.reactions.find(r => r.supportId === 's2')!;

    // Total force = (0+10)*10/2 = 50, centroid at 10*(0+2*10)/(3*(0+10)) = 10*20/30 = 6.67
    // Moment equilibrium about left: rRight*10 - 50*6.67 = 0 → rRight = 33.33
    // Vertical equilibrium: rLeft + 33.33 - 50 = 0 → rLeft = 16.67
    expect(rLeft.vertical).toBeCloseTo(16 + 2/3, 5);
    expect(rRight.vertical).toBeCloseTo(33 + 1/3, 5);
  });

  it('handles empty beam gracefully', () => {
    const result = solveBeam(0, [], [], [], []);
    expect(result.reactions).toHaveLength(0);
    expect(result.diagramPoints).toHaveLength(0);
  });
});
