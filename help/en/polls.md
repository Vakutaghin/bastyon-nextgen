---
keywords: [poll, voting, answer options, vote, results]
---

# Polls

How to add a poll to a post, vote and see the results.

## Creating a poll

1. In the new post window, click **“Poll”**.
2. Write the **“Poll question”** and the answer options — from two to five. **“Add option”** adds a line, the cross next to a line is **“Remove option”**.
3. Add a tag and publish the post as usual. Post text is optional for a poll.

A poll cannot be added to an article or a repost. After publishing it does not change: editing the post shows no poll editor, and the poll itself stays as it was — the votes are tied to the options.

## Voting

Click an answer option. Only signed-in users can vote: a guest gets the hint **“Sign in to vote”**.

A vote in a poll is a special comment on the post, so:

- the network confirms it: until then the poll says **“Vote sent, waiting for the network to confirm it”**;
- it counts towards the daily comment limit — see [Account status and limits](limits.md);
- one account has one vote, and you cannot change it. If a vote is not confirmed within 30 minutes, you can vote again.

## Results

Percentages and the number of votes appear after you vote. A guest sees the results right away. If nobody has answered yet, it says **“No votes yet”**.

Votes are not shown in the discussion under the post and do not count towards the number of comments.

<details>
<summary>How it works</summary>

- The Bastyon protocol has no separate voting. A poll is stored in the post settings, and a vote is a comment with the option number in a service field and the text "🗳 option".
- The previous Bastyon app does not show the poll and sees the votes as ordinary "🗳 option" comments.
- Polls created in the previous app, and in this one before version 0.7.0, were not saved: the node dropped the field they were in.

</details>

## See also

- [The post editor](post-composer.md)
- [Comments](comments.md)
- [Account status and limits](limits.md)
