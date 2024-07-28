import EventEmitter from "eventemitter3"

/**
 * Replicator is used to provide a Causal Broadcast Delivery between two peers.
 */
export class Replicator extends EventEmitter {
    /**
     * 
     * @param {number} peerId
     */
    constructor(peerId) {
        super()
        /** 
         * ID of the peer, current `Replicator` is responsible for.
         * @type {number} 
         */
        this.peerId = peerId
        /**
         * Vector clock (peer => sequence number) representing the latest observer version.
         * @type {any}
         */
        this.version = {}
        /**
         * Map describing replication progress amongs other known peers. Each key describes 
         * peer ID, while value describes latest received log position of that peer.
         * @type {Map<number, number>}
         */
        this.replicationProgress = new Map()
        /**
         * Map of callbacks used on other replicators.
         * @type{Map<number, function>}
         */
        this.connections = new Map()
        /**
         * Log of events.
         * @type {Array<{origin: number, originSeqNo: number, version: any, data: T}>}
         */
        this.log = []
    }

    /**
     * 
     * @template {T}
     * @param {T} data
     * @returns {{origin: number, originSeqNo: number, version: any, data: T}}
     */
    persist(data) {
        const version = this.nextVersion()
        const event = {
            origin: this.peerId,
            originSeqNo: this.log.length + 1,
            version,
            data,
        }
        this.save(event, true)
        return event
    }

    /**
     * Connects current replicator to remote one.
     * This is a one-way connection.
     * @param {Replicator} other 
     */
    connect(other) {
        let lastSeenSeqNo = this.replicationProgress.get(other.peerId) || 0
        // get events from a given seqNo
        for (let i = lastSeenSeqNo; i < other.log.length; i++) {
            let event = other.log[i]
            if (!this.seen(event)) {
                this.save(event, false)
            } else {
                this.replicationProgress.set(event.origin, event.originSeqNo)
            }
        }
        
        if (!this.connections.get(other.peerId)) {
            const callback = ((event, isLocal) => {
                if (!this.seen(event)) {
                    this.save(event, false)
                }
            }).bind(this)
            other.on('event', callback)
            this.connections.set(other.peerId, callback)
        }
    }

    /**
     * Disconnects current replicator from the remote one.
     * This is a one-way connection.
     * @param {Replicator} other 
     */
    disconnect(other) {
        const conn = this.connections.get(other.peerId)
        if (conn) {
            other.off('event', conn)
            this.connections.delete(other.peerId)
        }
    }

    /**
     * @private
     * @returns {{number,number}}
     */
    nextVersion() {
        const clock = Object.assign({}, this.version)
        clock[this.peerId] = (clock[this.peerId] || 0) + 1
        return clock
    }

    /**
     * @private
     * @param {{origin: number, originSeqNo: number, version: any, data: T}} event 
     * @returns {boolean}
     */
    seen(event) {
        let lastSeenSeqNo = this.replicationProgress.get(event.origin)
        if (lastSeenSeqNo >= event.originSeqNo) {
            return true
        } else {
            const result = vectorClockCompare(this.version, event.version)
            return result !== null && result >= 0
        }
    }

    /**
     * 
     * @private
     * @param {{origin: number, originSeqNo: number, version: any, data: T}} event 
     * @param {boolean} isLocal
     */
    save(event, isLocal) {
        this.log.push(event)
        this.replicationProgress.set(event.origin, event.originSeqNo)
        merge(this.version, event.version)
        this.emit('event', event, isLocal)
    }
}

/**
 * Merges `from` vector clock to `into` clock.
 * @param {any} into 
 * @param {any} from 
 */
const merge = (into, from) => {
    for (let k in from) {
        const v1 = from[k]
        const v2 = into[k] || 0
        into[k] = Math.max(v1, v2)
    }
}

/**
 * Compare two vector clocks against each other.
 * Null is a special case that marks if vector clocks are concurrent to each other.
 * 
 * @param {any} a 
 * @param {any} b 
 * @return {number|null}
 */
const vectorClockCompare = (a, b) => {
    let result = 0
    for (let ka in a) {
        const va = a[ka]
        const vb = b[ka] || 0
        if (va > vb) {
            if (result < 0) {
                return null // concurrent
            }
            result = 1
        } else if (va < vb) {
            if (result > 0) {
                return null // concurrent
            }
            result = -1
        }
    }
    for (let kb in b) {
        const vb = b[kb]
        const va = a[kb] || 0
        if (va > vb) {
            if (result < 0) {
                return null // concurrent
            }
            result = 1
        } else if (va < vb) {
            if (result > 0) {
                return null // concurrent
            }
            result = -1
        }
    }
    return result
}