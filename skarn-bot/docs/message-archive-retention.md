# Message Archive Retention

Skarn can retain message activity for one explicitly configured Discord guild using the Railway variable SKARN_MESSAGE_RETENTION_GUILD_ID. When configured, the bot records human-authored message text, author ID, channel ID, and Discord timestamp for messages it receives in that guild. Other guilds are not archived by this feature.

The archive begins at deployment and does not backfill earlier Discord history. It appends a create event, an edit event containing before-and-after text, and a delete event containing the last message text when available. Each event expires 30 days after its event timestamp. A startup cleanup and a five-minute cleanup interval remove expired events.

This policy applies to the new message archive only. It does not shorten existing Skarn conversation history or remove copies already posted to a configured Discord log channel. Message bodies are stored in the Railway-mounted SQLite database.
