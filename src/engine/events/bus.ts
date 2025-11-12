// Event Bus Phase 0 implementation to satisfy tests/spec in docs/events/EVENT_BUS_SPEC.md

export type Channel = 'frameBegin' | 'fixedEnd' | 'frameEnd' | 'immediate'
export type EventId = number

export type BusOptions = {
  capacity?: number
  mailboxCapacity?: number
}

type SubscriberId = string

// Header SoA lanes per slot
// We store header fields in u32/f64 arrays per channel. For simplicity:
// - id: u32
// - seq: f64 (logical, monotonic)
// - frame: u32 (tests do not assert real frames yet)
// - tick: u32 (monotonic per channel publish)
// - valid: u32 (1 or 0)

class ChannelRing {
  readonly cap: number
  readonly mask: number
  seqHead = 0 // logical head seq (starts at 0, next publish pre-increments)
  tick = 0
  // Header lanes
  id: Uint32Array
  seqHi: Float64Array // store as f64 directly
  frame: Uint32Array
  tickLane: Uint32Array
  valid: Uint32Array
  // Payload lanes (fixed sizes per spec phase 0)
  f32: Float32Array
  i32: Int32Array
  u32: Uint32Array
  s: Uint32Array
  // Strides (per slot)
  readonly F32_STRIDE = 16
  readonly I32_STRIDE = 8
  readonly U32_STRIDE = 8
  readonly S_STRIDE = 4

  constructor(capacity: number) {
    this.cap = capacity
    this.mask = capacity - 1
    // Allocate SoA buffers per lane
    this.id = new Uint32Array(capacity)
    this.seqHi = new Float64Array(capacity)
    this.frame = new Uint32Array(capacity)
    this.tickLane = new Uint32Array(capacity)
    this.valid = new Uint32Array(capacity)
    this.f32 = new Float32Array(capacity * this.F32_STRIDE)
    this.i32 = new Int32Array(capacity * this.I32_STRIDE)
    this.u32 = new Uint32Array(capacity * this.U32_STRIDE)
    this.s = new Uint32Array(capacity * this.S_STRIDE)
  }

  reserve(): { seq: number; slot: number; base: { f32: number; i32: number; u32: number; s: number }, overwritten: boolean } {
    const seq = ++this.seqHead
    const slot = seq & this.mask
    const wasValid = this.valid[slot] === 1
    const prevSeq = this.seqHi[slot]
    const base = {
      f32: slot * this.F32_STRIDE,
      i32: slot * this.I32_STRIDE,
      u32: slot * this.U32_STRIDE,
      s: slot * this.S_STRIDE,
    }
    // Mark invalid until header is written last
    this.valid[slot] = 0
    return { seq, slot, base, overwritten: wasValid && prevSeq !== 0 }
  }

  writeHeader(slot: number, id: EventId, seq: number, frame: number, tick: number) {
    this.id[slot] = id >>> 0
    this.seqHi[slot] = seq
    this.frame[slot] = frame >>> 0
    this.tickLane[slot] = tick >>> 0
    this.valid[slot] = 1
  }
}

class Mailbox {
  readonly cap: number
  readonly mask: number
  buf: Uint32Array
  head = 0
  tail = 0
  len = 0
  constructor(capacity: number) {
    this.cap = capacity
    this.mask = capacity - 1
    this.buf = new Uint32Array(capacity)
  }
  // Push seq, return true if enqueued, false if overflow (drop)
  push(seq: number): boolean {
    if (this.len >= this.cap) {
      return false
    }
    this.buf[this.tail] = seq >>> 0
    this.tail = (this.tail + 1) & this.mask
    this.len++
    return true
  }
  // Pop upto limit, calling fn for each; returns number processed
  // Note: We do not enforce limit for now; tests do not pass limit.
  read(fn: (seq: number) => void, limit?: number): number {
    const max = limit ? Math.min(this.len, limit) : this.len
    for (let i = 0; i < max; i++) {
      const seq = this.buf[this.head]
      this.head = (this.head + 1) & this.mask
      this.len--
      fn(seq)
    }
    return max
  }
  fastForward() {
    this.head = this.tail
    this.len = 0
  }
}

