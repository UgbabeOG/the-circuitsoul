export type FeatureFlagValue = boolean | string | number;

export interface FeatureFlagMap {
  [flag: string]: FeatureFlagValue;
}

export class FeatureFlagClient {
  private flags: FeatureFlagMap;

  constructor(initialFlags: FeatureFlagMap = {}) {
    this.flags = { ...initialFlags };
  }

  hasFlag(flag: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.flags, flag);
  }

  isEnabled(flag: string): boolean {
    const value = this.flags[flag];
    return value === true || value === 'true';
  }

  get<T extends FeatureFlagValue = FeatureFlagValue>(flag: string, fallback?: T): T | undefined {
    if (!this.hasFlag(flag)) {
      return fallback;
    }

    return this.flags[flag] as T;
  }

  set(flag: string, value: FeatureFlagValue): void {
    this.flags[flag] = value;
  }
}

export function createFeatureFlagClient(initialFlags: FeatureFlagMap = {}) {
  return new FeatureFlagClient(initialFlags);
}

export function requireFeature(flag: string, featureClient: FeatureFlagClient) {
  return featureClient.isEnabled(flag);
}
