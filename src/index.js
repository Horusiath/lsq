import EventEmitter from 'eventemitter3'
import * as frac from './fractional-index'

/**
 * A compressed linear sequence CRDT.
 */
export class LSeq extends EventEmitter {
    /**
     * 
     * @param {string} peerId 
     */
    constructor(peerId) {
        /** @type {string} */
        this.peerId = peerId
        /** 
         * A sorted map from fractional index to value
         * @type {Array<{key:frac.FractionalIndex,value:string} | {key:frac.FractionalIndex,tombstone:number}>} 
         */
        this.entries = []
    }

    /**
     * Inserts a `value` at given index.
     * @param {number} index 
     * @param {string} value 
     */
    insert(index, value) {
        let offset = index
        let i = 0
        // find start index
        for(; i < this.entries.length; i++) {
            const e = this.entries[i]
            if (e.value) {
                offset -= e.value.length
                if (offset > 0) {
                    continue
                }
                if (offset < 0) {
                    // the insert index is inside of the current entry, so we need to split it
                    this.split(i, e.value.length + offset)
                }
            }
        }
        const left = frac.offset(e.key, e.value.length - 1)
        const right = i + 1 < this.entries.length ? this.entries[i+1].key : frac.MAX
        this.insertBetween(left, right, value)
    }

    /**
     * 
     * @param {frac.FractionalIndex} lower 
     * @param {frac.FractionalIndex} upper 
     * @param {string} value 
     */
    insertBetween(lower, upper, value) {
        //TODO: now we need to check if value can fit in space between left and right, if not we need to further split it        
        const key = frac.createBetween(this.peerId, left, right)
        const entry = { key, value }
        this.entries.insert(i+1, entry)
        this.emit('changed', entry)
    }

    remove(index, length = 1) {
        if (length == 0) {
            return
        }
        let offset = index
        let i = 0
        // find start index first
        for(; i < this.entries.length; i++) {
            const e = this.entries[i]
            if (e.value) {
                offset -= e.value.length
                if (offset <= 0) {
                    if (offset < 0) {
                        // the insert index is inside of the current entry, so we need to split it
                        this.split(i, e.value.length + offset)
                        i++
                    }
                    break
                }
            }
        }
        // remove elements
        while (length > 0) {
            let e = this.entries[i]
            if (e.value) {
                if (e.value.length > length) {
                    // we need to split current entry to contain the tombstone
                    this.split(i, length)
                }
                // tombstone current entry
                e.tombstone = e.value.length
                delete e.value
                this.emit('changed', e)
            }
            i++
        }
    }

    /**
     * Merge another Linear sequence into this one.
     * @param {({key:frac.FractionalIndex,value:string}|{key:frac.FractionalIndex,tombstone:number})[]} entries 
     */
    merge(entries) {
        for (let e of entries) {
            let [i, offset] = this.search(e.key)
        }
        throw Error('not implemented')
    }

    /**
     * Using binary search, try to find either index of an entry which contains search `key`
     * or index of an entry at which the `key` should be inserted if not found. In latter case
     * returned value will be negative insertion index.
     * 
     * @param {{key:FractionalIndex}[]} entries 
     * @param {FractionalIndex} key 
     * @returns {number}
     */
    search(entries, key) {
        let i = 0
        let j = entries.length
        let cmp
        while (i < j) {
            let n = (i + j) >> 1
            let [cmp, offset] = compare(key, entries[h])
            if (cmp > 0) {
                i = h + 1
            } else {
                j = h
            }
        }
        return i < entries.length && cmp == 0 ? i : -i
    }

    /**
     * Returns character at given `index`.
     * @param {number} index 
     * @returns {string|null}
     */
    get(index) {
        for(let i = 0; i < index;) {
            const e = this.entries[i]
            if (e.value) {
                i += e.value.length
                const diff = i - index
                if (diff >= 0) {
                    return e.value.charAt(e.value.length - diff)
                }
            }
        }
        return null
    }

    toString() {
        var str = ''
        for (let e of this.entries) {
            if (e.value) {
                str += e.value
            }
        }
        return str
    }

    /**
     * Split entry at index `i` at given `offset`.
     * @private
     * @param {number} i 
     * @param {number} offset 
     */
    split(i, offset) {
        const e = this.entries[i]
        const key = frac.offset(e.key, offset)
        let entry
        if (e.value) {
            const value = e.value.slice(offset)
            e.value = e.value.slice(0, offset)
            entry = { key, value }
        } else {
            const tombstone = e.tombstone - offset
            e.tombstone = offset
            entry = { key, tombstone }
        }
        this.entries.insert(i+1, entry)
    }
}