// script.js
// Port of bombard-ant.py algorithm to JavaScript
// Fixed version with corrected calculateKills method

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  
  // Canvas & UI
  const canvas = document.getElementById('canvas');
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  canvas.width = 800;
  canvas.height = 600;

  // UI elements - with null checks
  const popSizeInput = document.getElementById('popSize');
  const mutationInput = document.getElementById('mutation');
  const crossoverInput = document.getElementById('crossover');
  const radiusInput = document.getElementById('radius');
  const bombCountInput = document.getElementById('bombCount');
  const nestCountInput = document.getElementById('nestCount');
  const generationLabel = document.getElementById('generation');
  const bestFitnessLabel = document.getElementById('bestFitness');
  const totalAntsLabel = document.getElementById('totalAnts');
  const killRateLabel = document.getElementById('killRate');

  // Default constants - MATCHING PYTHON SCRIPT
  const DEFAULT_POPULATION_SIZE = 50;
  const DEFAULT_MAX_GENERATIONS = 100;
  const DEFAULT_CROSSOVER_RATE = 0.8;    // 80% in Python
  const DEFAULT_MUTATION_RATE = 0.02;    // 2% in Python
  const DEFAULT_BOMB_RADIUS = 10.0;      // 10.0 in Python
  const DEFAULT_BOMB_COUNT = 3;          // 3 bombs in Python

  // Grid dimensions
  const GRID_W = 100;
  const GRID_H = 100;

  // Utility functions
  function scaleX(x) {
    return (x / GRID_W) * canvas.width;
  }
  
  function scaleY(y) {
    return (y / GRID_H) * canvas.height;
  }

  // --- Data structures ---
  class Point {
    constructor(x, y, amount_of_ants = 0) {
      this.x = x;
      this.y = y;
      this.amount_of_ants = amount_of_ants;
    }
  }

  class Chromosome {
    constructor(bombs) {
      this.bombs = bombs.map(b => new Point(b.x, b.y));
      this.fitness = 0;
      this.calculateFitness();
    }

    calculateDistance(p1, p2) {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    calculateKills(ants, distance) {
      // FIXED: Calculate dmax correctly across all nests
      let dmax = 0;
      for (let i = 0; i < nests.length; i++) {
        for (let j = i + 1; j < nests.length; j++) {
          const d = this.calculateDistance(nests[i], nests[j]);
          if (d > dmax) dmax = d;
        }
      }
      // Apply formula: ants * dmax / 20.0 * distance + 0.00001
      return ants * (dmax / 20.0) * distance + 0.00001;
    }

    calculateFitness() {
      let total_kills = 0.0;
      const remaining_ants = nests.map(n => n.amount_of_ants);
      const radius = getBombRadius();

      for (const bomb of this.bombs) {
        for (let i = 0; i < nests.length; i++) {
          const nest = nests[i];
          const distance = this.calculateDistance(nest, bomb);
          
          if (distance <= radius && remaining_ants[i] > 0) {
            const kills = this.calculateKills(remaining_ants[i], distance);
            
            if (kills >= remaining_ants[i]) {
              total_kills += remaining_ants[i];
              remaining_ants[i] = 0;
            } else {
              total_kills += kills;
              remaining_ants[i] -= kills;
            }
          }
        }
      }
      this.fitness = total_kills;
      return total_kills;
    }
  }

  // --- Nests configuration ---
  let nests = [
    new Point(25, 65, 100),
    new Point(23, 8, 200),
    new Point(7, 13, 327),
    new Point(95, 53, 440),
    new Point(3, 3, 450),
    new Point(54, 56, 639),
    new Point(67, 78, 650),
    new Point(32, 4, 678),
    new Point(24, 76, 750),
    new Point(66, 89, 801),
    new Point(84, 4, 945),
    new Point(34, 23, 967)
  ];

  // Simulation state
  let POPULATION_SIZE = DEFAULT_POPULATION_SIZE;
  let MAX_GENERATIONS = DEFAULT_MAX_GENERATIONS;
  let CROSSOVER_RATE = DEFAULT_CROSSOVER_RATE;
  let MUTATION_RATE = DEFAULT_MUTATION_RATE;
  let BOMB_RADIUS = DEFAULT_BOMB_RADIUS;
  let BOMBS_PER_CHROMOSOME = DEFAULT_BOMB_COUNT;

  let population = [];
  let generation = 0;
  let running = false;
  let bestSolution = null;
  let bestFitness = 0;
  let simTimer = null;

  // Configuration getters
  function getPopulationSize() {
    return parseInt(popSizeInput.value) || POPULATION_SIZE;
  }

  function getMutationRate() {
    return (parseInt(mutationInput.value) / 100) || MUTATION_RATE;
  }

  function getCrossoverRate() {
    return (parseInt(crossoverInput.value) / 100) || CROSSOVER_RATE;
  }

  function getBombRadius() {
    return parseInt(radiusInput.value) || BOMB_RADIUS;
  }

  function getBombCount() {
    return parseInt(bombCountInput.value) || BOMBS_PER_CHROMOSOME;
  }

  function getNestCount() {
    return parseInt(nestCountInput.value) || Math.min(8, nests.length);
  }

  // Update UI elements to match Python defaults
  function initializeUIWithPythonDefaults() {
    if (popSizeInput) popSizeInput.value = DEFAULT_POPULATION_SIZE;
    if (mutationInput) mutationInput.value = DEFAULT_MUTATION_RATE * 100; // Convert to percentage
    if (crossoverInput) crossoverInput.value = DEFAULT_CROSSOVER_RATE * 100; // Convert to percentage
    if (radiusInput) radiusInput.value = DEFAULT_BOMB_RADIUS;
    if (bombCountInput) bombCountInput.value = DEFAULT_BOMB_COUNT;
    
    // Update the display values
    updateValue('popSize', DEFAULT_POPULATION_SIZE);
    updateValue('mutation', DEFAULT_MUTATION_RATE * 100);
    updateValue('crossover', DEFAULT_CROSSOVER_RATE * 100);
    updateValue('radius', DEFAULT_BOMB_RADIUS);
  }

  // Update nests based on nest count
  function updateNests() {
    const nestCount = getNestCount();
    // Use first 'nestCount' nests
    currentNests = nests.slice(0, nestCount);
    return currentNests;
  }

  let currentNests = [];

  // --- Genetic Algorithm Functions ---
  function initializePopulation() {
    population = [];
    POPULATION_SIZE = getPopulationSize();
    BOMBS_PER_CHROMOSOME = getBombCount();
    currentNests = updateNests();
    
    for (let i = 0; i < POPULATION_SIZE; i++) {
      const bombs = [];
      for (let b = 0; b < BOMBS_PER_CHROMOSOME; b++) {
        bombs.push(new Point(
          Math.random() * GRID_W,
          Math.random() * GRID_H
        ));
      }
      population.push(new Chromosome(bombs));
    }
    
    bestSolution = findBestSolution();
    bestFitness = bestSolution ? bestSolution.fitness : 0;
  }

  function mutate(chromosome) {
    const mutRate = getMutationRate();
    for (let i = 0; i < chromosome.bombs.length; i++) {
      if (Math.random() < mutRate) {
        chromosome.bombs[i].x = Math.random() * GRID_W;
        chromosome.bombs[i].y = Math.random() * GRID_H;
      }
    }
    chromosome.calculateFitness();
  }

  function crossover(parent1, parent2) {
    const cxRate = getCrossoverRate();
    let child1_bombs = [];
    let child2_bombs = [];
    
    if (Math.random() < cxRate) {
      const crossover_point = Math.floor(Math.random() * parent1.bombs.length);
      for (let i = 0; i < parent1.bombs.length; i++) {
        if (i <= crossover_point) {
          child1_bombs.push(new Point(parent1.bombs[i].x, parent1.bombs[i].y));
          child2_bombs.push(new Point(parent2.bombs[i].x, parent2.bombs[i].y));
        } else {
          child1_bombs.push(new Point(parent2.bombs[i].x, parent2.bombs[i].y));
          child2_bombs.push(new Point(parent1.bombs[i].x, parent1.bombs[i].y));
        }
      }
    } else {
      child1_bombs = parent1.bombs.map(b => new Point(b.x, b.y));
      child2_bombs = parent2.bombs.map(b => new Point(b.x, b.y));
    }
    
    const child1 = new Chromosome(child1_bombs);
    const child2 = new Chromosome(child2_bombs);
    mutate(child1);
    mutate(child2);
    return [child1, child2];
  }

  function rouletteWheelSelection(total_fitness) {
    if (total_fitness <= 0) {
      return Math.floor(Math.random() * population.length);
    }
    let slice = Math.random() * total_fitness;
    let fitness_so_far = 0;
    for (let i = 0; i < population.length; i++) {
      fitness_so_far += population[i].fitness;
      if (fitness_so_far >= slice) return i;
    }
    return population.length - 1;
  }

  function evolveOnce() {
    const total_fitness = population.reduce((sum, chrom) => sum + chrom.fitness, 0);
    const new_population = [];
    
    for (let i = 0; i < POPULATION_SIZE; i += 2) {
      const p1_idx = rouletteWheelSelection(total_fitness);
      const p2_idx = rouletteWheelSelection(total_fitness);
      const [child1, child2] = crossover(population[p1_idx], population[p2_idx]);
      new_population.push(child1);
      if (new_population.length < POPULATION_SIZE) {
        new_population.push(child2);
      }
    }
    
    // Ensure we have exactly POPULATION_SIZE individuals
    while (new_population.length > POPULATION_SIZE) {
      new_population.pop();
    }
    
    population = new_population;
  }

  function findBestSolution() {
    if (!population.length) return null;
    let best = population[0];
    for (let i = 1; i < population.length; i++) {
      if (population[i].fitness > best.fitness) {
        best = population[i];
      }
    }
    return best;
  }

  // --- Drawing Functions ---
  function draw() {
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw blast radii first (so they appear behind bombs)
    if (bestSolution) {
      const radius = getBombRadius();
      const scaledRadius = (radius / GRID_W) * canvas.width;
      
      for (const bomb of bestSolution.bombs) {
        ctx.fillStyle = 'rgba(255, 68, 68, 0.15)';
        ctx.strokeStyle = 'rgba(255, 68, 68, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(scaleX(bomb.x), scaleY(bomb.y), scaledRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Draw nests
    for (const nest of currentNests) {
      // Nest center
      ctx.fillStyle = '#8b4513';
      ctx.beginPath();
      ctx.arc(scaleX(nest.x), scaleY(nest.y), 8, 0, Math.PI * 2);
      ctx.fill();

      // Ant indicators around nest
      ctx.fillStyle = '#00ff00';
      const antCount = Math.min(10, Math.ceil(nest.amount_of_ants / 100));
      for (let i = 0; i < antCount; i++) {
        const angle = (i / antCount) * Math.PI * 2;
        const distance = 15;
        ctx.beginPath();
        ctx.arc(
          scaleX(nest.x) + Math.cos(angle) * distance,
          scaleY(nest.y) + Math.sin(angle) * distance,
          2, 0, Math.PI * 2
        );
        ctx.fill();
      }
    }

    // Draw bombs on top
    if (bestSolution) {
      for (const bomb of bestSolution.bombs) {
        // Bomb core
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(scaleX(bomb.x), scaleY(bomb.y), 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Bomb center
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(scaleX(bomb.x), scaleY(bomb.y), 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    updateStatsOnPage();
  }

  function updateStatsOnPage() {
    const totalAnts = currentNests.reduce((sum, nest) => sum + nest.amount_of_ants, 0);
    generationLabel.textContent = generation;
    bestFitnessLabel.textContent = Math.round(bestFitness);
    totalAntsLabel.textContent = totalAnts;
    
    const killRate = totalAnts > 0 ? ((bestFitness / totalAnts) * 100) : 0;
    killRateLabel.textContent = killRate.toFixed(1) + '%';
  }

  // --- Simulation Control ---
  function resetSimulation() {
    stopSimulation();
    generation = 0;
    bestFitness = 0;
    bestSolution = null;
    initializePopulation();
    draw();
  }

  function stepGeneration() {
    // Find best in current population
    const currentBest = findBestSolution();
    if (currentBest && currentBest.fitness > bestFitness) {
      bestFitness = currentBest.fitness;
      bestSolution = new Chromosome(currentBest.bombs.map(b => new Point(b.x, b.y)));
    }

    // Evolve to next generation
    evolveOnce();
    generation++;

    // Check for new best after evolution
    const newBest = findBestSolution();
    if (newBest && newBest.fitness > bestFitness) {
      bestFitness = newBest.fitness;
      bestSolution = new Chromosome(newBest.bombs.map(b => new Point(b.x, b.y)));
    }

    draw();
  }

  function startSimulation() {
    if (running) return;
    running = true;
    
    function loop() {
      if (!running || generation >= MAX_GENERATIONS) {
        running = false;
        return;
      }
      stepGeneration();
      simTimer = setTimeout(loop, 50);
    }
    loop();
  }

  function stopSimulation() {
    running = false;
    if (simTimer) {
      clearTimeout(simTimer);
      simTimer = null;
    }
  }

  // --- UI Update Functions ---
  function updateValue(elementId, value) {
    const displayElement = document.getElementById(elementId + 'Value');
    if (displayElement) {
      if (elementId === 'mutation' || elementId === 'crossover') {
        displayElement.textContent = value + '%';
      } else {
        displayElement.textContent = value;
      }
    }
    
    // Reset simulation if parameters change during runtime
    if (running) {
      resetSimulation();
    }
  }

  // --- Global Function Bindings ---
  window.startSimulation = startSimulation;
  window.stopSimulation = stopSimulation;
  window.resetSimulation = resetSimulation;
  window.updateValue = updateValue;

  // Initialize event listeners for number inputs
  if (bombCountInput) {
    bombCountInput.addEventListener('change', resetSimulation);
  }
  if (nestCountInput) {
    nestCountInput.addEventListener('change', resetSimulation);
  }

  // Initialize UI with Python defaults and start simulation
  initializeUIWithPythonDefaults();
  resetSimulation();

});