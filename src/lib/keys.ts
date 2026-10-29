export const countKey = (dayId: string, memberId: string, ruleId: string) =>
  `${dayId}:${memberId}:${ruleId}`;
export const scoreKey = (dayId: string, memberId: string) => `${dayId}:${memberId}`;
