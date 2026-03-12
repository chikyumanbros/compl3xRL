/**
 * Gases system - miasma and extensible tile gases (diffusion + decay).
 * Tile data: tile.gases[type] = integer intensity (0..max).
 */
const Gases = (function() {
    const GAS_TYPES = {
        miasma: {
            max: 10,
            decayChance: 0.12,
            diffusionChance: 0.35,
            diffusionThreshold: 2
        }
        // Future: poison, smoke, etc.
    };

    function getConfig(type) {
        return GAS_TYPES[type] || { max: 10, decayChance: 0.15, diffusionChance: 0.25, diffusionThreshold: 2 };
    }

    function addGas(dungeon, x, y, type, amount = 1) {
        if (!dungeon || !dungeon.isInBounds || !dungeon.isInBounds(x, y)) return false;
        const tile = dungeon.getTile(x, y);
        if (!tile || tile.type !== 'floor') return false;
        if (!tile.gases) tile.gases = {};
        const cfg = getConfig(type);
        const add = Math.max(1, Math.floor(amount));
        const current = tile.gases[type] || 0;
        tile.gases[type] = Math.max(0, Math.min(cfg.max || 10, current + add));
        return true;
    }

    function getGasLevel(tile, type) {
        if (!tile || !tile.gases) return 0;
        return tile.gases[type] || 0;
    }

    function step(dungeon) {
        const width = dungeon.width;
        const height = dungeon.height;
        const deltas = new Map(); // type -> delta[y][x]

        function ensureDelta(type) {
            let d = deltas.get(type);
            if (!d) {
                d = Array.from({ length: height }, () => Array(width).fill(0));
                deltas.set(type, d);
            }
            return d;
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const t = dungeon.tiles[y][x];
                if (!t || t.type !== 'floor' || !t.gases) continue;

                for (const type of Object.keys(t.gases)) {
                    const level = t.gases[type] || 0;
                    if (level <= 0) { delete t.gases[type]; continue; }
                    const cfg = getConfig(type);

                    // Decay
                    if (Math.random() < (cfg.decayChance ?? 0.15)) {
                        t.gases[type] = Math.max(0, level - 1);
                        if (t.gases[type] === 0) { delete t.gases[type]; continue; }
                    }

                    // Diffuse toward lower neighbor
                    const afterDecay = t.gases[type] || 0;
                    if (afterDecay >= (cfg.diffusionThreshold ?? 2) && Math.random() < (cfg.diffusionChance ?? 0.25)) {
                        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                        const candidates = [];
                        for (const [dx, dy] of dirs) {
                            const nx = x + dx, ny = y + dy;
                            if (!dungeon.isInBounds(nx, ny)) continue;
                            const nt = dungeon.tiles[ny][nx];
                            if (!nt || nt.type !== 'floor') continue;
                            const nLevel = (nt.gases && nt.gases[type]) ? nt.gases[type] : 0;
                            candidates.push({ nx, ny, level: nLevel });
                        }
                        if (candidates.length > 0) {
                            candidates.sort((a, b) => a.level - b.level);
                            const pick = candidates[0];
                            const delta = ensureDelta(type);
                            delta[pick.ny][pick.nx] += 1;
                            delta[y][x] -= 1;
                        }
                    }
                }
            }
        }

        // Apply deltas with per-type caps
        deltas.forEach((delta, type) => {
            const cfg = getConfig(type);
            const max = cfg.max || 10;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const d = delta[y][x];
                    if (d === 0) continue;
                    const t = dungeon.tiles[y][x];
                    if (!t || t.type !== 'floor') continue;
                    if (!t.gases) t.gases = {};
                    const cur = t.gases[type] || 0;
                    const next = Math.max(0, Math.min(max, cur + d));
                    if (next <= 0) delete t.gases[type];
                    else t.gases[type] = next;
                }
            }
        });
    }

    return {
        GAS_TYPES,
        addGas,
        getGasLevel,
        step
    };
})();

