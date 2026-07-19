const { addKnowledgeBase, getAppState, setAppState } = require('../../db/database');
const fetch = require('node-fetch');

const FALLBACK_TOPICS = [
  // ===== Science (18) =====
  { topic: 'quantum physics', summary: 'Study of matter and energy at atomic scale. Superposition, entanglement, wave-particle duality.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'black holes', summary: 'Region of spacetime where gravity prevents escape. Formed when massive stars collapse.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'evolution', summary: 'Species change over generations via natural selection. Proposed by Charles Darwin.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'dna', summary: 'Molecule containing genetic instructions. Double helix structure discovered in 1953.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'photosynthesis', summary: 'Plants convert sunlight into chemical energy. Uses chlorophyll, produces oxygen as byproduct.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'relativity', summary: "Einstein's theory describing space-time curvature and E=mc\u00b2. Special and general relativity.", source: 'wikipedia', confidence: 0.9 },
  { topic: 'periodic table', summary: 'Organizes chemical elements by atomic number. 118 confirmed elements arranged in groups and periods.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'cell biology', summary: 'Study of cells as the basic unit of life. Includes mitochondria, nucleus, and DNA.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'gravity', summary: 'Fundamental force attracting mass toward mass. Governs planetary orbits and falling objects.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'electromagnetism', summary: 'Force between electrically charged particles. Light is a form of electromagnetic radiation.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'thermodynamics', summary: 'Laws governing heat, energy, and entropy. Entropy in an isolated system always increases.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'plate tectonics', summary: "Earth's crust divided into moving plates. Drives earthquakes, volcanic activity, and mountain building.", source: 'wikipedia', confidence: 0.9 },
  { topic: 'atoms', summary: 'Basic unit of matter consisting of a nucleus of protons and neutrons orbited by electrons.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'climate change', summary: 'Long-term shift in global temperatures and weather patterns driven by greenhouse gas emissions.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'vaccines', summary: 'Biological preparations that train the immune system to fight specific diseases using weakened or inactive pathogens.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'nuclear fusion', summary: 'Reaction where two atomic nuclei combine to form a heavier nucleus, releasing enormous energy.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'microbiology', summary: 'Study of microscopic organisms including bacteria, viruses, fungi, and protists.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'neuroscience', summary: 'Scientific study of the nervous system, including brain function, neural circuits, and behavior.', source: 'wikipedia', confidence: 0.9 },

  // ===== Technology (18) =====
  { topic: 'artificial intelligence', summary: 'Machines that mimic human cognition. Includes machine learning, neural networks, and natural language processing.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'machine learning', summary: 'AI subset where systems learn patterns from data using neural networks, decision trees, and statistical models.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'blockchain', summary: 'Decentralized distributed ledger technology where each block contains cryptographically linked transactions.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'internet', summary: 'Global network of interconnected computers communicating via TCP/IP. Originated as ARPANET in 1969.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'neural networks', summary: 'Computing systems inspired by biological brains. Composed of layers of interconnected nodes with weighted connections.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'cryptography', summary: 'Practice of secure communication through encryption and decryption. Uses public and private key systems.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'quantum computing', summary: 'Computing using qubits that can exist in superpositions of 0 and 1. Solves certain problems exponentially faster than classical computers.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'robotics', summary: 'Design, construction, and operation of robots. Combines mechanical engineering, electrical engineering, and software.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'programming', summary: 'Writing instructions that computers execute. Common languages include Python, JavaScript, C++, and Rust.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'encryption', summary: 'Encoding data so only authorized parties can access it. Standards include AES for symmetric and RSA for asymmetric encryption.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'database', summary: 'Structured collection of data with efficient retrieval mechanisms. Includes SQL and NoSQL types with ACID properties.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'operating system', summary: 'System software managing hardware resources and running applications. Examples include Windows, Linux, macOS, and Android.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'cloud computing', summary: 'On-demand delivery of computing resources over the internet. Major providers include AWS, Azure, and GCP.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'cybersecurity', summary: 'Practice of protecting systems, networks, and data from digital attacks using firewalls, encryption, and authentication.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'algorithms', summary: 'Step-by-step procedures for solving problems. Essential to programming, sorting, searching, and data processing.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'virtualization', summary: 'Creating virtual versions of computing resources such as servers, storage, and networks, enabling efficient resource utilization.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'web development', summary: 'Building and maintaining websites and web applications. Involves frontend, backend, and database technologies.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'devops', summary: 'Practices combining software development and IT operations to shorten development cycles and deliver continuous deployment.', source: 'wikipedia', confidence: 0.9 },

  // ===== History (15) =====
  { topic: 'world war ii', summary: 'Global war from 1939 to 1945 between Allies and Axis powers. Resulted in 70-85 million casualties and ended with atomic bombs.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'ancient rome', summary: 'Civilization that began as a kingdom in 753 BC, became a republic, then an empire. Fell in 476 AD. Latin language origins.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'industrial revolution', summary: 'Period from 1760 to 1840 marked by the shift from手工生产 to machine manufacturing. Steam engine, factories, and urbanization.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'space race', summary: 'Cold War competition between the US and Soviet Union from 1955 to 1975. First satellite, first human in space, and Apollo moon landing.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'ancient egypt', summary: 'Civilization along the Nile River lasting over 3,000 years. Known for pharaohs, pyramids, hieroglyphs, and advanced mathematics.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'cold war', summary: 'Geopolitical tension between the United States and Soviet Union from 1947 to 1991. Nuclear arms race, proxy wars, and space competition.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'french revolution', summary: 'Period of radical social and political upheaval in France from 1789 to 1799. Overthrew the monarchy and established a republic.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'ancient greece', summary: 'Civilization from the 8th century BC to 146 BC. Birthplace of democracy, philosophy, and the Olympic Games.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'mongol empire', summary: 'Largest contiguous land empire in history, founded by Genghis Khan in 1206. Stretched from Eastern Europe to East Asia.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'american revolution', summary: 'Colonial revolt from 1765 to 1783. Thirteen colonies gained independence from Britain, forming the United States of America.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'world war i', summary: 'Global war from 1914 to 1918 centered in Europe. Caused by alliances, imperialism, and the assassination of Archduke Franz Ferdinand. 20M casualties.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'byzantine empire', summary: 'Eastern Roman Empire that continued after the fall of the West. Capital at Constantinople. Lasted from 330 to 1453 AD.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'age of exploration', summary: 'Period from the 15th to 17th centuries when European powers explored, colonized, and traded across the globe.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'medieval europe', summary: 'Period from the 5th to the late 15th century. Feudalism, castles, the Crusades, and the Black Death defined the era.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'silk road', summary: 'Network of trade routes connecting East Asia and the Mediterranean from the 2nd century BC. Spread goods, culture, and ideas.', source: 'wikipedia', confidence: 0.9 },

  // ===== Philosophy (12) =====
  { topic: 'stoicism', summary: 'Ancient Greek philosophy founded in Athens. Focuses on virtue, reason, and accepting what one cannot control.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'existentialism', summary: 'Philosophy emphasizing individual freedom and meaning-making. Holds that life has no inherent purpose and we create our own.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'ethics', summary: 'Study of moral principles guiding right and wrong. Major frameworks include consequentialism, deontology, and virtue ethics.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'logic', summary: 'Study of valid reasoning and argumentation. Encompasses deductive reasoning, inductive reasoning, and formal systems.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'metaphysics', summary: 'Branch of philosophy examining the fundamental nature of reality, being, time, causality, and possibility.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'nietzsche', summary: 'German philosopher known for concepts of the will to power, God is dead, and eternal recurrence. Influenced existentialism and postmodernism.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'confucianism', summary: 'Chinese ethical and philosophical system based on teachings of Confucius. Emphasizes filial piety, ritual, benevolence, and harmony.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'buddhism', summary: 'Philosophical tradition founded by Siddhartha Gautama around 500 BC. Core teachings include the Four Noble Truths and the Eightfold Path.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'taoism', summary: 'Chinese philosophy emphasizing living in harmony with the Tao (the Way). Key concepts include wu wei, simplicity, and naturalness.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'plato', summary: 'Ancient Greek philosopher and student of Socrates. Founded the Academy. Theory of Forms, Allegory of the Cave.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'aristotle', summary: 'Greek philosopher and student of Plato. Systematic thinker covering logic, ethics, politics, biology, and metaphysics.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'epistemology', summary: 'Branch of philosophy concerned with the nature, origin, and limits of knowledge. Explores questions of belief and justification.', source: 'wikipedia', confidence: 0.9 },

  // ===== Psychology (10) =====
  { topic: 'cognitive bias', summary: 'Systematic patterns of deviation from rational judgment. Includes confirmation bias, anchoring, and the Dunning-Kruger effect.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'conditioning', summary: 'Learning process through association and reinforcement. Pavlov classical conditioning and Skinner operant conditioning.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'dunning kruger', summary: 'Cognitive bias where people with low ability overestimate their competence while experts tend to underestimate theirs.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'attachment theory', summary: 'Psychological framework describing how infants bond with caregivers. Identifies secure, avoidant, and anxious attachment styles.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'maslow hierarchy', summary: 'Pyramid model of human needs: physiological, safety, love and belonging, esteem, and self-actualization at the top.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'freud', summary: 'Founder of psychoanalysis. Developed theories of the unconscious mind, dream interpretation, id-ego-superego, and psychosexual stages.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'jungian psychology', summary: 'Analytical psychology developed by Carl Jung. Concepts include collective unconscious, archetypes, introversion and extroversion.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'social psychology', summary: 'Study of how individuals think, feel, and behave in social contexts. Examines conformity, obedience, group dynamics, and attitudes.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'memory', summary: 'Cognitive process of encoding, storing, and retrieving information. Includes sensory, short-term, and long-term memory systems.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'sleep psychology', summary: 'Study of sleep processes, circadian rhythms, and dream states. Sleep is critical for memory consolidation and cognitive function.', source: 'wikipedia', confidence: 0.9 },

  // ===== Space (12) =====
  { topic: 'solar system', summary: 'Gravitationally bound system of the Sun and its orbiting bodies. Includes 8 planets, 5 dwarf planets, and the asteroid belt.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'big bang', summary: 'Leading theory that the universe began approximately 13.8 billion years ago from an infinitely dense singularity and has been expanding ever since.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'exoplanets', summary: 'Planets orbiting stars outside our solar system. Over 5,000 confirmed, primarily discovered by the Kepler Space Telescope.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'dark matter', summary: 'Invisible form of matter comprising approximately 27% of the universe. Detectable only through its gravitational effects on visible matter.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'galaxies', summary: 'Massive gravitationally bound systems of stars, gas, dust, and dark matter. The Milky Way contains over 100 billion stars.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'nebula', summary: 'Vast cloud of gas and dust in space where stars are born or the remnants of dead stars. Includes emission, reflection, and planetary nebulae.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'neutron stars', summary: 'Incredibly dense remnants of supernova explosions. A teaspoon of neutron star material weighs billions of tons.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'asteroids', summary: 'Small rocky bodies orbiting the Sun, primarily found in the asteroid belt between Mars and Jupiter. Range in size from meters to hundreds of kilometers.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'space exploration', summary: 'Discovery and exploration of outer space using astronomy, satellites, and spacecraft. Includes human and robotic missions beyond Earth.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'interstellar travel', summary: 'Hypothetical travel between stars or planetary systems. Requires advanced propulsion such as fusion drives, solar sails, or warp drives.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'milky way', summary: 'Barred spiral galaxy containing our solar system. Spans about 100,000 light-years across with 100-400 billion stars.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'supernova', summary: 'Powerful stellar explosion that occurs when a massive star exhausts its fuel and collapses. Temporarily outshines entire galaxies.', source: 'wikipedia', confidence: 0.9 },

  // ===== Gaming (10) =====
  { topic: 'game development', summary: 'Process of creating video games. Combines programming, art, design, sound, writing, and testing into a cohesive interactive experience.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'speedrunning', summary: 'Practice of completing video games as fast as possible. Often uses glitches, exploits, and carefully optimized routes.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'esports', summary: 'Organized competitive video gaming. Major titles include League of Legends, Dota 2, Counter-Strike, and Valorant with million-dollar prize pools.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'minecraft', summary: 'Sandbox game developed by Mojang. Players build, explore, and survive in a procedurally generated block world. Best-selling game of all time.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'game design', summary: 'Art and science of creating rules, mechanics, and content for games. Balances challenge, reward, player agency, and fun.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'virtual reality', summary: 'Immersive computer-generated environment experienced through headsets. Used for gaming, training simulations, and therapeutic applications.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'strategy games', summary: 'Genre emphasizing tactical or strategic decision-making. Includes real-time strategy, turn-based tactics, and grand strategy games.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'roguelikes', summary: 'Genre characterized by procedurally generated levels, permadeath, and turn-based gameplay. Named after the 1980 game Rogue.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'open world games', summary: 'Games offering large freely explorable environments with minimal arbitrary barriers. Emphasizes player agency and emergent gameplay.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'puzzle games', summary: 'Genre focused on problem-solving through logic, pattern recognition, and lateral thinking. Includes classics like Tetris and Portal.', source: 'wikipedia', confidence: 0.9 },

  // ===== Biology / Health (12) =====
  { topic: 'human brain', summary: 'Central organ of the human nervous system. Contains approximately 86 billion neurons and controls thought, memory, movement, and emotion.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'immune system', summary: "Complex network of cells, tissues, and organs defending the body against pathogens. Includes white blood cells, antibodies, and memory cells.", source: 'wikipedia', confidence: 0.9 },
  { topic: 'genetics', summary: 'Study of genes, genetic variation, and heredity. DNA carries genetic information through chromosomes with dominant and recessive traits.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'microbiome', summary: 'Community of microorganisms living in and on the human body. Gut bacteria influence digestion, mood, immune function, and overall health.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'viruses', summary: 'Infectious agents that replicate only inside host cells. Consist of genetic material (DNA or RNA) enclosed in a protein coat.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'antibiotics', summary: 'Medications that kill or inhibit bacterial growth. Revolutionized medicine but overuse has led to antibiotic resistance.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'human anatomy', summary: 'Study of the structure of the human body. Includes skeletal, muscular, circulatory, nervous, and other organ systems.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'endocannabinoid system', summary: 'Biological system involved in regulating mood, appetite, pain sensation, and memory. Interacts with cannabinoids produced naturally in the body.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'epigenetics', summary: 'Study of heritable changes in gene expression that do not involve changes to the DNA sequence. Influenced by environment and lifestyle.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'stem cells', summary: 'Undifferentiated cells capable of developing into various cell types. Offer potential for regenerative medicine and tissue repair.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'nutrition', summary: 'Science of nutrients in food and how the body processes them. Macronutrients and micronutrients are essential for health and growth.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'mitosis', summary: 'Process of cell division producing two identical daughter cells. Essential for growth, repair, and asexual reproduction.', source: 'wikipedia', confidence: 0.9 },

  // ===== Art / Literature (10) =====
  { topic: 'renaissance', summary: 'Cultural rebirth from the 14th to 17th centuries bridging the Middle Ages and modernity. Flowering of art, science, and humanism.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'impressionism', summary: '19th-century art movement characterized by visible brushstrokes, open composition, and emphasis on light. Key artists include Monet and Renoir.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'shakespeare', summary: 'English playwright and poet from 1564 to 1616. Wrote 38 plays including Hamlet, Romeo and Juliet, and Macbeth. Influenced modern English.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'surrealism', summary: '20th-century avant-garde movement exploring the unconscious mind through dreamlike imagery. Leading figures include Dali and Magritte.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'cubism', summary: 'Early 20th-century art movement pioneered by Picasso and Braque. Depicts subjects from multiple viewpoints using geometric forms.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'greek mythology', summary: 'Collection of myths from ancient Greece featuring gods like Zeus, heroes like Hercules, and creatures like Medusa. Foundation of Western literature.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'norse mythology', summary: 'Mythology of the Scandinavian peoples featuring gods like Odin and Thor, the World Tree Yggdrasil, and Ragnarok the end of the world.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'poetry', summary: 'Literary form using aesthetic and rhythmic qualities of language to evoke meaning. Includes sonnets, haiku, free verse, and epic poetry.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'gothic architecture', summary: 'Architectural style from 12th to 16th century Europe. Characterized by pointed arches, ribbed vaults, flying buttresses, and stained glass.', source: 'wikipedia', confidence: 0.9 },
  { topic: 'film history', summary: 'Evolution of cinema from the late 19th century through silent film, the Golden Age of Hollywood, new waves, and the digital era.', source: 'wikipedia', confidence: 0.9 },
];

const WIKI_MOST_VIEWED = 'https://en.wikipedia.org/w/api.php?action=query&list=mostviewed&format=json';
const WIKI_SUMMARY = 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&exlimit=50&format=json';
const SKIP_PREFIXES = ['Special:', 'Main Page', 'Wikipedia:', 'Help:', 'File:', 'Talk:', 'User:', 'Template:', 'Category:', 'Portal:'];

async function fetchWikipediaTopics() {
  let titles = [];

  // Fetch page 1 (0-499)
  try {
    const res1 = await fetch(`${WIKI_MOST_VIEWED}&pvimlimit=500`);
    const data1 = await res1.json();
    titles.push(...(data1.query?.mostviewed || []));
  } catch (e) {
    console.log(`[Knowledge] Wikipedia page 1 fetch failed: ${e.message}`);
    return 0;
  }

  // Fetch page 2 (500-999)
  try {
    const res2 = await fetch(`${WIKI_MOST_VIEWED}&pvimlimit=500&pvoffset=500`);
    const data2 = await res2.json();
    titles.push(...(data2.query?.mostviewed || []));
  } catch (e) {
    console.log(`[Knowledge] Wikipedia page 2 fetch failed: ${e.message}`);
  }

  // Filter non-article pages
  titles = titles.filter(t => !SKIP_PREFIXES.some(p => t.title.startsWith(p)));
  titles = titles.map(t => t.title);

  // Batch and fetch summaries
  let count = 0;
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    try {
      const url = `${WIKI_SUMMARY}&titles=${encodeURIComponent(batch.join('|'))}`;
      const res = await fetch(url);
      const data = await res.json();
      const pages = data.query?.pages || {};
      for (const page of Object.values(pages)) {
        if (page.extract && page.title) {
          const topic = page.title.toLowerCase().replace(/_/g, ' ');
          addKnowledgeBase(topic, page.extract, 'wikipedia', 0.9);
          count++;
        }
      }
    } catch (e) {
      console.log(`[Knowledge] Wikipedia batch ${i} failed: ${e.message}`);
    }
  }

  return count;
}

function seedFallbackTopics() {
  let count = 0;
  for (const t of FALLBACK_TOPICS) {
    try {
      addKnowledgeBase(t.topic, t.summary, t.source, t.confidence);
      count++;
    } catch {}
  }
  return count;
}

function seedKnowledgeBase() {
  const fallbackCount = seedFallbackTopics();

  const lastSeed = getAppState('last_wikipedia_seed');
  if (lastSeed) {
    const hoursSince = (Date.now() - parseInt(lastSeed, 10)) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      console.log(`[Knowledge] Using cached data (last seed: ${Math.round(hoursSince)}h ago)`);
      return;
    }
  }

  console.log(`[Knowledge] Seeded ${fallbackCount} fallback topics, fetching Wikipedia...`);
  fetchWikipediaTopics().then(wikiCount => {
    setAppState('last_wikipedia_seed', Date.now().toString());
    console.log(`[Knowledge] Wikipedia fetch complete: ${wikiCount} topics added`);
  }).catch(e => {
    console.log(`[Knowledge] Wikipedia fetch failed: ${e.message}`);
  });
}

module.exports = { seedKnowledgeBase, seedFallbackTopics, fetchWikipediaTopics };
