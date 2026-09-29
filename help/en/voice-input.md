---
keywords: [voice input, dictation, speech recognition, microphone, Whisper, punctuation]
---

# Voice input

How to dictate the text of a post or a message: recognition runs on your computer, and the recording is not sent anywhere.

## How to dictate

1. Put the cursor in the text field of a post or a chat message.
2. Click the button with bars next to the smiley — **“Voice input”** — and speak.
3. The text appears at the cursor phrase by phrase, a second or two after you finish speaking.
4. To stop — the same button or the Esc key: **“Stop dictation (Esc)”**.

Dictated text can be undone like normal typing: Ctrl+Z, on a Mac Cmd+Z.

## First launch: the recognition model

Recognition needs a model, which is downloaded once. The first time you click, the app offers a choice:

| Model | Size | What it is like |
|---|---|---|
| **“Fast”** | about 60 MB | answers faster but makes more mistakes |
| **“Accurate”** | about 190 MB | understands speech well and adds punctuation itself, recommended |
| **“Best”** | about 575 MB | the best quality, but noticeably slower on a computer without a powerful graphics card |

The model is downloaded from Hugging Face, and the app checks that the file has not been swapped. If [Tor](tor.md) is on, the model downloads through Tor — this can take a few minutes.

## Punctuation by voice

Punctuation can be dictated with words: "period", "comma", "question mark", "exclamation mark", "colon", "ellipsis", "new line", "new paragraph", "open parenthesis" and "close parenthesis", "open quote" and "close quote". There are commands for every interface language; the full list is in the settings, under **“Voice commands for punctuation”**.

## Speech language

In a post the app recognizes speech in the post's language — it is chosen in the [post settings](post-settings.md). In a chat — in the interface language.

## Settings

**“Settings”** → the **“General”** tab → **“Voice input”**: which model is downloaded; you can download another one or remove an unneeded one to free up space.

## Where it works

- Only in the desktop app: Windows, macOS and Linux.
- Intel and AMD processors need AVX2 support — processors made since about 2013 have it. On older ones the app says that voice input is not available. On a Mac with Apple Silicon there are no restrictions.
- The app needs access to the microphone. On macOS the system asks for it; if you refused, allow it in System Settings → Privacy & Security → Microphone.

## See also

- [The post editor](post-composer.md)
- [Messages](messages.md)
- [Privacy: what others can see](privacy.md)
