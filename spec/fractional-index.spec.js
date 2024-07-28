import * as frac from '../src/fractional-index.js'

describe('Fractional index', () => {
    it('lower bound', () => {
        const [index, distance] = frac.createBetween(123, null, null, true)
        expect(index).toEqual(new Uint8Array([1, 123]))
        expect(distance).toBe(254)
    })
    it('upper bound', () => {
        const [index, distance] = frac.createBetween(123, null, null, false)
        expect(index).toEqual(new Uint8Array([254, 123]))
        expect(distance).toBe(1)
    })
    it('should generate keys greater than lower and lesser than upper bounds', () => {
        const check = (lo, hi, lowerBound) => {
            const [key, _] = frac.createBetween(123, lo, hi, lowerBound)
            let cmp = frac.compare()
        }
    })
})