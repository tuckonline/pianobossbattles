# Live OBS score transport

The existing `/obs/score` URL now pairs automatically with the active practice
page. No OBS plugin, new server, source URL, camera/microphone permission, or
manual pairing code is required. Refresh both pages after updating.

## Integration

- `useOverlayPublisher` in `hosted/obs.tsx` publishes after committed score/game
  changes, coalescing only updates within the same event-loop turn. It reuses the
  existing evaluator and never subscribes to MIDI independently.
- `hosted/obs-direct.ts` negotiates a WebRTC data channel between the practice
  browser and the OBS browser. It sends complete presentation snapshots (score
  cursor, note feedback, battle HP), independently of HTTP write completion.
  There are no public STUN/TURN services; direct connections target the same
  computer or reachable local network. Restricted/unsupported environments use
  the cloud fallback automatically.
- Unordered delivery with no retransmission prevents an old packet holding up
  new feedback. Sequence checks discard late/duplicate frames. The publisher
  keeps only the newest pending snapshot and uses a bounded transport buffer;
  a half-second repeat recovers a dropped final packet. Frames above 60KB use
  HTTP rather than overfilling the peer channel. Failed connections retry.
- `hosted/obs-signaling.ts` uses the existing authenticated `/api/obs` endpoint
  only for handshake messages. Both sides must belong to the same signed-in
  account and current source ID. POSTs retain the existing Origin check. SDP
  payloads are bounded; negotiations expire after 60 seconds and storage is
  bounded to eight rows per account. No progression data is written here.
- Migration `0021_obs_direct_score.sql` adds this temporary handshake table and
  index. Existing XP, achievements, attempts, and saved preferences are intact.
- The existing serialized HTTP publisher, SSE, and HTTP polling remain active.
  `/api/obs?score=1` reads just the score snapshot every 100ms, without querying
  personal bests or XP on each tick. Other overlays retain their statistics.
  Connections rotate after 40 score reads to bound Worker subrequests.
- Cloud snapshots carry source ID/sequence as well. `OverlayReceiver` prevents
  older cloud responses from replacing newer direct score frames. Durable
  player totals and records are accepted only from the server. Unchanged
  heartbeats retain score references, avoiding repeated notation feedback work.

The current transport is exposed as `data-score-transport` on the score's main
element for diagnostics, with no visible controls added to the OBS view.

## Verification

Unit tests cover sequence/source validation, duplicate/stale frames, stable
score references, rejecting peer-supplied persistent records, account isolation,
source ownership, negotiation expiry, and bounded storage.

The browser test uses separate Chromium processes (no shared browser storage or
BroadcastChannel). It delays cloud writes by 900ms while measuring MIDI-to-note
paint latency, checks rapid chord bursts, battle HP, SVG reuse, overlay reload,
and exercise changes. A separate test disables WebRTC and SSE, verifies HTTP
fallback, and reconnects after the practice browser goes offline. Existing OBS,
boss, and streak overlays are regression checked. Local timing is a diagnostic,
not a guarantee for every network, machine, or OBS browser build.

Release verification: 44 targeted unit/integration tests and eight browser
scenarios passed, plus type checking and production build. Measured direct
MIDI-to-paint samples were 11–38ms locally with 900ms cloud-write delays. The
existing banner regression test was updated for its current Live banner label,
full-width layout, and isolated test-account email.

WebRTC API references: [data channel delivery options](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel)
and [data channel behavior and size considerations](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels).
