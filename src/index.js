// numeric values will be converted into characters before inserting them into radix tree
const CHARS = [
    '0','1','2','3','4','5','6','7','8','9',
    'A','B','C','D','E','F','G','H','I','J',
    'K','L','M','N','O','P','Q','R','S','T',
    'U','V','W','X','Y','Z','a','b','c','d',
    'e','f','g','h','i','j','k','l','m','n',
    'o','p','q','r','s','t','u','v','w','x',
    'y','z'
]

const MIN = -1
const MAX = CHARS.length

/**
 * 
 * @param {string} key 
 * @param {number} offset
 * @returns {[string, string]}
 */
const splitKey = (key, offset) => {
    const splitIndex = key.lastIndexOf('#')
    const fractional = key.slice(0, splitIndex)
    const peer = key.slice(splitIndex+1)
    return [fractional, peer]
}
/**
 * 
 * @param {string} key 
 * @param {number} offset
 * @returns {string}
 */
const lastKey = (key, offset) => {
    const splitIndex = key.lastIndexOf('#')
    let fractional = key.slice(0, splitIndex)
    const peer = key.slice(splitIndex+1)

    const lastChar = fractional[fractional.length - 1] //TODO: get ASCII value
    lastChar += offset
    fractional = fractional.substring(0, fractional.length - 1) + CHARS[lastChar]
    return fractional + '#' + peer
}


/**
 * A compressed linear sequence CRDT.
 */
export class LSeq {
    /**
     * 
     * @param {string} peerId 
     */
    constructor(peerId) {
        /** @type {string} */
        this.peerId = peerId
        /** 
         * A sorted map from fractional index to value
         * @type {Array<{key:string,value:string}>} 
         */
        this.entries = []
    }

    /**
     * Inserts a `value` at given index.
     * @param {number} index 
     * @param {string} value 
     */
    insert(index, value) {
        const [min, max] = this.splitKeyAtIndex(index)
        this.insertBetween(min, max, value)
    }

    remove(index, length = 1) {
        throw Error('not implemented')
    }

    /**
     * Merge another Linear sequence into this one.
     * @param {Array<{key:string,value:string}>} entries 
     */
    merge(entries) {
        throw Error('not implemented')
    }

    /**
     * Returns character at given `index`.
     * @param {number} index 
     * @returns {string|null}
     */
    get(index) {
        for(let i = 0; i < index;) {
            let e = this.entries[i]
            i += e.value.length
            let diff = i - index
            if (diff >= 0) {
                return e.value.charAt(e.value.length - diff)
            }
        }
        return null
    }

    toString() {
        var str = ''
        for (let e of this.entries) {
            str += e.value
        }
        return str
    }

    /**
     * Insert current `value` at position between `min` and `max` keys.
     * @private
     * @param {string} min 
     * @param {string} max 
     * @param {string} value 
     */
    insertBetween(min, max, value) {
        throw Error('not implemented')
    }

    /**
     * Splits keys at a given index. Returns key neighbors that can be used as insertion points.
     * @private
     * @param {number} index 
     * @returns {[string, string]}
     */
    splitKeyAtIndex(index) {
        let visited = 0
        for(let i = 0; i < this.entries.length; i++) {
            let e = this.entries[i]
            visited += e.value.length
            let diff = visited - index
            if (diff > 0) {
                // split existing entry in two
                let offset = e.value.length - diff
                let rightValue = e.value.splice(offset, e.value.length - offset)
                let [leftKey, rightKey] = splitKey(e.key, offset)
                this.entries.insert(i+1, { key: rightKey, value: rightValue })
                return [leftKey, rightKey]
            } else if (diff == 0) {
                let leftKey = lastKey(e.key, e.value.length)
                let rightKey = i+1 < this.entries.length ? this.entries[i+1] : MAX
                return [leftKey, rightKey]
            }
        }
        return null
    }

    /**
     * Generates a fractional index fitting between `min` and `max`
     * @private
     * @param {string} min 
     * @param {string} max
     * @returns {string}
     */
    keyBetween(min, max) {
        throw Error('not implemented')
    }
}