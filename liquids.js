/**
 * Liquids system - blood and extensible floor liquids
 * Dungeon delegates addBlood, addLiquid, and stepLiquids logic here.
 * Tile data: blood uses tile.blood / tile.bloodStain (backward compat);
 * other types use tile.liquids[type].
 */
const Liquids = (function() {
    const BLOOD = 'blood';

    const LIQUID_TYPES = {
        blood: {
            maxWet: 10,
            maxStain: 10,
            dryingChance: 0.2,
            diffusionChance: 0.2,
            diffusionThreshold: 3,
            stainGrowthChance: 0.1,
            stainPerAmount: 0.5, // stain += ceil(amount/2)
            /** Slip chance per unit of wet blood (e.g. 0.025 = 2.5% per unit, cap 25%) */
            slipChancePerUnit: 0.025,
            slipChanceCap: 0.25
        },
        potion: {
            maxWet: 10,
            evaporateChance: 0.2,
            spreadChance: 0.15,
            spreadThreshold: 3
        },
        /** Groundwater / flooding: persists, spreads to adjacent floor (seepage, flood) */
        water: {
            maxWet: 15,
            evaporateChance: 0,
            spreadChance: 0.22,
            spreadThreshold: 2,
            /** Optional: slip when wading (e.g. 0.02 per unit, cap 20%) */
            slipChancePerUnit: 0.02,
            slipChanceCap: 0.2
        }
    };

    function getConfig(type) {
        return LIQUID_TYPES[type] || { maxWet: 10 };
    }

    /**
     * Add blood to a tile (wet + stain). Uses tile.blood / tile.bloodStain.
     */
    function addBlood(dungeon, x, y, amount) {
        if (!dungeon.isInBounds(x, y)) return false;
        const tile = dungeon.getTile(x, y);
        const cfg = LIQUID_TYPES.blood;
        const add = Math.max(1, Math.floor(amount));
        const current = typeof tile.blood === 'number' ? tile.blood : 0;
        tile.blood = Math.max(0, Math.min(cfg.maxWet, current + add));
        const stainCurrent = typeof tile.bloodStain === 'number' ? tile.bloodStain : 0;
        const stainAdd = Math.max(1, Math.ceil(amount * cfg.stainPerAmount));
        tile.bloodStain = Math.max(stainCurrent, Math.min(cfg.maxStain, stainCurrent + stainAdd));
        return true;
    }

    /**
     * Add a generic liquid type. Blood goes to tile.blood/bloodStain; others to tile.liquids[type].
     */
    function addLiquid(dungeon, x, y, type, amount) {
        if (!dungeon.isInBounds(x, y)) return false;
        if (type === BLOOD) return addBlood(dungeon, x, y, amount);
        const tile = dungeon.getTile(x, y);
        if (!tile.liquids) tile.liquids = {};
        const cfg = getConfig(type);
        const maxWet = cfg.maxWet || 10;
        const current = tile.liquids[type] || 0;
        tile.liquids[type] = Math.min(maxWet, current + Math.max(1, Math.floor(amount)));
        return true;
    }

    /**
     * Get wet blood level at tile (for slip checks, rendering).
     */
    function getBloodWet(tile) {
        return typeof tile.blood === 'number' ? tile.blood : 0;
    }

    /**
     * Get blood stain level at tile.
     */
    function getBloodStain(tile) {
        return typeof tile.bloodStain === 'number' ? tile.bloodStain : 0;
    }

    /**
     * Slip chance for blood (0..1). Uses LIQUID_TYPES.blood.slipChancePerUnit and slipChanceCap.
     */
    function getBloodSlipChance(tile) {
        const wet = getBloodWet(tile);
        if (wet <= 0) return 0;
        const cfg = LIQUID_TYPES.blood;
        return Math.min(cfg.slipChanceCap, wet * cfg.slipChancePerUnit);
    }

    /**
     * Simulate one step: blood drying/diffusion and generic liquids evaporation/spread.
     * Scent decay is left to Dungeon.
     */
    function step(dungeon) {
        const width = dungeon.width;
        const height = dungeon.height;
        const bloodCfg = LIQUID_TYPES.blood;
        const bloodDelta = Array.from({ length: height }, () => Array(width).fill(0));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const t = dungeon.tiles[y][x];
                if (t.type !== 'floor') continue;

                // Blood
                if (t.blood && t.blood > 0) {
                    if (Math.random() < bloodCfg.dryingChance) {
                        t.blood = Math.max(0, t.blood - 1);
                    }
                    if (t.blood >= bloodCfg.diffusionThreshold && Math.random() < bloodCfg.diffusionChance) {
                        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                        const candidates = [];
                        for (const [dx, dy] of dirs) {
                            const nx = x + dx, ny = y + dy;
                            if (!dungeon.isInBounds(nx, ny)) continue;
                            const nt = dungeon.tiles[ny][nx];
                            if (nt.type === 'floor') {
                                candidates.push({ nx, ny, level: nt.blood || 0 });
                            }
                        }
                        if (candidates.length > 0) {
                            candidates.sort((a, b) => a.level - b.level);
                            const pick = candidates[0];
                            bloodDelta[pick.ny][pick.nx] += 1;
                            bloodDelta[y][x] -= 1;
                        }
                    }
                    if (t.blood > 0 && Math.random() < bloodCfg.stainGrowthChance) {
                        t.bloodStain = Math.min(bloodCfg.maxStain, (t.bloodStain || 0) + 1);
                    }
                }

                // Generic liquids (potion, etc.)
                if (t.liquids) {
                    for (const key of Object.keys(t.liquids)) {
                        if (t.liquids[key] <= 0) { delete t.liquids[key]; continue; }
                        const cfg = getConfig(key);
                        const evap = cfg.evaporateChance != null ? cfg.evaporateChance : 0.2;
                        if (Math.random() < evap) {
                            t.liquids[key] = Math.max(0, t.liquids[key] - 1);
                            if (t.liquids[key] === 0) { delete t.liquids[key]; continue; }
                        }
                        const spreadCh = cfg.spreadChance != null ? cfg.spreadChance : 0.15;
                        const spreadThr = cfg.spreadThreshold != null ? cfg.spreadThreshold : 3;
                        if (t.liquids[key] >= spreadThr && Math.random() < spreadCh) {
                            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                            const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
                            const nx = x + dx, ny = y + dy;
                            if (dungeon.isInBounds(nx, ny) && dungeon.tiles[ny][nx].type === 'floor') {
                                const nt = dungeon.tiles[ny][nx];
                                if (!nt.liquids) nt.liquids = {};
                                nt.liquids[key] = (nt.liquids[key] || 0) + 1;
                                t.liquids[key] -= 1;
                                if (t.liquids[key] === 0) delete t.liquids[key];
                            }
                        }
                    }
                }
            }
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const delta = bloodDelta[y][x];
                if (delta !== 0) {
                    const t = dungeon.tiles[y][x];
                    t.blood = Math.max(0, Math.min(bloodCfg.maxWet, (t.blood || 0) + delta));
                }
            }
        }
    }

    return {
        LIQUID_TYPES,
        addBlood,
        addLiquid,
        getBloodWet,
        getBloodStain,
        getBloodSlipChance,
        step
    };
})();
