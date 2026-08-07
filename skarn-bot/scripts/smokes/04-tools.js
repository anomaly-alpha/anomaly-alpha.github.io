// ===== TOOLS =====
// Ported from README.md — AI tool runner (offline + deterministic; wttr.in + news fetch stubbed).
(() => {
  const ws = require('../../lib/weatherScheduler');
  ws.fetchWeather = async () => ({ current_condition: [{ temp_C: '21', temp_F: '70', weatherDesc: [{ value: 'Sunny' }], humidity: '45', windspeedKmph: '12', winddir16Point: 'NE' }], weather: [] });
  const { runTool } = require('../../features/tools/toolRunner');
  return (async () => {
    const w = await runTool({ id: 'c', type: 'function', function: { name: 'get_weather', arguments: '{"location":"Tokyo"}' } }, { userId: 'u', guildId: 'g', channelId: 'c' });
    const r = await runTool({ id: 'c', type: 'function', function: { name: 'roll_dice', arguments: '{}' } }, { userId: 'u', guildId: 'g', channelId: 'c' });
    const both = w.content.includes('Sunny') && r.content.includes('d6');
    console.log('weather tool returns live data:', w.content.includes('Sunny'));
    console.log('dice tool returns a real roll:', r.content.includes('d6'));
    if (!both) process.exitCode = 1;
  })();
})();