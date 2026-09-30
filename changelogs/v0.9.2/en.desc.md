# v0.9.2 — No false “Something went wrong”

On devices without WebGL the app showed a “Something went wrong” error on every launch. It no longer does.

## Fixed

- **No false error at launch without WebGL.** On phones and computers without WebGL (stripped-down or old built-in browsers, emulators) the stars-and-coins effect could not start, and “Something went wrong” popped up on every launch. Now the effect is simply off there, and everything else works as usual. The same goes for the wave on audio posts in the player.
