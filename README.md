# FlushStar Quantum 25 — companion app demo

A working demo of the phone app, running against a **simulated** Quantum 25.
No hardware is involved. The point is to settle how the app should look and
behave before anyone spends money putting a radio in the machine.

Open it on a phone: https://anirudhatalmale6-alt.github.io/flushstar-quantum-app/

## What it does

- Finds and connects to the unit (simulated Bluetooth scan)
- System status, engines detected, supply voltage
- Three wash cycles — 5, 7 and 9 minutes — picked on the main screen
- Runs the cycle as FlushStar described it: pre-soak the motor, then flush for
  the chosen length while the water alternates between pulsating and continuous
  every 60 seconds. Engines in sequence, live pressure / flow / current, abort
  at any point. The water mode is shown while it runs, with a countdown to the
  next switch, and the gauges behave differently in each mode — pulsating
  swings the pressure about, continuous holds steady.
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

## Still to confirm with FlushStar

The cycle structure now follows what they sent:

> "a standard 5min 60sec flush between pulsating and continuous water flow.
> Or a 7min 60sec flush or 9min 60sec flush between the two."
> "All of those with pre soak the motor and have a continuous water flow /
> pulsating water flow for all the flushes."

Read as three programs of 5 / 7 / 9 minutes, each pre-soaking first, then
alternating water mode every 60 seconds. Four things that reading leaves open:

- **Pre-soak length.** 45 s is a placeholder; they did not give one.
- **Which mode the flush opens on.** Currently pulsating.
- **Whether the program time is the whole cycle or the time per engine.**
  Currently the whole cycle, shared between the engines in sequence.
- **Whether anything happens after the flush**, such as a drain. Nothing does
  at the moment, because they did not mention one — I would rather ask than
  invent a stage.

Also still open: the pressure, flow and current ranges, and which faults the
unit can actually detect and report.

## Porting to a real app

`Unit` at the top of `app.js` is the only place that pretends to be hardware.
It is deliberately the single seam between the interface and the device, so
swapping it for real Bluetooth does not mean rewriting the screens.

This is a web build so it can be opened from a link, with no install and no
app store review. The same screens port to a native iOS/Android app once the
hardware side is decided.