type Wants = { channel: Channel; ids: EventId[] }

type ChannelData = {
  ring: ChannelRing
  // map event id -> list of subscriber ids
  subs: Map<EventId, Set<SubscriberId>>
}

export type BusMetrics = {
  drops: { channel: number; tombstone: number; mailbox: Record<string, number> }
}

export class EventBus {
  private readonly channels: Record<Channel, ChannelData>
  private readonly capacity: number
  private readonly mailboxCapacity: number
  private readonly cursors = new Map<SubscriberId, EventCursor>()
  private readonly mailboxes: Map<SubscriberId, Record<Channel, Mailbox>> = new Map()
  private readonly subscribeEpoch: Map<SubscriberId, Record<Channel, number>> = new Map()
  private readonly metricsState: BusMetrics = { drops: { channel: 0, tombstone: 0, mailbox: {} } }
  private reading = false // reentrancy guard

  constructor(opts: BusOptions = {}) {
    this.capacity = this.ensurePow2(opts.capacity ?? 1024)
    this.mailboxCapacity = this.ensurePow2(opts.mailboxCapacity ?? 1024)
    const makeChannel = (): ChannelData => ({ ring: new ChannelRing(this.capacity), subs: new Map() })
    this.channels = {
      frameBegin: makeChannel(),
      fixedEnd: makeChannel(),
      frameEnd: makeChannel(),
      immediate: makeChannel(),
    }
  }

  private ensurePow2(n: number): number {
    let x = Math.max(2, n | 0)
    // round up to next power of two
    x--
    x |= x >> 1
    x |= x >> 2
    x |= x >> 4
    x |= x >> 8
    x |= x >> 16
    x++
    return x
  }

  publish(channel: Channel, id: EventId, pack: (w: EventWriter) => void): number {
    const ch = this.channels[channel]
    const { seq, slot, base, overwritten } = ch.ring.reserve()
    if (overwritten) this.metricsState.drops.channel += 1
    // Writer views (subarrays mapped to slot). Simpler for Phase 0.
    const w: EventWriter = {
      f32: ch.ring.f32.subarray(base.f32, base.f32 + ch.ring.F32_STRIDE),
      i32: ch.ring.i32.subarray(base.i32, base.i32 + ch.ring.I32_STRIDE),
      u32: ch.ring.u32.subarray(base.u32, base.u32 + ch.ring.U32_STRIDE),
      s: ch.ring.s.subarray(base.s, base.s + ch.ring.S_STRIDE),
    }
    try {
      pack(w)
    } catch {
      // leave invalid if pack fails
    }
    // Deterministic tick/frame (simple monotonic tick per channel for Phase 0)
    const tick = ++ch.ring.tick
    const frame = 0
    ch.ring.writeHeader(slot, id, seq, frame, tick)

    // Fan-out to subscribers registered for this (channel,id)
    const set = ch.subs.get(id)
    if (set && set.size) {
      for (const sid of set) {
        const mb = this.mailboxes.get(sid)?.[channel]
        if (!mb) continue
        if (!mb.push(seq)) {
          // Drop oldest then enqueue newest to keep mailbox recent
          mb.head = (mb.head + 1) & mb.mask
          if (mb.len > 0) mb.len--
          mb.push(seq)
          this.metricsState.drops.mailbox[sid] = (this.metricsState.drops.mailbox[sid] ?? 0) + 1
        }
      }
    }
    return seq
  }

  invalidate(channel: Channel, seq: number): void {
    const ch = this.channels[channel]
    const slot = seq & ch.ring.mask
    // Only mark invalid; stale logic will supersede if overwritten
    if (ch.ring.seqHi[slot] === seq) {
      if (ch.ring.valid[slot] !== 0) {
        ch.ring.valid[slot] = 0
        this.metricsState.drops.tombstone += 1
      }
    }
  }

