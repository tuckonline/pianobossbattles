# MIDI subsystem

`normalizeMidi` translates channel voice bytes outside React. Note-on with velocity zero becomes note-off. Channel, velocity, timestamp, sustain CC64 and other control changes are retained. `MidiDeviceManager` handles discovery, selected-device preference, permission errors and hot-plug callbacks. Only the selected device emits into the shared event bus.

`MidiRecorder` subscribes during a recording, converts to relative milliseconds, retains up to 10,000 events, and closes held notes/pedal on stop. `trimRecording` restores held notes and controller state at the trim start and closes events at the trim end. Saved recordings are immutable; re-recording creates another record. Pairing keys include channel and pitch and use FIFO for repeated same-pitch events.

`MidiSimulator` emits the same canonical events as devices. Its deterministic sequence function generates note durations, chords, scales or arbitrary sequences supplied by tests. The accessible on-screen keyboard emits note events on pointer/Space/Enter down/up. The pedal checkbox emits CC64.

## Physical test

Use Chrome or Edge on HTTPS (localhost also qualifies). Attach a USB MIDI keyboard, open Settings → Connect keyboard, allow permission, select a device, play notes and sustain, and verify pitch, velocity and channel activity. In a MIDI block, start recording, play, stop, inspect timing/velocity, replay and save. Disconnect/reconnect and verify device status recovery. A hardware test has not been performed by this automated build.

Device preference is the only authoritative localStorage usage. Courses, recordings, performances and progress live in the database. Web MIDI is not supported by every mobile browser; the simulator remains available.
