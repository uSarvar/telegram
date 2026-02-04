🤖 Antitakror Telegram Bot

Antitakror is a Telegram bot that detects duplicate IDs inside Telegram group topics (threads).
It helps keep ID-based discussions clean and organized.

✨ Features

Works in Telegram groups & supergroups

Topic-based duplicate checking

Detects duplicate IDs in real time

Supports valid ID formats:

K123, K-123

k123, k-123

Accepts 3 or 4 digit IDs

Sends a reply alert when a duplicate is found

Includes links to:

first message

duplicate message

Mentions an admin in alerts

Shows warnings for incorrect ID formats

🧠 ID Rules
Input	Result
K123	✅ Valid
k-1234	✅ Valid
К123	⚠️ Warning (Cyrillic letter)
A123	❌ Invalid
123	❌ Invalid
K12	❌ Invalid
K12345	❌ Invalid
⚙️ Environment Variables
BOT_TOKEN=your_telegram_bot_token
ADMIN_ID=your_telegram_user_id

🚀 Deployment

Runs on Node.js

Uses long polling (no webhook needed)

Can be deployed on Railway, Render, Fly.io, or any Node.js hosting

⚠️ Notes

IDs are stored in memory (reset on restart)

Only new messages are checked

Private chats and channels are ignored

📄 License

Free to use and modify for your needs.
