export type Group = { id: string; name: string };

export type Member = { id: string; groupId: string; name: string };

export type League = {
  id: string;
  groupId: string;
  name: string;
  memberIds: string[];
};

/**
 * count:      counted by hand on each play day (e.g. "Pudel")
 * scoreBelow: counted automatically, once per game whose score is below `threshold`
 * scoreAbove: counted automatically, once per game whose score is at least `threshold`
 */
export type RuleKind = 'count' | 'scoreBelow' | 'scoreAbove';

export type Rule = {
  id: string;
  groupId: string;
  leagueId: string;
  name: string;
  condition: string;
  amountCents: number;
  kind: RuleKind;
  threshold?: number;
  /** Removed rules are kept so past penalties still add up; ISO date of removal */
  deletedOn?: string;
};

export type PlayDay = {
  id: string;
  leagueId: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Members present on this day; undefined (older data) = all league members */
  attendeeIds?: string[];
};

export type Data = {
  groups: Group[];
  members: Member[];
  leagues: League[];
  rules: Rule[];
  days: PlayDay[];
  /** key: dayId:memberId:ruleId → number of violations */
  counts: Record<string, number>;
  /** key: dayId:memberId → game scores of that day */
  scores: Record<string, number[]>;
  /** key: dayId:memberId → amount actually paid for that day (set = marked as paid) */
  paid: Record<string, number>;
};
