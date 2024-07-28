import { LSeq } from "../src/index.js"

const PEER_ID = 123

describe('compact linear sequence', () => {
    it('should allow inserting multi-character chunk to empty collection', () => {
        const lseq = new LSeq(PEER_ID)
        lseq.insert(0, 'hello world')
        expect(lseq.entries.length).toBe(1)
        const str = lseq.toString()
        expect(str).toBe('hello world')
    })
})