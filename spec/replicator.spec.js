import { Replicator } from "../src/replicator.js"

describe('Replicator', () => {
    it('should persist events in order', () => {
        const replicator = new Replicator(1)
        replicator.persist('a')
        replicator.persist('b')
        replicator.persist('c')
        replicator.persist('d')

        expect(replicator.log).toEqual([
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 1, originSeqNo: 2, version: {1: 2}, data: 'b' },
            { origin: 1, originSeqNo: 3, version: {1: 3}, data: 'c' },
            { origin: 1, originSeqNo: 4, version: {1: 4}, data: 'd' }
        ])
    })

    if('should exchange existing events with other replicators', () => {
        const r1 = new Replicator(1)
        r1.persist('a')
        r1.persist('b')

        const r2 = new Replicator(2)
        r2.persist('c')
        r2.persist('d')

        r1.connect(r2)

        expect(r1.log).toEqual([
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 1, originSeqNo: 2, version: {1: 2}, data: 'b' },
            { origin: 2, originSeqNo: 1, version: {2: 1}, data: 'c' },
            { origin: 2, originSeqNo: 2, version: {2: 2}, data: 'd' }
        ])

        r2.connect(r1)
        
        expect(r2.log).toEqual([
            { origin: 2, originSeqNo: 1, version: {2: 1}, data: 'c' },
            { origin: 2, originSeqNo: 2, version: {2: 2}, data: 'd' },
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 1, originSeqNo: 2, version: {1: 2}, data: 'b' }
        ])
    })

    it('should exchange events continuously after connect', () => {
        const r1 = new Replicator(1)
        const r2 = new Replicator(2)

        r1.connect(r2)
        r2.connect(r1)

        r1.persist('a')
        r2.persist('b')
        
        expect(r1.log).toEqual([
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 2, originSeqNo: 2, version: {1: 1, 2: 1}, data: 'b' }
        ])
        expect(r2.log).toEqual([
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 2, originSeqNo: 2, version: {1: 1, 2: 1}, data: 'b' }
        ])
    })

    it('disconnect should severe connection', () => {
        const r1 = new Replicator(1)
        const r2 = new Replicator(2)

        r1.connect(r2)
        r2.connect(r1)

        r1.persist('a')
        r2.persist('b')
        
        expect(r1.log).toEqual([
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 2, originSeqNo: 2, version: {1: 1, 2: 1}, data: 'b' }
        ])
        expect(r2.log).toEqual([
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 2, originSeqNo: 2, version: {1: 1, 2: 1}, data: 'b' }
        ])

        r1.disconnect(r2)
        r2.disconnect(r1)

        r1.persist('c')
        r2.persist('d')
        
        expect(r1.log).toEqual([
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 2, originSeqNo: 2, version: {1: 1, 2: 1}, data: 'b' },
            { origin: 1, originSeqNo: 3, version: {1: 2, 2: 1}, data: 'c' }
        ])
        expect(r2.log).toEqual([
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 2, originSeqNo: 2, version: {1: 1, 2: 1}, data: 'b' },
            { origin: 2, originSeqNo: 3, version: {1: 1, 2: 2}, data: 'd' }
        ])
        
        // reconnect
        r1.connect(r2)
        r2.connect(r1)
        
        expect(r1.log).toEqual([
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 2, originSeqNo: 2, version: {1: 1, 2: 1}, data: 'b' },
            { origin: 1, originSeqNo: 3, version: {1: 2, 2: 1}, data: 'c' },
            { origin: 2, originSeqNo: 3, version: {1: 1, 2: 2}, data: 'd' }
        ])
        expect(r2.log).toEqual([
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 2, originSeqNo: 2, version: {1: 1, 2: 1}, data: 'b' },
            { origin: 2, originSeqNo: 3, version: {1: 1, 2: 2}, data: 'd' },
            { origin: 1, originSeqNo: 3, version: {1: 2, 2: 1}, data: 'c' }
        ])
    })

    it('should deal with duplicate events from other peers', () => {
        const r1 = new Replicator(1)
        const r2 = new Replicator(2)
        const r3 = new Replicator(3)

        r1.persist('a')
        r2.persist('b')
        r3.persist('c')

        // r1 <-> r2
        r1.connect(r2)
        r2.connect(r1)
        // r1 <-> r3
        r1.connect(r3)
        r3.connect(r1)
        // r2 <-> r3
        r2.connect(r3)
        r3.connect(r2)

        r1.persist('d')
        r2.persist('e')
        r3.persist('f')
        
        expect(r1.log).toEqual([
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 2, originSeqNo: 1, version: {2: 1}, data: 'b' },
            { origin: 3, originSeqNo: 1, version: {3: 1}, data: 'c' },
            { origin: 1, originSeqNo: 4, version: {1: 2, 2: 1, 3: 1}, data: 'd' },
            { origin: 2, originSeqNo: 5, version: {1: 2, 2: 2, 3: 1}, data: 'e' },
            { origin: 3, originSeqNo: 6, version: {1: 2, 2: 2, 3: 2}, data: 'f' },
        ])
        
        expect(r2.log).toEqual([
            { origin: 2, originSeqNo: 1, version: {2: 1}, data: 'b' },
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 3, originSeqNo: 1, version: {3: 1}, data: 'c' },
            { origin: 1, originSeqNo: 4, version: {1: 2, 2: 1, 3: 1}, data: 'd' },
            { origin: 2, originSeqNo: 5, version: {1: 2, 2: 2, 3: 1}, data: 'e' },
            { origin: 3, originSeqNo: 6, version: {1: 2, 2: 2, 3: 2}, data: 'f' },
        ])
        
        expect(r3.log).toEqual([
            { origin: 3, originSeqNo: 1, version: {3: 1}, data: 'c' },
            { origin: 1, originSeqNo: 1, version: {1: 1}, data: 'a' },
            { origin: 2, originSeqNo: 1, version: {2: 1}, data: 'b' },
            { origin: 1, originSeqNo: 4, version: {1: 2, 2: 1, 3: 1}, data: 'd' },
            { origin: 2, originSeqNo: 5, version: {1: 2, 2: 2, 3: 1}, data: 'e' },
            { origin: 3, originSeqNo: 6, version: {1: 2, 2: 2, 3: 2}, data: 'f' },
        ])
    })
})