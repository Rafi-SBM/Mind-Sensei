/* ==========================================================================
   Engine Type Definitions
   ========================================================================== */

export type EngineType = 'focus' | 'memory' | 'reaction' | 'logic';

/** Common stimulus shape all engines produce */
export interface Stimulus {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

/** Per-engine metric maps */
export interface FocusMetrics {
  targetAccuracy?: number;
  sustainedAttentionMs: number;
  distractionErrorRate: number;
  focusRecoveryLatencyMs: number;
  performanceVariance: number;
}

export interface MemoryMetrics {
  recallAccuracy: number;
  memorySpanTolerance: number;
  retentionDecay: number;
  complexityAdaptationSlope: number;
}

export interface ReactionMetrics {
  trialAccuracy?: number;
  responseAccuracy?: number;
  averageLatencyMs: number;
  standardDeviationMs: number;
  falseTriggerRate: number;
  fatigueDrift: number;
}

export interface LogicMetrics {
  solveTimeMs: number;
  efficiencyRatio: number;
  scalingAdaptationResponse: number;
  patternImprovementCurve: number;
}

export type EngineMetrics = FocusMetrics | MemoryMetrics | ReactionMetrics | LogicMetrics;

/** Generic engine session */
export interface SessionRecord {
  id: string;
  engineType: EngineType;
  timestamp: number;
  duration: number;
  difficulty: number;
  metrics: EngineMetrics;
  score: number;
}

/** Engine contract — each engine implements this interface as pure functions */
export interface EngineContract<TState, TInput, TResult extends EngineMetrics> {
  createInitialState: (difficulty: number, seed?: number) => TState;
  generateStimulus: (state: TState) => Stimulus;
  processInput: (state: TState, input: TInput) => TState;
  evaluateSession: (state: TState) => TResult;
  calculateScore: (metrics: TResult) => number;
}

/** Engine session state wrapper */
export interface EngineSession {
  engineType: EngineType;
  startedAt: number;
  difficulty: number;
  isActive: boolean;
  currentRound: number;
  totalRounds: number;
}
