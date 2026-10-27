# Long listing description — en-US

Same notes as the pt-BR file: the ATN description field accepts a small HTML subset
(`<b>`, `<i>`, `<ul>`, `<li>`, `<a href>`, `<br>`, `<blockquote>`) and ignores Markdown.
Plain text with `•` bullets is safe everywhere.

**Before pasting:** confirm that `https://github.com/SergioVago/theunfound-theme` already exists
and is public (the repository has not been created yet).

**Trademark:** this text carries **one** nominative mention of Spark Mail, attributed to
Readdle and followed by a disclaimer — nominative use in long-form text, the same thing
the "Monterail ... inspired by" themes do on ATN today. Do not add more; the summary
(file 02) and the add-on's own UI mention no third-party trademark.

---

```
theUnfound Theme gives Thunderbird the look of a modern mail app — a graphite dark
sidebar, a card-style message list with avatars and preview lines, a clean reading pane —
without changing a single feature of the program. The look recreates in Thunderbird that
of Spark Mail (Spark Desktop 3, by Readdle); this add-on is an independent project, it is
not made, sponsored or endorsed by Readdle, and it does not connect to any Readdle
service.

It is appearance only. No Thunderbird feature is removed, no message is modified, and
everything returns to normal when you disable or remove the add-on — no restart needed.


WHAT CHANGES

• Dark sidebar: the spaces toolbar and the folder pane become one continuous graphite
  column, with the selected folder in a solid blue pill and its unread count inside.
  A light sidebar is still available in the options.
• Account rail: a button at the top of the folder pane collapses the pane into a narrow
  rail showing only each account's photo and its Inbox unread count; one click opens
  that account's Inbox. The photo comes from your address book, from a file you pick in
  the options, or falls back to initials.
• Message list (Thunderbird's cards view): round avatar with coloured initials — or the
  contact's photo, if they are in your address book; sender in bold, date in grey on the
  right, subject and a one-line preview; unread messages get a blue dot; rounded
  light-blue selection; the star and the "⋮" menu appear on hover.
• Smart sender name: just the name for people in your address book, name + domain for
  strangers, and an amber warning when the receiving server failed the message on
  DMARC/SPF. You can switch to "always name and address" or "name only" in the options.
• Reading pane: large subject at the top, sender avatar, icon-only actions, rounded
  attachment bar and more breathing room around the text.
• Borderless top bar with a rounded search field in the centre; tabs, status bar,
  stand-alone message window and compose window follow the same palette.
• Light, dark or automatic (follows your Thunderbird/system theme).


WHAT IT DOES NOT DO

• It sends nothing anywhere. No network requests, no telemetry, no server: there is not
  a single network call in the code.
• It does not read, copy or alter the content of your messages. The preview line is the
  snippet Thunderbird already stores in its own local message index.
• It does not touch accounts, passwords, filters, folders or any mail configuration.
• It does not remove or disable any Thunderbird feature. Everything the program does is
  still there — it just looks different.
• It installs no fonts, downloads no external resources and bundles no third-party code.


ONE SETTING IT MAY CHANGE (ONLY IF YOU ASK)

The design targets Thunderbird's three-line cards view and its three-column layout. The
options page has a "Use cards and 3 columns" button; only when you click it does the
add-on change three Thunderbird preferences (mail.threadpane.listview,
mail.pane_config.dynamic and mail.threadpane.cardsview.rowcount). Nothing is changed on
its own, and Thunderbird's own View menu takes you back any time. The rail's
collapsed/expanded state is stored with the rest of the window layout.


PRIVACY

To show the sender's photo and name, the add-on looks the address up in your local
Thunderbird address book. For the suspicious-sender badge, it reads the open message's
Authentication-Results header. Your options (and any per-account photo you pick) live in
the extension's local storage, inside your profile. None of it leaves your machine:
there is no server, no account to create, no telemetry.


COMPATIBILITY — PLEASE READ FIRST

The add-on uses an Experiment API, the only way to style Thunderbird's own windows. That
comes at a price: Thunderbird requires a declared maximum version, and newer Thunderbird
releases can change the interface internally. This version declares support for
Thunderbird 140 to 158. When 159 ships, the add-on will need an update — so if the look
disappears after a Thunderbird upgrade, that is why, and not a broken profile.


SOURCE CODE AND SUPPORT

Open source under the Mozilla Public License 2.0 — the same licence as Thunderbird:
https://github.com/SergioVago/theunfound-theme

Bugs, ideas and screenshots: open an issue on GitHub, or write to
sergio@theunfound.com.br.

theUnfound Theme is an independent project. "Spark" and "Spark Mail" are trademarks of
Readdle, mentioned here only to describe the visual reference; there is no affiliation,
sponsorship or endorsement. "Thunderbird" is a trademark of MZLA Technologies
Corporation.
```
