import { countKey, scoreKey } from './keys';
import { Data, League, Member, PlayDay, Rule } from './types';

export type RuleCount = { rule: Rule; count: number; cents: number };

export type Summary = {
  games: number[];
  avg: number | null;
  perRule: RuleCount[];
  /** Counts of penalty rules (amount ≥ 0) */
  violations: number;
  /** Counts of credit rules (amount < 0) */
  bonuses: number;
  /** Net amount; negative = credit */
  cents: number;
};

/**
 * Settlement of one member's net amount (`cents`) with the team cash box.
 * All values are signed: positive = money towards the box, negative = paid out of it.
 */
export type Payment = {
  /** Amount settled (paid in, or paid out if negative); null = not settled */
  paid: number | null;
  /** Still to settle: > 0 member owes the box, < 0 box owes the member */
  open: number;
};

export type DaySummary = Summary & Payment & { day: PlayDay };

export function average(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/** All rules of this league, including removed ones. */
export function leagueRules(data: Data, league: League): Rule[] {
  return data.rules.filter((r) => r.leagueId === league.id);
}

export function leagueDays(data: Data, leagueId: string): PlayDay[] {
  return data.days
    .filter((d) => d.leagueId === leagueId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function attendeeIds(day: PlayDay, league: League): string[] {
  return day.attendeeIds ?? league.memberIds;
}

export function gamesOf(data: Data, dayId: string, memberId: string): number[] {
  return data.scores[scoreKey(dayId, memberId)] ?? [];
}

export function ruleCount(data: Data, rule: Rule, day: PlayDay, memberId: string): number {
  if (isAutomatic(rule)) {
    const league = data.leagues.find((l) => l.id === day.leagueId);
    if (!league) return 0;
    const tiers = leagueRules(data, league).filter(
      (r) => r.kind === rule.kind && activeOn(r, day),
    );
    return gamesOf(data, day.id, memberId).filter((g) => tierFor(tiers, g)?.id === rule.id)
      .length;
  }
  return data.counts[countKey(day.id, memberId, rule.id)] ?? 0;
}

/** A removed automatic rule only counts on days before it was removed. */
function activeOn(rule: Rule, day: PlayDay): boolean {
  return !rule.deletedOn || day.date < rule.deletedOn;
}

/**
 * Only the most specific level applies to a game: "unter 160" beats "unter 180",
 * "ab 250" beats "ab 200". `tiers` are rules of one automatic kind.
 */
function tierFor(tiers: Rule[], score: number): Rule | undefined {
  let best: Rule | undefined;
  for (const r of tiers) {
    const t = r.threshold ?? 0;
    const below = r.kind === 'scoreBelow';
    if (below ? score >= t : score < t) continue;
    const bestT = best?.threshold ?? 0;
    if (!best || (below ? t < bestT : t > bestT)) best = r;
  }
  return best;
}

export function isAutomatic(rule: Rule): boolean {
  return rule.kind === 'scoreBelow' || rule.kind === 'scoreAbove';
}

/** "unter 100" / "ab 200" for automatic rules, '' for manual ones */
export function thresholdLabel(rule: Rule): string {
  if (rule.kind === 'scoreBelow') return `unter ${rule.threshold}`;
  if (rule.kind === 'scoreAbove') return `ab ${rule.threshold}`;
  return '';
}

function summarize(games: number[], perRule: RuleCount[]): Summary {
  const nonZero = perRule.filter((r) => r.count > 0);
  return {
    games,
    avg: average(games),
    perRule: nonZero,
    violations: nonZero.filter((r) => r.rule.amountCents >= 0).reduce((a, r) => a + r.count, 0),
    bonuses: nonZero.filter((r) => r.rule.amountCents < 0).reduce((a, r) => a + r.count, 0),
    cents: nonZero.reduce((a, r) => a + r.cents, 0),
  };
}

export function memberDay(
  data: Data,
  rules: Rule[],
  day: PlayDay,
  memberId: string,
): DaySummary {
  const perRule = rules.map((rule) => {
    const count = ruleCount(data, rule, day, memberId);
    return { rule, count, cents: count * rule.amountCents };
  });
  const summary = summarize(gamesOf(data, day.id, memberId), perRule);
  const paid = data.paid[scoreKey(day.id, memberId)] ?? null;
  return { ...summary, day, paid, open: summary.cents - (paid ?? 0) };
}

const sum = <T,>(items: T[], pick: (t: T) => number) => items.reduce((a, t) => a + pick(t), 0);

/** Splits signed open amounts into "still to collect" and "still to pay out". */
function splitOpen(opens: number[]) {
  return {
    openIn: sum(opens, (o) => Math.max(0, o)),
    openOut: sum(opens, (o) => Math.max(0, -o)),
  };
}

export function memberLeague(data: Data, league: League, memberId: string) {
  const rules = leagueRules(data, league);
  const allDays = leagueDays(data, league.id);
  const attended = allDays.filter((d) => attendeeIds(d, league).includes(memberId)).length;
  const days = allDays.map((day) => memberDay(data, rules, day, memberId));
  const perRule = rules.map((rule) => {
    const count = days.reduce(
      (a, d) => a + (d.perRule.find((r) => r.rule.id === rule.id)?.count ?? 0),
      0,
    );
    return { rule, count, cents: count * rule.amountCents };
  });
  const games = days.flatMap((d) => d.games);
  return {
    ...summarize(games, perRule),
    best: games.length ? Math.max(...games) : null,
    attended,
    totalDays: allDays.length,
    paid: sum(days, (d) => d.paid ?? 0),
    open: sum(days, (d) => d.open),
    days: days.filter(
      (d) =>
        d.games.length ||
        d.violations ||
        d.bonuses ||
        d.paid !== null ||
        attendeeIds(d.day, league).includes(memberId),
    ),
  };
}

export function hasEntries(data: Data, dayId: string, memberId: string): boolean {
  const key = scoreKey(dayId, memberId);
  if (data.scores[key] || data.paid[key] !== undefined) return true;
  const prefix = `${dayId}:${memberId}:`;
  return Object.keys(data.counts).some((k) => k.startsWith(prefix));
}

/** Current league members plus former members who still have entries in this league. */
export function leagueParticipants(data: Data, league: League): Member[] {
  const dayIds = leagueDays(data, league.id).map((d) => d.id);
  return data.members.filter(
    (m) =>
      m.groupId === league.groupId &&
      (league.memberIds.includes(m.id) || dayIds.some((d) => hasEntries(data, d, m.id))),
  );
}

export function daySummary(data: Data, league: League, day: PlayDay) {
  const rules = leagueRules(data, league);
  const members = leagueParticipants(data, league).map((m) => memberDay(data, rules, day, m.id));
  const games = members.flatMap((m) => m.games);
  return {
    present: attendeeIds(day, league).length,
    avg: average(games),
    games: games.length,
    violations: sum(members, (m) => m.violations),
    bonuses: sum(members, (m) => m.bonuses),
    cents: sum(members, (m) => m.cents),
    /** Mannschaftsgeld of this day: paid in minus paid out */
    collected: sum(members, (m) => m.paid ?? 0),
    ...splitOpen(members.map((m) => m.open)),
  };
}

/** Mannschaftsgeld of a league (paid in minus paid out) and what is still open per member. */
export function leagueMoney(data: Data, league: League) {
  const players = leagueParticipants(data, league).map((m) => memberLeague(data, league, m.id));
  return {
    cents: sum(players, (p) => p.cents),
    collected: sum(players, (p) => p.paid),
    ...splitOpen(players.map((p) => p.open)),
  };
}

/** A member's totals across all leagues of their group. */
export function memberTotals(data: Data, memberId: string) {
  const member = data.members.find((m) => m.id === memberId);
  const leagues = data.leagues.filter((l) => l.groupId === member?.groupId);
  const per = leagues.map((l) => memberLeague(data, l, memberId));
  return {
    cents: sum(per, (p) => p.cents),
    paid: sum(per, (p) => p.paid),
    open: sum(per, (p) => p.open),
  };
}
