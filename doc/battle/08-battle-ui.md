# Battle UI System

The battle UI includes health boxes, menus, and various visual elements.

## Screen Layout

```
┌─────────────────────────────────────────────────────┐
│                    Battle Background                 │
│                                                      │
│  ┌───────────────┐                 ┌──────────┐     │
│  │ Enemy Health  │                 │  Enemy   │     │
│  │ Box           │                 │ Pokemon  │     │
│  └───────────────┘                 │ Sprite   │     │
│                                    └──────────┘     │
│                                                      │
│       ┌──────────┐                                  │
│       │  Player  │                 ┌───────────────┐│
│       │ Pokemon  │                 │ Player Health ││
│       │ Sprite   │                 │ Box           ││
│       └──────────┘                 └───────────────┘│
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │              Message Box                     │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Health Box Structure

From `battle_interface.c`:

### Health Box Graphics

```c
enum {
    HEALTHBOX_GFX_0,              // HP bar black section
    HEALTHBOX_GFX_1,              // HP bar "H"
    HEALTHBOX_GFX_2,              // HP bar "P"
    HEALTHBOX_GFX_HP_BAR_GREEN,   // HP bar 0 pixels (full)
    HEALTHBOX_GFX_4 to GFX_11,    // HP bar 1-8 pixels filled (green)
    HEALTHBOX_GFX_12 to GFX_20,   // EXP bar 0-8 pixels
    HEALTHBOX_GFX_STATUS_PSN,     // Poison status icon
    HEALTHBOX_GFX_STATUS_PRZ,     // Paralysis status icon
    HEALTHBOX_GFX_STATUS_SLP,     // Sleep status icon
    HEALTHBOX_GFX_STATUS_FRZ,     // Freeze status icon
    HEALTHBOX_GFX_STATUS_BRN,     // Burn status icon
    HEALTHBOX_GFX_HP_BAR_YELLOW,  // HP bar yellow (medium HP)
    HEALTHBOX_GFX_HP_BAR_RED,     // HP bar red (low HP)
    HEALTHBOX_GFX_STATUS_BALL,    // Party ball icons
};
```

### Health Bar Colors

| HP Percentage | Color |
|---------------|-------|
| > 50% | Green |
| 21-50% | Yellow |
| ≤ 20% | Red |

```c
// Calculate HP bar color
u8 GetHPBarLevel(s16 hp, s16 maxHP) {
    s32 result;

    if (hp == maxHP)
        return HP_BAR_FULL;

    result = (hp * 48) / maxHP;

    if (result == 0 && hp > 0)
        return HP_BAR_EMPTY_ONE_PIXEL;

    return result;
}
```

### Health Box Contents

**Player Health Box:**
- Pokemon nickname
- Level (Lv. XX)
- Gender icon (♂/♀)
- HP bar
- HP numbers (current/max)
- EXP bar (bottom)
- Status icon (if any)

**Enemy Health Box:**
- Pokemon nickname
- Level (Lv. XX)
- Gender icon
- HP bar only (no numbers)
- Status icon (if any)
- Caught icon (if previously caught)

## Action Menu

```
┌─────────────────┐
│   FIGHT    BAG  │
│  POKéMON   RUN  │
└─────────────────┘
```

### Menu Options

| Option | Action |
|--------|--------|
| FIGHT | Opens move selection |
| BAG | Opens bag menu |
| POKéMON | Opens party menu |
| RUN | Attempt to flee |

## Move Selection Menu

```
┌─────────────────────────────┐
│  THUNDERBOLT    QUICK ATK  │
│  IRON TAIL      THUNDER    │
├─────────────────────────────┤
│ PP: 15/15    TYPE: ELECTRIC│
└─────────────────────────────┘
```

Shows:
- 4 moves (or less if fewer known)
- Selected move's PP
- Selected move's type

### Move Colors by Type

Move names are colored based on remaining PP:
- Full PP: Black
- Low PP: Orange
- No PP: Red (cannot select)

## Party Ball Indicators

During battle, 6 small balls show party status:

```c
enum {
    HEALTHBOX_GFX_STATUS_BALL,       // Full HP (alive)
    HEALTHBOX_GFX_STATUS_BALL_EMPTY, // No Pokemon in slot
    HEALTHBOX_GFX_STATUS_BALL_FAINTED, // Fainted
    HEALTHBOX_GFX_STATUS_BALL_STATUSED, // Has status condition
    HEALTHBOX_GFX_STATUS_BALL_CAUGHT,   // Caught indicator (enemy)
};
```

## Safari Zone Menu

```
┌─────────────────┐
│    BALL   BAIT  │
│  ROCK     RUN   │
└─────────────────┘
```

Also displays: "SAFARI BALLS: 30" counter

## Battle Animations

### HP Bar Animation

```c
// Smooth HP bar drain
static void MoveBattleBarGraphically(u8 battler, u8 type) {
    // Calculate pixels to change
    // Animate frame by frame
    // Update number display
}
```

### EXP Bar Animation

```c
// EXP bar fills from left to right
// On level up, bar resets and fills again
static u8 GetScaledExpFraction(s32 exp, s32 expPerLevel, s32 pixels, u8 scale) {
    return (exp * pixels) / expPerLevel;
}
```

## Status Icons

| Status | Icon | Position |
|--------|------|----------|
| Poison | PSN (purple) | Below HP bar |
| Paralysis | PRZ (yellow) | Below HP bar |
| Sleep | SLP (gray) | Below HP bar |
| Freeze | FRZ (cyan) | Below HP bar |
| Burn | BRN (red) | Below HP bar |

## Window Specifications

```c
// Battle message window
static const struct WindowTemplate sStandardBattleWindowTemplates[] = {
    { // Message window
        .bg = BG_MSG_WIN,
        .tilemapLeft = 2,
        .tilemapTop = 15,
        .width = 26,
        .height = 4,
        .paletteNum = 0,
        .baseBlock = 0x0290,
    },
    // ... other windows
};
```

## Battle Backgrounds

Backgrounds are selected based on location:

```c
enum {
    BATTLE_TERRAIN_GRASS,
    BATTLE_TERRAIN_LONG_GRASS,
    BATTLE_TERRAIN_SAND,
    BATTLE_TERRAIN_UNDERWATER,
    BATTLE_TERRAIN_WATER,
    BATTLE_TERRAIN_POND,
    BATTLE_TERRAIN_MOUNTAIN,
    BATTLE_TERRAIN_CAVE,
    BATTLE_TERRAIN_BUILDING,
    BATTLE_TERRAIN_PLAIN,
};
```

## Implementation Notes for React

```tsx
interface HealthBox {
  pokemon: BattlePokemon;
  isPlayer: boolean;
  showExpBar: boolean;
}

