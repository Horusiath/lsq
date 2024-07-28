import EventEmitter from 'eventemitter3'
import * as frac from './fractional-index.js'
import { Replicator } from './replicator.js'

/**
 * A compressed linear sequence CRDT.
 */
export class LSeq extends EventEmitter {
    /**
     * 
     * @param {Replicator} peerId 
     */
    constructor(replicator) {
        super()
        /** @type {number} */
        this.peerId = replicator.peerId
        /** 
         * Version clock used to timestamp and deduplicate incoming remote events.
         * @type {Map<number, number>} 
         */
        this.clock = new Map()
        /** 
         * A sorted map from fractional index to value
         * @type {Array<{key:frac.FractionalIndex,value:string}>} 
         */
        this.entries = []
        /**
         * Replicator used to exchange events between other LSeq replicas.
         * @type {Replicator}
         */
        this.replicator = replicator

        replicator.on('event', this.apply)
    }

    /**
     * Inserts a `value` at given index.
     * @param {number} index 
     * @param {string} value 
     */
    insert(index, value) {
        let offset = index
        let i = 0
        let e = null
        // find start index
        for(; i < this.entries.length; i++) {
            e = this.entries[i]
            offset -= e.value.length
            if (offset > 0) {
                continue
            }
            if (offset < 0) {
                // the insert index is inside of the current entry, so we need to split it
                this.split(i, e.value.length + offset)
                break
            }
        }
        const left = e && frac.offset(e.key, e.value.length - 1)
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
        let [key, distance] = frac.createBetween(this.peerId, lower, upper)
        if (distance >= value.length) {
            const entry = { key, value }
            const i = this.search(this.entries, entry.key)
            this.replicator.persist({
                key,
                inserted: value
            })
        } else {
            // value is too long to be inserted in one chunk, we need to split it
            const chunkSize = Math.ceil(value.length / distance)
            key = lower
            for (let i = 0; i < value.length; ) {
                let right = frac.offset(key, 1)
                const chunk = value.substring(i, (i+=chunkSize))
                key = this.insertBetween(key, right, chunk)
            }
        }
        return key
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
                const deleted = e.value.length
                delete e.value
                this.replicator.persist({
                    key: e.key,
                    deleted
                })
            }
            i++
        }
    }

    /**
     * Merge another Linear sequence into this one.
     * @param {{origin: number, originSeqNo: number, version: any, data: { key: frac.FractionalIndex, deleted?: number, inserted: string }}} event 
     */
    apply(event) {
        if (event.deleted) {
            // apply deletetion
            this.applyDelete(event.key, event.deleted)
        } else if (event.inserted) {
            // apply insertion
            this.applyInsert(event.key, event.inserted)
        }
    }

    /**
     * Starting at given `key` insert provided value.
     * @param {frac.FractionalIndex} key 
     * @param {string} value 
     */
    applyInsert(key, value) {
        const i = this.search(key)
        if (i >= 0) {
            throw new Error(`cannot insert key '${frac.toString(key)}' as it already exists in current collection`)
        }
        throw new Error()
    }
    
    /**
     * Starting at given `key` delete number of elements corresponding to that key.
     * @param {frac.FractionalIndex} key 
     * @param {number} length
     */
    applyDelete(key, length) {
        const i = this.search(key)
        if (i < 0) {
            throw new Error(`cannot delete at key '${frac.toString(key)}' as it doesn't exists in current collection`)
        }
        throw new Error()
    }

    /**
     * Using binary search, try to find either index of an entry which contains search `key`
     * or index of an entry at which the `key` should be inserted if not found. In latter case
     * returned value will be negative insertion index.
     * 
     * @param {FractionalIndex} key 
     * @returns {number}
     */
    search(key) {
        let i = 0
        let j = this.entries.length
        let cmp
        while (i < j) {
            let n = (i + j) >> 1
            let [cmp, offset] = compare(key, this.entries[n])
            if (cmp > 0) {
                i = h + 1
            } else {
                j = h
            }
        }
        return i < this.entries.length && cmp == 0 ? i : -i
    }

    /**
     * Returns character at given `index`.
     * @param {number} index 
     * @returns {string|null}
     */
    get(index) {
        for(let i = 0; i < index;) {
            const e = this.entries[i]
            i += e.value.length
            const diff = i - index
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
     * Split entry at index `i` at given `offset`.
     * @private
     * @param {number} i 
     * @param {number} offset 
     */
    split(i, offset) {
        const e = this.entries[i]
        const key = frac.offset(e.key, offset)
        const value = e.value.slice(offset)
        e.value = e.value.slice(0, offset)
        const entry = { key, value }
        this.entries.insert(i+1, entry)
    }
}