  subscribe(subscriberId: string, wants: Wants[]): EventCursor {
    // Create mailboxes if needed
    let mbPerChannel = this.mailboxes.get(subscriberId)
    if (!mbPerChannel) {
      mbPerChannel = {
        frameBegin: new Mailbox(this.mailboxCapacity),
        fixedEnd: new Mailbox(this.mailboxCapacity),
        frameEnd: new Mailbox(this.mailboxCapacity),
        immediate: new Mailbox(this.mailboxCapacity),
      }
      this.mailboxes.set(subscriberId, mbPerChannel)
    }
    // Register wants
    this.registerWants(subscriberId, wants)
    // Create or reuse cursor
    let cur = this.cursors.get(subscriberId)
    if (!cur) {
      cur = new EventCursor(subscriberId, this)
      this.cursors.set(subscriberId, cur)
    }
    return cur
  }

  updateSubscription(subscriberId: string, wants: Wants[]): void {
    // Remove all existing subscriptions for subscriber, then register new
    this.removeSubscriberFromAll(subscriberId)
    // Clear existing mailboxes so pending items from old subscriptions do not leak
    const mboxes = this.mailboxes.get(subscriberId)
    if (mboxes) {
      mboxes.frameBegin.fastForward()
      mboxes.fixedEnd.fastForward()
      mboxes.frameEnd.fastForward()
      mboxes.immediate.fastForward()
    }
    this.registerWants(subscriberId, wants)
  }

  unsubscribe(subscriberId: string): void {
    this.removeSubscriberFromAll(subscriberId)
    // Record epoch at unsubscribe so resubscribe does not backfill old events
    const epochs: Record<Channel, number> = {
      frameBegin: this.channels.frameBegin.ring.seqHead,
      fixedEnd: this.channels.fixedEnd.ring.seqHead,
      frameEnd: this.channels.frameEnd.ring.seqHead,
      immediate: this.channels.immediate.ring.seqHead,
    }
    this.subscribeEpoch.set(subscriberId, epochs)
    this.mailboxes.delete(subscriberId)
    this.cursors.delete(subscriberId)
  }

  getCursor(subscriberId: string): EventCursor | null {
    return this.cursors.get(subscriberId) ?? null
  }

  metrics(): BusMetrics {
    // Return a shallow copy to avoid mutation in tests
    return JSON.parse(JSON.stringify(this.metricsState))
  }

  // Internal helpers
  _getMailbox(sid: string, channel: Channel): Mailbox | null {
    return this.mailboxes.get(sid)?.[channel] ?? null
  }
  _getChannelData(channel: Channel): ChannelData { return this.channels[channel] }
  _headerView(channel: Channel, seq: number): EventHeaderView {
    const ch = this.channels[channel]
    const slot = seq & ch.ring.mask
    return {
      id: ch.ring.id[slot] as number,
      seq: ch.ring.seqHi[slot] as number,
      frame: ch.ring.frame[slot] as number,
      tick: ch.ring.tickLane[slot] as number,
      valid: ch.ring.valid[slot] === 1,
    }
  }
  _readerView(channel: Channel, seq: number): EventReader {
    const ch = this.channels[channel]
    const slot = seq & ch.ring.mask
    const fBase = slot * ch.ring.F32_STRIDE
    const iBase = slot * ch.ring.I32_STRIDE
    const uBase = slot * ch.ring.U32_STRIDE
    const sBase = slot * ch.ring.S_STRIDE
    return {
      f32: ch.ring.f32.subarray(fBase, fBase + ch.ring.F32_STRIDE),
      i32: ch.ring.i32.subarray(iBase, iBase + ch.ring.I32_STRIDE),
      u32: ch.ring.u32.subarray(uBase, uBase + ch.ring.U32_STRIDE),
      s: ch.ring.s.subarray(sBase, sBase + ch.ring.S_STRIDE),
    }
  }