function HealthBoxComponent({ pokemon, isPlayer, showExpBar }: HealthBox) {
  const hpPercent = (pokemon.hp / pokemon.maxHp) * 100;
  const hpColor = hpPercent > 50 ? 'green' : hpPercent > 20 ? 'yellow' : 'red';

  return (
    <div className={`health-box ${isPlayer ? 'player' : 'enemy'}`}>
      <div className="name-line">
        <span className="nickname">{pokemon.nickname}</span>
        <span className="gender">{getGenderSymbol(pokemon)}</span>
        <span className="level">Lv.{pokemon.level}</span>
      </div>

      <div className="hp-bar-container">
        <span className="hp-label">HP</span>
        <div className="hp-bar">
          <div
            className={`hp-fill ${hpColor}`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {isPlayer && (
        <div className="hp-numbers">
          {pokemon.hp} / {pokemon.maxHp}
        </div>
      )}

      {showExpBar && isPlayer && (
        <div className="exp-bar">
          <div
            className="exp-fill"
            style={{ width: `${getExpPercent(pokemon)}%` }}
          />
        </div>
      )}

      {pokemon.status && (
        <StatusIcon status={pokemon.status} />
      )}
    </div>
  );
}

interface ActionMenuProps {
  onFight: () => void;
  onBag: () => void;
  onPokemon: () => void;
  onRun: () => void;
  canRun: boolean;
}

function ActionMenu({ onFight, onBag, onPokemon, onRun, canRun }: ActionMenuProps) {
  return (
    <div className="action-menu">
      <button onClick={onFight}>FIGHT</button>
      <button onClick={onBag}>BAG</button>
      <button onClick={onPokemon}>POKéMON</button>
      <button onClick={onRun} disabled={!canRun}>RUN</button>
    </div>
  );
}

interface MoveMenuProps {
  moves: Move[];
  pp: number[];
  maxPp: number[];
  onSelectMove: (index: number) => void;
  onCancel: () => void;
}

function MoveMenu({ moves, pp, maxPp, onSelectMove, onCancel }: MoveMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="move-menu">
      <div className="moves-grid">
        {moves.map((move, i) => (
          <button
            key={i}
            onClick={() => pp[i] > 0 && onSelectMove(i)}
            disabled={pp[i] === 0}
            className={selectedIndex === i ? 'selected' : ''}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            {move.name}
          </button>
        ))}
      </div>
      <div className="move-info">
        <span>PP: {pp[selectedIndex]}/{maxPp[selectedIndex]}</span>
        <span>TYPE: {TYPE_NAMES[moves[selectedIndex].type]}</span>
      </div>
    </div>
  );
}
```
