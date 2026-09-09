// Pure geometry and evidence: exploring or revealing never certifies mastery.
export const stages = ['predict', 'explore', 'explain', 'apply', 'transfer', 'create'];
export function rectangle(width, height) {
  if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 12)) throw new RangeError('Sides must be whole numbers from 1 to 12.');
  return { width, height, area: width * height, perimeter: 2 * (width + height) };
}
export function validPair(a, b) {
  return a.perimeter === b.perimeter && a.area !== b.area;
}
export function initialGarden() {
  return { version: 1, stage: 0, width: 6, revealed: false, visited: [], prediction: null, hints: {}, attempts: [], completed: false };
}
export function evidence(s) {
  const first = stage => s.attempts.find(a => a.stage === stage);
  const independent = stage => first(stage)?.correct === true && !first(stage).supported;
  return {
    explored: s.visited.length >= 2,
    applied: first('apply') ? (independent('apply') ? 'independent first attempt' : 'practised with support or revision') : 'not yet tried',
    transferred: first('transfer') ? (independent('transfer') ? 'independent first attempt' : 'practised with support or revision') : 'not yet tried',
    created: s.attempts.some(a => a.stage === 'create' && a.correct),
  };
}
