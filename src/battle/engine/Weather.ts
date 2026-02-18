/**
 * Weather system for battle.
 *
 * C ref: public/pokeemerald/src/battle_util.c (weather damage, weather checks)
 * C ref: public/pokeemerald/include/constants/weather.h
 *
 * Weather types: NONE, RAIN, SUN, SANDSTORM, HAIL
 * Duration: 5 turns from moves, permanent from abilities (Drizzle, Drought, Sand Stream)
 * End-of-turn: Sandstorm 1/16 to non-{Rock,Ground,Steel}, Hail 1/16 to non-Ice
 */

import type { WeatherState, WeatherType, BattlePokemon, BattleEvent } from './types.ts';
import { getBattlePokemonTypes } from './speciesTypes.ts';

export function createDefaultWeather(): WeatherState {
  return { type: 'none', turnsRemaining: 0, permanent: false };
}

/** Set weather. Duration = 5 for moves, 0 for permanent (ability). */
export function setWeather(
  _state: WeatherState,
  type: WeatherType,
  permanent: boolean,
): WeatherState {
  return {
    type,
    turnsRemaining: permanent ? 0 : 5,
    permanent,
  };
}

/** Tick weather at end of turn. Returns events and updated state. */
export function tickWeather(
  state: WeatherState,
  battlers: BattlePokemon[],
): { weather: WeatherState; events: BattleEvent[] } {
  if (state.type === 'none') {
    return { weather: state, events: [] };
  }

  const events: BattleEvent[] = [];

  // Deal weather damage
  if (state.type === 'sandstorm' || state.type === 'hail') {
    for (const mon of battlers) {
      if (mon.currentHp <= 0) continue;

      const immune = isWeatherImmune(mon, state.type);
      if (immune) continue;

      const damage = Math.max(1, Math.floor(mon.maxHp / 16));
      mon.currentHp = Math.max(0, mon.currentHp - damage);

      const weatherName = state.type === 'sandstorm' ? 'sandstorm' : 'hail';
      events.push({
        type: 'weather_damage',
        battler: mon.isPlayer ? 0 : 1,
        value: damage,
        message: `${mon.name} is buffeted by the ${weatherName}!`,
      });

      if (mon.currentHp <= 0) {
        events.push({
          type: 'faint',
          battler: mon.isPlayer ? 0 : 1,
          message: `${mon.name} fainted!`,
        });
      }
    }
  }

  // Decrement counter
  if (!state.permanent) {
    const newTurns = state.turnsRemaining - 1;
    if (newTurns <= 0) {
      const endMsg = getWeatherEndMessage(state.type);
      events.push({ type: 'weather_change', message: endMsg, detail: 'none' });
      return { weather: createDefaultWeather(), events };
    }
    return { weather: { ...state, turnsRemaining: newTurns }, events };
  }

  return { weather: state, events };
}

function isWeatherImmune(mon: BattlePokemon, weather: WeatherType): boolean {
  const info = getBattlePokemonTypes(mon);
  if (weather === 'sandstorm') {
    return info.includes('ROCK') || info.includes('GROUND') || info.includes('STEEL');
  }
  if (weather === 'hail') {
    return info.includes('ICE');
  }
  return true;
}

function getWeatherEndMessage(type: WeatherType): string {
  switch (type) {
    case 'rain': return 'The rain stopped.';
    case 'sun': return 'The sunlight faded.';
    case 'sandstorm': return 'The sandstorm subsided.';
    case 'hail': return 'The hail stopped.';
    default: return '';
  }
}

/** Get weather start message. */
export function getWeatherStartMessage(type: WeatherType): string {
  switch (type) {
    case 'rain': return 'It started to rain!';
    case 'sun': return 'The sunlight turned harsh!';
    case 'sandstorm': return 'A sandstorm brewed!';
    case 'hail': return 'It started to hail!';
    default: return '';
  }
}

/** Damage modifiers from weather. */
export function getWeatherDamageModifier(weather: WeatherType, moveType: string): number {
  if (weather === 'rain') {
    if (moveType === 'WATER') return 1.5;
    if (moveType === 'FIRE') return 0.5;
  }
  if (weather === 'sun') {
    if (moveType === 'FIRE') return 1.5;
    if (moveType === 'WATER') return 0.5;
  }
  return 1;
}

/** Special accuracy modifiers from weather. */
export function getWeatherAccuracyOverride(weather: WeatherType, moveId: number): number | null {
  // Thunder: 100% in rain, 50% in sun
  // MOVES.THUNDER = 87
  if (moveId === 87) {
    if (weather === 'rain') return 100;
    if (weather === 'sun') return 50;
  }
  return null;
}
