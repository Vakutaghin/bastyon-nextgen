# v0.13.2 — Chats on the phone without a false “no connection”

On the phone, chats could fail to load with “no connection to the chat server” while everything worked on a computer. Now the phone reaches the chat server the same way a computer does. If your computer has 0.9.4 or newer, the “Update” button installs this version (except the .deb package). On the phone, “Update” works from 0.12.0 too; from an earlier version, install this one by hand.

## Phone

- **No “no connection to the chat server” while there is a connection.** On the phone the app runs inside Android’s built-in browser. That browser drops some of the chat server’s answers, such as an overloaded server’s error, and reports them as a lost connection. Because of that, chats could fail to load at all. Now requests to the chat server bypass the built-in browser, as on a computer. Pictures, videos and files in chats load as before.
- **A more precise reason.** If the server answers with an error, the “Sync error” bar shows its code. If the connection really is lost, the small note under the bar names the cause, for example “UnknownHostException” when the phone could not find the server’s address. If the server stays silent for too long, the bar says “the chat server did not answer in time”.
- Nothing changes on a computer.
