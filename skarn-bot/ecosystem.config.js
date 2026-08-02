module.exports = {
  apps: [
    {
      name: 'skarn-bot',
      script: 'bot.js',
      cwd: __dirname,
      max_restarts: 10,
      restart_delay: 5000,
      autorestart: true,
      time: true,
    },
    {
      name: 'skarn-rpc',
      script: 'rich-presence.js',
      cwd: __dirname,
      max_restarts: 5,
      restart_delay: 10000,
      autorestart: true,
      time: true,
    },
  ],
};
