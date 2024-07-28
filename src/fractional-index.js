/**
 * A Fractional index is used by Linear Sequence CRDT in place of mutable indexes.
 * It's an ever growing array of numbers, where the last one indicates unique peer ID. 
 * @typedef {Uint8Array} FractionalIndex
 */

/**
 * Minimal possible fractional index used as a lower bound when none was provided.
 * @type {FractionalIndex}
 */
export const MIN = new Uint8Array([0,0])

/**
 * Maximum possible fractional index used as an upper bound when none was provided.
 * @type {FractionalIndex}
 */
export const MAX = new Uint8Array([255,0])

/**
 * Returns an unique peer ID of a peer which created current index.
 * @param {FractionalIndex} index 
 * @returns {number}
 */
export const peer = (index) => index[index.length - 1]

/**
 * Returns a string representation of fractional index
 * @param {FractionalIndex} index 
 * @returns {string}
 */
export const toString = (index) => {
    let str = index[0]
    for(let i = 1; i < index.length - 1; i++) {
        str += '.' + index[i].toString(16)
    }
    // write peer ID prefixed by `:`
    str += ':' + index[index.length - 1].toString(16)
    return str
}

/**
 * Compares two fractional indexes together.
 * 
 * @param {FractionalIndex} key 
 * @param {({key:FractionalIndex,value:string}|{key:FractionalIndex,tombstone:number})} entry 
 * @returns {[number, number]}
 */
export const compare = (key, entry) => {
    let i = 0
    for (; i < key.length && i < entry.length; i++) {
        const ai = key[i]
        const bi = entry.key[i]
        const length = entry.tombstone || entry.value.length
        if (ai < bi) {
            return -1
        } else if (ai > bi) {
            return 1
        }
    }
    if (key.length < entry.length) {
        return -1
    } else if (key.length > entry.length) {
        return 1
    } else {
        return 0
    }
}

/**
 * Returns a fractional index which last part is offseted by given `offset`.
 * @param {FractionalIndex} key 
 * @param {number} offset 
 * @returns {FractionalIndex}
 */
export const offset = (key, offset) => {
    let result = new Uint8Array(key)
    result[result.length - 2] += offset
    return result
}

/**
 * Generates a fractional index that's lexically between `lower` and `upper` neighbors.
 * Returns a newly generated index and a distance to upper neighbor (number of elements that can be sequentially inserted).
 * 
 * @param {number} peerId an unique peer ID of a person which creates this fractional index
 * @param {FractionalIndex|null} lower bound that must be lexically lower than a generated index
 * @param {FractionalIndex|null} upper bound that must be lexically higher than a generated index
 * @param {bool} lowerBound determines if generated element should be closer to the `lower` than `upper` bound
 * @returns {[FractionalIndex,number]} newly generated fractional index and a distance from it to an `upper` bound
 */
export const createBetween = (peerId, lower, upper, lowerBound = true) => {
    lower |= MIN
    upper |= MAX
    let result = []
    let i = 0
    let distance = 0 // distance describes how many elements can be inserted between lower[i] and upper[i]
    for (;i < lower.length - 1 && i < upper.length - 1; i++) {
        const lo = lower[i]
        const up = upper[i]
        if (up > lo + 1) {
            // lower and upper are different at index `i`
            const n = lowerBound ? lo + 1 : up - 1
            distance = up - n
            result.push(n)
            break
        } else {
            // lower and upper are the same at index `i`
            result.push(lo) 
        }
    }
    while (distance === 0) {
        const lo = i < lower.length - 1 ? lower[i] : 0
        const up = i < upper.length - 1 ? lower[i] : 255
        if (up > lo + 1) {
            const n = lowerBound ? lo + 1 : up - 1
            distance = up - n
            result.push(n)
        } else {
            result.push(lo)
        }
        i++
    }
    // append peer ID
    result.push(peerId)
    return [new Uint8Array(result), distance]
}