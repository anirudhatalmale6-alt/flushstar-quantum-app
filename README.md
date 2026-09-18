# FlushStar Quantum 25 — companion app demo

A working demo of the phone app, running against a **simulated** Quantum 25.
No hardware is involved. The point is to settle how the app should look and
behave before anyone spends money putting a radio in the machine.

Open it on a phone: https://anirudhatalmale6-alt.github.io/flushstar-quantum-app/

## What it does

- Finds and connects to the unit (simulated Bluetooth scan)
- System status, engines detected, supply voltage
- Runs a flush cycle: purge → flush → drain, engines in sequence, live
  pressure / flow / current, abort at any point
- Handles failures: a blocked engine mid-cycle, and no water supply caught
  before anything opens
- Flush history with duration, engine count and outcome
- Service-due reminder
- System page with serial, firmware, cycles and runtime

## Demo controls

On the Settings tab. Not part of the real app — they let you show the
behaviour without a machine in front of you: engine count (1/2/4/6), what the
next cycle does, whether a service reminder is showing, and cycle speed.

Leave speed on **Fast** when showing someone. A real cycle is 4 min 10 s with
the engines running one after another, so a fault on engine 4 takes two
minutes to appear — fine on a boat, useless in a meeting.

## Before any of this is presented as accurate

The numbers are plausible placeholders and need checking against the real unit:

- Stage lengths (45 s purge / 150 s flush / 55 s drain)
- Whether engines really are flushed in sequence rather than together
- Pressure, flow and current ranges
- What the unit can actually report, and what faults it can detect

## Porting to a real app

`Unit` at the top of `app.js` is the only place that pretends to be hardware.
It is deliberately the single seam between the interface and the device, so
swapping it for real Bluetooth does not mean rewriting the screens.

This is a web build so it can be opened from a link, with no install and no
app store review. The same screens port to a native iOS/Android app once the
hardware side is decided.
