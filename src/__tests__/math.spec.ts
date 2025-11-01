import { addTwoNumbers } from '../utils/math';

describe('addTwoNumbers', () => {
  it('adds two positive numbers', () => {
    expect(addTwoNumbers(2, 3)).toBe(5);
  });
});