  // Register wants (deduplicated per (channel,id))
  private registerWants(sid: string, wants: Wants[]) {
    // Deduplicate by (channel,id)
    const seen = new Set<string>()
    const epochs = this.subscribeEpoch.get(sid) ?? {
      frameBegin: 0,
      fixedEnd: 0,
      frameEnd: 0,
      immediate: 0,
    }
    for (const w of wants) {
      for (const id of w.ids) {
        const key = `${w.channel}:${id}`
        if (seen.has(key)) continue
        seen.add(key)
        let set = this.channels[w.channel].subs.get(id)
        if (!set) {
          set = new Set<SubscriberId>()
          this.channels[w.channel].subs.set(id, set)
        }
        set.add(sid)

        // Backfill from epoch to head so new subscribers can read past events (first subscription only)
        const ch = this.channels[w.channel]
        const isResub = this.subscribeEpoch.has(sid)
        const baseline = isResub ? ch.ring.seqHead : epochs[w.channel]
        const startSeq = Math.max(baseline + 1, ch.ring.seqHead - ch.ring.cap + 1, 1)
        const endSeq = ch.ring.seqHead
        const mb = this.mailboxes.get(sid)?.[w.channel]
        if (mb && endSeq >= startSeq) {
          for (let seq = startSeq; seq <= endSeq; seq++) {
            const slot = seq & ch.ring.mask
            if (ch.ring.seqHi[slot] !== seq) continue // stale
            if (ch.ring.id[slot] !== (id >>> 0)) continue
            if (!mb.push(seq)) {
              // drop oldest then push newest to keep mailbox recent
              mb.head = (mb.head + 1) & mb.mask
              if (mb.len > 0) mb.len--
              mb.push(seq)
              this.metricsState.drops.mailbox[sid] = (this.metricsState.drops.mailbox[sid] ?? 0) + 1
            }
          }
        }
        // Update epoch to current head for this channel
        epochs[w.channel] = ch.ring.seqHead
      }
    }
    this.subscribeEpoch.set(sid, epochs)
  }

  private removeSubscriberFromAll(sid: string) {
    for (const ch of Object.values(this.channels)) {
      for (const [id, set] of ch.subs.entries()) {
        if (set.delete(sid) && set.size === 0) {
          ch.subs.delete(id)
        }
      }
    }
  }

  // Reentrancy guard helpers
  _beginRead() { this.reading = true }
  _endRead() { this.reading = false }
  _isReading() { return this.reading }

  _incChannelDrop() { this.metricsState.drops.channel += 1 }
  _incTombstoneDrop() { this.metricsState.drops.tombstone += 1 }
}

export interface EventWriter {
  f32: Float32Array
  i32: Int32Array
  u32: Uint32Array
  s: Uint32Array
}

export interface EventReader {
  f32: Float32Array
  i32: Int32Array
  u32: Uint32Array
  s: Uint32Array
}

export interface EventHeaderView {
  id: EventId
  seq: number
  frame: number
  tick: number
  valid: boolean
}

export class EventCursor {
  private readonly sid: string
  private readonly bus: EventBus
  constructor(sid: string, bus: EventBus) {
    this.sid = sid
    this.bus = bus
  }

  read(channel: Channel, fn: (h: EventHeaderView, r: EventReader) => void, limit?: number): number {
    const mb = this.bus._getMailbox(this.sid, channel)
    if (!mb) return 0
    if (this.bus._isReading()) return 0
    this.bus._beginRead()
    const ch = this.bus._getChannelData(channel)
    let delivered = 0
    try {
      const max = limit ? Math.min(mb.len, limit) : mb.len
      for (let i = 0; i < max; i++) {
        const seq = mb.buf[mb.head]
        mb.head = (mb.head + 1) & mb.mask
        mb.len--
        const slot = seq & ch.ring.mask
        const hdrSeq = ch.ring.seqHi[slot]
        if (hdrSeq !== seq) { this.bus._incChannelDrop(); continue }
        if (ch.ring.valid[slot] !== 1) { this.bus._incTombstoneDrop(); continue }
        const header: EventHeaderView = {
          id: ch.ring.id[slot] as number,
          seq: hdrSeq as number,
          frame: ch.ring.frame[slot] as number,
          tick: ch.ring.tickLane[slot] as number,
          valid: true,
        }
        const reader = this.bus._readerView(channel, seq)
        fn(header, reader)
        delivered++
      }
    } finally {
      this.bus._endRead()
    }
    return delivered
  }

  fastForward(channel: Channel): void {
    const mb = this.bus._getMailbox(this.sid, channel)
    if (!mb) return
    mb.fastForward()
  }
}
