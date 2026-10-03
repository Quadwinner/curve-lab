import type { PresetParams } from '../dbc/config';
import type { FeePoint } from '../curve/fees';
import type { SeriesPoint } from '../curve/math';

export interface QuoteInfo { symbol: string; decimals: number }

export interface PresetSummary {
  id: string;
  quoteMint: string;
  quote: QuoteInfo;
  launches: number;
  organic: number;
  instant: number;
  open: number;
  organicRate: number | null;
  instantShare: number;
  medianGradSeconds: number | null;
  raised: number;
  fees: number;
  threshold: number;
  startFeeBps: number;
  endFeeBps: number;
  feeMode: number;
  dynamicFee: boolean;
  creatorFeePct: number;
  startMcap: number | null;
  migrationMcap: number | null;
  spark: number[];
  lastLaunch: number | null;
}

export interface RecentLaunch { pool: string; mint: string; launchTime: number | null; cls: 'open' | 'organic' | 'instant'; progress: number }

export interface PresetDetail extends PresetSummary {
  params: PresetParams;
  curve: SeriesPoint[];
  feeSchedule: FeePoint[];
  weekly: { week: number; launches: number; organic: number }[];
  buckets: number[];
  topFeeClaimers: { address: string; launches: number }[];
  topConfig: { address: string; launches: number };
  configCount: number;
  recent: RecentLaunch[];
}

export interface Feature { id: string; quoteMint: string; v: number[]; organicRate: number | null; launches: number; threshold: number; startMcap: number | null; migrationMcap: number | null; startFeeBps: number }

export interface Meta {
  generatedAt: number;
  refSlot: number;
  refTime: number;
  totals: { pools: number; configs: number; presets: number; listed: number; detailed: number; organic: number; instant: number; open: number };
  skipped: number;
  partial?: boolean;
}
