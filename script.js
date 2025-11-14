// script.js
// Port of bombard-ant.py algorithm to JavaScript
// Keeps logic faithful to the Python file you provided.

(() => {
  // Canvas & UI
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 800;
  canvas.height = 600;

  // UI elements (some exist in your HTML)
  const popSizeInput = document.getElementById('popSize');
  const mutationInput = document.getElementById('mutation');
  const crossoverInput = document.getElementById('crossover');
  const radiusInput = document.getElementById('radius');
  const generationLabel = document.getElementById('generation');
  const bestFitnessLabel = document.getElementById('bestFitness');
  const totalAntsLabel = document.getElementById('totalAnts');
  const killRateLabel = document.getElementById('killRate');

  // Default constants (match your Python defaults)
  const DEFAULT_POPULATION_SIZE = 50;
  const DEFAULT_MAX_GENERATIONS = 100;
  const DEFAULT_CROSSOVER_RATE = 0.8; // as fraction
  const DEFAULT_MUTATION_RATE = 0.02; // as fraction
  const DEFAULT_BOMB_RADIUS = 10.0; // in python units (0-100 grid)

  // We'll run algorithm on a 0..100 logical grid (same as Python), then scale to canvas for drawing.
  const GRID_W = 100;
  const GRID_H = 100;

  // Utility: scale functions between logical grid (0..100) and canvas pixels
  function scaleX(x) {
    return (x / GRID_W) * canvas.width;
  }
  function scaleY(y) {
    return (y / GRID_H) * canvas.height;
  }

  // --- Data structures mirroring the Python code ---
  class Point {
    constructor(x, y, amount_of_ants = 0) {
      this.x = x;
      this.y = y;
      this.amount_of_ants = amount_of_ants;
    }
  }

  class Chromosome {
    // bombs: array of Point (x,y,amount)
    constructor(bombs) {
      this.bombs = bombs.map(b => new Point(b.x, b.y, b.amount_of_ants || 0));
      this.fitness = 0;
      this.calculateFitness();
    }

    calculateDistance(p1, p2) {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // replicate Python calculateKills(ants, distance)
    calculateKills(ants, distance) {
      // compute dmax (max distance between any two nests) just like Python
      let dmax = 0;
      for (let i = 0; i < nests.length; i++) {
        for (let j = i + 1; j < nests.length; j++) {
          const d = this.calculateDistance(nests[i], nests[j]);
          if (d > dmax) dmax = d;
        }
      }
      // Apply same formula: ants * dmax / 20.0 * distance + 0.00001
      return ants * dmax / 20.0 * distance + 0.00001;
    }

    calculateFitness() {
      let total_kills = 0.0;
      // copy remaining ants per nest
      const remaining_ants = nests.map(n => n.amount_of_ants);

      for (const bomb of this.bombs) {
        for (let i = 0; i < nests.length; i++) {
          const nest = nests[i];
          const distance = this.calculateDistance(nest, bomb);
          if (distance <= getBombRadius()) {
            const kills = this.calculateKills(nest.amount_of_ants, distance);
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

  // --- Nests: use the exact array from your Python file ---
  const nests = [
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
  const num_nests = nests.length;

  // Simulation state
  let POPULATION_SIZE = DEFAULT_POPULATION_SIZE;
  let MAX_GENERATIONS = DEFAULT_MAX_GENERATIONS;
  let CROSSOVER_RATE = DEFAULT_CROSSOVER_RATE;
  let MUTATION_RATE = DEFAULT_MUTATION_RATE;
  let BOMB_RADIUS = DEFAULT_BOMB_RADIUS;
  const BOMBS_PER_CHROMOSOME = 3; // python used exactly 3 bombs per chromosome

  let population = [];
  let generation = 0;
  let running = false;
  let bestSolution = null;
  let bestFitness = 0;

  // Helpers to read values from UI (if you change sliders)
  function getPopulationSize() {
    return parseInt(popSizeInput ? popSizeInput.value : POPULATION_SIZE) || POPULATION_SIZE;
  }
  function getMutationRate() {
    // slider gives 1..50 as percent in your HTML; fall back to default if absent
    return mutationInput ? (parseInt(mutationInput.value) / 100) : MUTATION_RATE;
  }
  function getCrossoverRate() {
    return crossoverInput ? (parseInt(crossoverInput.value) / 100) : CROSSOVER_RATE;
  }
  function getBombRadius() {
    // HTML radius slider (10..80) maps to python logical units; default 10
    return radiusInput ? parseInt(radiusInput.value) : BOMB_RADIUS;
  }

  // --- Genetic operators ported from Python ---
  function initializePopulation() {
    population = [];
    POPULATION_SIZE = getPopulationSize();
    for (let i = 0; i < POPULATION_SIZE; i++) {
      const bombs = [];
      for (let b = 0; b < BOMBS_PER_CHROMOSOME; b++) {
        bombs.push(new Point(
          Math.floor(Math.random() * (GRID_W + 1)), // 0..100 inclusive
          Math.floor(Math.random() * (GRID_H + 1)),
          0
        ));
      }
      population.push(new Chromosome(bombs));
    }
    // set best
    bestSolution = findBestSolution();
    bestFitness = bestSolution ? bestSolution.fitness : 0;
  }

  function mutate(chromosome) {
    const mutRate = getMutationRate();
    for (let i = 0; i < BOMBS_PER_CHROMOSOME; i++) {
      if (Math.random() < mutRate) {
        chromosome.bombs[i].x = Math.floor(Math.random() * (GRID_W + 1));
        chromosome.bombs[i].y = Math.floor(Math.random() * (GRID_H + 1));
      }
    }
    chromosome.calculateFitness();
  }

  function crossover(parent1, parent2) {
    const cxRate = getCrossoverRate();
    let child1_bombs = [];
    let child2_bombs = [];
    if (Math.random() < cxRate) {
      const crossover_point = Math.floor(Math.random() * BOMBS_PER_CHROMOSOME); // 0..2
      for (let i = 0; i < BOMBS_PER_CHROMOSOME; i++) {
        if (i <= crossover_point) {
          // take from p1 / p2 respectively
          child1_bombs.push(new Point(parent1.bombs[i].x, parent1.bombs[i].y, parent1.bombs[i].amount_of_ants));
          child2_bombs.push(new Point(parent2.bombs[i].x, parent2.bombs[i].y, parent2.bombs[i].amount_of_ants));
        } else {
          child1_bombs.push(new Point(parent2.bombs[i].x, parent2.bombs[i].y, parent2.bombs[i].amount_of_ants));
          child2_bombs.push(new Point(parent1.bombs[i].x, parent1.bombs[i].y, parent1.bombs[i].amount_of_ants));
        }
      }
    } else {
      // no crossover: deep copy parents
      child1_bombs = parent1.bombs.map(b => new Point(b.x, b.y, b.amount_of_ants));
      child2_bombs = parent2.bombs.map(b => new Point(b.x, b.y, b.amount_of_ants));
    }
    const child1 = new Chromosome(child1_bombs);
    const child2 = new Chromosome(child2_bombs);
    mutate(child1);
    mutate(child2);
    return [child1, child2];
  }

  function rouletteWheelSelection(total_fitness) {
    // returns index of selected parent (mirrors Python)
    if (total_fitness <= 0) {
      // fallback to random index if all fitness are zero
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
    const total_fitness = population.reduce((s, c) => s + c.fitness, 0);
    const new_population = [];
    // iterate in steps of 2
    for (let i = 0; i < POPULATION_SIZE; i += 2) {
      const p1_idx = rouletteWheelSelection(total_fitness);
      const p2_idx = rouletteWheelSelection(total_fitness);
      const [child1, child2] = crossover(population[p1_idx], population[p2_idx]);
      new_population.push(child1);
      new_population.push(child2);
    }
    // copy new population into population (Python replaced population)
    for (let i = 0; i < POPULATION_SIZE; i++) {
      population[i] = new_population[i];
    }
  }

  function findBestSolution() {
    if (!population || population.length === 0) return null;
    let best = population[0];
    for (let i = 1; i < population.length; i++) {
      if (population[i].fitness > best.fitness) best = population[i];
    }
    return best;
  }

  // --- Drawing / UI updates ---
  function draw() {
    // background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw nests (scaled)
    for (const nest of nests) {
      ctx.fillStyle = '#8b4513';
      ctx.beginPath();
      ctx.arc(scaleX(nest.x), scaleY(nest.y), 10, 0, Math.PI * 2);
      ctx.fill();

      // draw a few sample ants (we won't render all amounts, just a tiny dot to indicate nest)
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(scaleX(nest.x) + 6, scaleY(nest.y) + 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw best solution bombs
    if (bestSolution) {
      const rad = getBombRadius();
      for (const bomb of bestSolution.bombs) {
        // blast radius (scaled)
        ctx.fillStyle = 'rgba(255,68,68,0.12)';
        ctx.strokeStyle = 'rgba(255,68,68,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(scaleX(bomb.x), scaleY(bomb.y), (rad / GRID_W) * canvas.width, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // bomb core
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(scaleX(bomb.x), scaleY(bomb.y), 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    updateStatsOnPage();
  }

  function updateStatsOnPage() {
    const totalAnts = nests.reduce((s, n) => s + n.amount_of_ants, 0);
    generationLabel.textContent = generation;
    bestFitnessLabel.textContent = Math.floor(bestFitness);
    totalAntsLabel.textContent = totalAnts;
    const killRate = totalAnts > 0 ? ((bestFitness / totalAnts) * 100).toFixed(1) : '0.0';
    killRateLabel.textContent = killRate + '%';
  }

  // --- Simulation control ---
  function resetSimulation() {
    generation = 0;
    bestFitness = 0;
    bestSolution = null;
    POPULATION_SIZE = getPopulationSize();
    initializePopulation();
    draw();
  }

  function stepGeneration() {
    // evaluate current population fitness already calculated on Chromosome creation/mutation
    // find best
    const best = findBestSolution();
    if (best && best.fitness > bestFitness) {
      bestFitness = best.fitness;
      // deep clone best into bestSolution for safe drawing (we only need bombs coords)
      bestSolution = new Chromosome(best.bombs.map(b => new Point(b.x, b.y, b.amount_of_ants)));
    } else if (!bestSolution && best) {
      bestSolution = new Chromosome(best.bombs.map(b => new Point(b.x, b.y, b.amount_of_ants)));
      bestFitness = best.fitness;
    }

    // Advance one generation
    evolveOnce();
    generation++;
    // re-calc fitnesses (children were created and mutated already have fitness computed in constructor/mutate)
    // update best from new population candidate
    const newBest = findBestSolution();
    if (newBest && newBest.fitness > bestFitness) {
      bestFitness = newBest.fitness;
      bestSolution = new Chromosome(newBest.bombs.map(b => new Point(b.x, b.y, b.amount_of_ants)));
    }

    draw();
  }

  let simTimer = null;
  function startSimulation() {
    if (running) return;
    running = true;
    // read MAX_GENERATIONS from default constant in Python
    const maxGen = DEFAULT_MAX_GENERATIONS;
    function loop() {
      if (!running) return;
      if (generation >= maxGen) {
        running = false;
        return;
      }
      stepGeneration();
      simTimer = setTimeout(loop, 100); // matches your original pacing
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

  // --- Public function bindings for HTML buttons (they exist in your index.html) ---
  window.startSimulation = () => {
    // ensure population size sync
    POPULATION_SIZE = getPopulationSize();
    if (!population || population.length !== POPULATION_SIZE) resetSimulation();
    startSimulation();
  };
  window.stopSimulation = () => stopSimulation();
  window.resetSimulation = () => {
    stopSimulation();
    resetSimulation();
  };

  // initialize on load
  resetSimulation();

  // initial draw
  draw();

})();
