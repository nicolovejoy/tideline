# Pinch to zoom and drag to pan the panels (issue 8)

Design, 2026-10-29. What is left of issue 8 after the span buttons (Day, 3 days, Week) and the dew point and feels-like. The owner asked to go straight to building ("keep rolling sdd"), so every choice here is the writer's call, marked "call", for him to check in the pull request.

## Intent

The span buttons give three fixed windows that start at midnight of the chosen day. To look at an afternoon's wind closely, or at the evening across two days, the user has to take what the buttons give. Pinching the panels, as a map is pinched, lets the user choose the window directly: spread two fingers to see a few hours, close them to see days, and move both sideways to slide the window along.

## Goals

- Two fingers on the panels change the window the panels draw: the instants under the two fingers stay under them as they move, so spreading zooms in about the fingers, closing zooms out, and moving both sideways pans. All at once, as a map does.
- On a Mac: a trackpad pinch zooms about the pointer, and a sideways two-finger swipe (a horizontal wheel) pans. A mouse wheel turning up or down still scrolls the page.
- From the keyboard, on the panels (they are a slider already): `+` (or `=`) zooms in and `-` zooms out, about the cursor, by a factor of 2.
- One finger keeps doing what it does today: a tap or a sideways drag moves the cursor, a swipe up or down scrolls the page.

## Non-goals

- No momentum after the fingers lift, no double-tap to zoom, no zoom on the month view.
- No window longer than a week or past the 14 days.
- No address or reload memory for a zoomed window.

## How it behaves

### The window

- A zoomed window is any span of time from 3 hours to 7 days long, inside the 14 days (from the first day's start to the last day's end) (call: 3 hours is about where the hourly staircases stop telling more; 7 days matches Week and the arrow thinning).
- A pinch that would go shorter or longer stops at the limit, keeping the instant under the fingers' midpoint where it is. A pan that would go past either end of the 14 days stops at it.
- The vertical range of each panel is worked out from the values in the window, as it is today, so it rescales as the window changes (call).
- The cursor keeps its instant while it is in the window, and is held to the window's edge when it falls outside, as a pick is today. A pinch never moves the cursor itself.

### How it sits with the buttons and the days

- While the window is zoomed, none of the span buttons is checked. Tapping any of them puts the window back to that span from the chosen day (call: no separate "reset" control).
- Choosing a day in the list, choosing a spot, or opening the month view puts the window back to the span from the chosen day, as each already resets the cursor.
- The chosen day does not follow a pan (call: the high/low table under the panels and the day list's highlight stay on the day the user chose). The heading says the days the window covers, as it does today: "Thu Oct 29", or "Thu Oct 29 to Sat Oct 31".
- The zoomed window is not kept for a reload; the span choice still is.

### The labels and the lines

- The labels under the stack follow the window's length: every hour up to 6 hours, every 3 hours up to 12, every 6 up to 1½ days (the hours as today, "12a", "6a", "12p", "6p" and for a finer step "3a", "9p" and so on), every 12 up to 4 days and every 24 beyond. A midnight's label is its weekday wherever the window covers more than one calendar day, otherwise "12a" (call).
- The sunset and moonrise lines carry their names where the window is one day long or shorter, and lose them beyond, as today.
- The cursor's words carry the weekday where the window covers more than one calendar day, as today.

### Page zoom

The panels stop letting the browser zoom the page with a pinch, since the pinch is now theirs (`touch-action: pan-y` on the stack, where it is `pan-y pinch-zoom` today). A pinch anywhere else on the page still zooms the page. (iOS honours `touch-action` for a pinch since iOS 13. If the phone check shows it does not on the home-screen app, the fallback is a non-passive `touchmove` listener that calls `preventDefault` while two fingers are down.)

### Help

The "?" sheet's section for the panels gains one sentence: "Pinch the panels to see more or less time, and move two fingers sideways to slide along. The Day, 3 days and Week buttons put it back." (words in `src/ui/helpText.ts`).

## Where it lives

- `src/chart/zoom.ts` (new, plain, tested): the arithmetic. The window from two fingers' start and current positions (a two-point fit of the linear time scale), zooming about an instant by a factor, panning by a time, and holding a window to the limits and the 14 days.
- `src/chart/gesture.ts`: a second finger starts a pinch rather than only abandoning the one-finger press; the pinch's state (the two pointers and the window when it began) is followed there as a plain function, as the press is.
- `src/chart/PanelStack.tsx`: applies it to pointer, wheel and Safari's `gesturechange` events, and the keys; reports a new window with a new `onWindow` prop, given `bounds` (the 14 days).
- `src/ui/spanView.ts`: a window from a zoom (`DayWindow` whose `first` and `last` are the days it touches), the labels for any length, and when the markers keep their names.
- `src/ui/selection.ts`: `selectedDay` takes the zoom.
- `src/ui/SpotScreen.tsx` and `src/ui/SpanControl.tsx`: the zoom state, the resets, no button checked while zoomed.

## Checks

The arithmetic and the labels are tested in Vitest. The gestures are checked in a headless browser (a trackpad pinch is a wheel event with `ctrlKey`, and two touch pointers can be sent through the DevTools protocol), and the owner checks on his iPhone on production after the merge:

1. On https://tideline.ibuild4you.com, Campus Point, spread two fingers on the tide panel. Pass: the panels show fewer hours, the labels under them get finer, the page itself does not zoom.
2. Move both fingers sideways. Pass: the panels slide along in time, and stop at the end of the 14 days.
3. Pinch closed as far as it goes. Pass: it stops at a week. Tap "Day". Pass: back to the chosen day, "Day" checked.
4. One finger: tap, drag sideways, swipe up. Pass: as before (cursor moves, cursor follows, page scrolls).
