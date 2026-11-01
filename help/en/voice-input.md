---
keywords: [voice input, dictation, speech recognition, microphone, Whisper, punctuation]
---

# Voice input

How to dictate the text of a post or a message: recognition runs right on your computer or phone, and the recording is not sent anywhere.

## How to dictate

1. Put the cursor in the text field of a post or a chat message.
2. Click the button with bars next to the smiley — **“Voice input”** — and speak.
3. Words appear at the cursor as you speak, like on a phone keyboard, without a period at the end yet. When you finish a phrase, the app recognizes it as a whole and puts the final text in its place — more accurate and with punctuation. A long text scrolls by itself, so the last line stays visible.
4. To stop — the same button or the Esc key: **“Stop dictation (Esc)”**. On a phone, the same button. The microphone turns off at once, and the app finishes the last phrase by itself in a second or two; press the button meanwhile and a new recording starts as soon as that phrase is in. If no new word is recognized for 10 seconds, dictation turns itself off. Noise, music and talk nearby don’t keep it on: only words count.
5. When you send the message or publish the post, dictation turns off. What you see in the field is what gets sent; to keep dictating, press the button again.

The last dictated phrase can be undone like normal typing: Ctrl+Z, on a Mac Cmd+Z.

## First launch: the recognition model

Recognition needs a model, which is downloaded once. The first time you click, the app offers a choice:

| Model          | Size         | What it is like                                                                                                  |
| -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| **“Fast”**     | about 80 MB  | answers faster but makes more mistakes                                                                           |
| **“Accurate”** | about 260 MB | understands speech well and adds punctuation itself, recommended                                                 |
| **“Best”**     | about 575 MB | the best quality, but noticeably slower on a computer without a powerful graphics card; not available on a phone |

The more accurate the model, the slower it recognizes speech, so words appear in the field with a delay. This is most noticeable on phones. The note under the list of models says the same.

The model is downloaded from Hugging Face, and the app checks that the file has not been swapped. If [Tor](tor.md) is on, the model downloads through Tor — this can take a few minutes.

The recognition engine is built into the app and updates with it. If a new version of the app needs a different model file, on a computer it downloads by itself and the old one is removed once the new one is in place; you can keep dictating while it downloads. “Fast” and “Accurate” now come in a format that runs noticeably faster on a processor (especially the drafts while you speak). On a phone, the model downloaded earlier keeps working, and a **“Speed up”** button appears next to it in the settings — it downloads the new file in place of the old one.

## Punctuation by voice

Punctuation can be dictated with words: "period", "comma", "question mark", "exclamation mark", "colon", "ellipsis", "new line", "new paragraph", "open parenthesis" and "close parenthesis", "open quote" and "close quote". There are commands for every interface language; the full list is in the settings, under **“Voice commands for punctuation”**.

## Speech language

In a post the app recognizes speech in the post's language — it is chosen in the [post settings](post-settings.md). In a chat — in the interface language.

## Settings

**“Settings”** → the **“Modules”** tab → **“Voice input”**: which model is downloaded; you can download another one or remove an unneeded one to free up space.

## Where it works

- In the desktop app — Windows, macOS and Linux — and in the Android app.
- A phone needs a 64-bit processor, which nearly all phones of recent years have. On 32-bit ones the app says that voice input is not available. A phone recognizes more slowly than a computer: with the **“Accurate”** model words appear less often as you speak, and after a long phrase new words pause briefly while the whole phrase is recognized. If that is too long, choose **“Fast”**.
- Intel and AMD processors need AVX2 support — processors made since about 2013 have it. On older ones the app says that voice input is not available. On a Mac with Apple Silicon there are no restrictions.
- The app needs access to the microphone. On macOS the system asks for it; if you refused, allow it in System Settings → Privacy & Security → Microphone. On Windows access is turned on in Settings → Privacy & security → Microphone: both “Microphone access” and “Let desktop apps access your microphone” are needed. A phone asks for permission the first time you dictate; if you refused, allow the microphone for the app in the phone settings. If there is no access, the app says so, and clicking that message opens the right settings.

## If it did not work

Under the message **“Voice input did not work. Try again.”** the app shows the error details. If you report the problem, send them together with the app version.

## See also

- [The post editor](post-composer.md)
- [Messages](messages.md)
- [Privacy: what others can see](privacy.md)
