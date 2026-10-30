import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { db } from './firebase';
import { todayIso } from './format';
import { countKey, scoreKey } from './keys';
import { Data, Group, League, Member, PlayDay, Rule } from './types';

/*
 * Firestore layout (the group code is the group's document id):
 *   groups/{code}                      { name, createdAt }
 *   groups/{code}/members/{id}         { name }
 *   groups/{code}/leagues/{id}         { name, memberIds }
 *   groups/{code}/rules/{id}           { leagueId, name, condition, amountCents, kind, threshold, deletedOn }
 *   groups/{code}/days/{id}            { leagueId, date, attendeeIds }
 *   groups/{code}/entries/{day_member} { dayId, memberId, counts: { ruleId: n }, scores: number[], paidCents? }
 */

const JOINED_KEY = 'strafenkatalog:joined:v2';
const CACHE_KEY = 'strafenkatalog:cache:v2';

type Entry = {
  dayId: string;
  memberId: string;
  counts: Record<string, number>;
  scores: number[];
  paidCents?: number;
};

type GroupState = {
  /** undefined = still loading */
  group?: Group;
  members: Member[];
  leagues: League[];
  rules: Rule[];
  days: PlayDay[];
  entries: Entry[];
};

const emptyGroupState = (): GroupState => ({
  members: [],
  leagues: [],
  rules: [],
  days: [],
  entries: [],
});


const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newGroupCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

/** "rk4f-7q9x" → "RK4F7Q9X" */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** "RK4F7Q9X" → "RK4F-7Q9X" */
export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

const groupRef = (groupId: string) => doc(db(), 'groups', groupId);
const sub = (groupId: string, name: string) => collection(db(), 'groups', groupId, name);
const subDoc = (groupId: string, name: string, id: string) =>
  doc(db(), 'groups', groupId, name, id);
const entryId = (dayId: string, memberId: string) => `${dayId}_${memberId}`;

function run(p: Promise<unknown>) {
  p.catch((e) => console.warn('Speichern fehlgeschlagen', e));
}

const mappers = {
  members: (groupId: string, id: string, r: DocumentData): Member => ({ id, groupId, name: r.name }),
  leagues: (groupId: string, id: string, r: DocumentData): League => ({
    id,
    groupId,
    name: r.name,
    memberIds: r.memberIds ?? [],
  }),
  rules: (groupId: string, id: string, r: DocumentData): Rule => ({
    id,
    groupId,
    // Old "all leagues" rules have no league until migrateGroupRules has split them up
    leagueId: r.leagueId ?? '',
    name: r.name,
    condition: r.condition ?? '',
    amountCents: r.amountCents ?? 0,
    kind: r.kind ?? 'count',
    threshold: r.threshold ?? undefined,
    deletedOn: r.deletedOn ?? undefined,
  }),
  days: (_groupId: string, id: string, r: DocumentData): PlayDay => ({
    id,
    leagueId: r.leagueId,
    date: r.date,
    attendeeIds: r.attendeeIds ?? [],
  }),
  entries: (_groupId: string, _id: string, r: DocumentData): Entry => ({
    dayId: r.dayId,
    memberId: r.memberId,
    counts: r.counts ?? {},
    scores: r.scores ?? [],
    paidCents: r.paidCents ?? undefined,
  }),
};

type Collection = keyof typeof mappers;

/**
 * Rules used to be able to apply to all leagues of a group (leagueId null). Copies each
 * such rule into every league, moves its counts to the copy of the day's league and
 * removes the original. Copy ids derive from the original, so two phones running this
 * at the same time end up with the same result.
 */
async function migrateGroupRules(groupId: string) {
  const rules = await getDocs(sub(groupId, 'rules'));
  const legacy = rules.docs.filter((d) => !d.data().leagueId);
  if (!legacy.length) return;
  const [leagues, days, entries] = await Promise.all(
    ['leagues', 'days', 'entries'].map((name) => getDocs(sub(groupId, name))),
  );
  // Without leagues there is nothing to copy into; try again once one exists
  if (leagues.empty) return;

  const copyId = (ruleId: string, leagueId: string) => `${ruleId}_${leagueId}`;
  const leagueOfDay = new Map(days.docs.map((d) => [d.id, d.data().leagueId as string]));
  const batch = writeBatch(db());
  for (const rule of legacy) {
    for (const l of leagues.docs) {
      batch.set(subDoc(groupId, 'rules', copyId(rule.id, l.id)), { ...rule.data(), leagueId: l.id });
    }
    batch.delete(rule.ref);
  }
  for (const e of entries.docs) {
    const { dayId, counts = {} } = e.data();
    const leagueId = leagueOfDay.get(dayId);
    if (!leagueId) continue;
    const moved: Record<string, unknown> = {};
    for (const rule of legacy) {
      if (counts[rule.id] === undefined) continue;
      moved[rule.id] = deleteField();
      moved[copyId(rule.id, leagueId)] = counts[rule.id];
    }
    if (Object.keys(moved).length) batch.set(e.ref, { counts: moved }, { merge: true });
  }
  await batch.commit();
}

function subscribeGroup(
  groupId: string,
  update: (fn: (s: GroupState) => GroupState) => void,
  onDeleted: () => void,
) {
  migrateGroupRules(groupId).catch((e) => console.warn(`Regeln von ${groupId} umstellen`, e));
  const unsubs = [
    onSnapshot(
      groupRef(groupId),
      (snap) => {
        if (snap.exists()) update((s) => ({ ...s, group: { id: groupId, name: snap.data().name } }));
        else if (!snap.metadata.fromCache) onDeleted();
      },
      (e) => console.warn(`Gruppe ${groupId}`, e),
    ),
    ...(Object.keys(mappers) as Collection[]).map((name) =>
      onSnapshot(
        sub(groupId, name),
        (snap) => {
          const items = snap.docs.map((d) => mappers[name](groupId, d.id, d.data()));
          update((s) => ({ ...s, [name]: items }));
        },
        (e) => console.warn(`${name} von ${groupId}`, e),
      ),
    ),
  ];
  return () => unsubs.forEach((u) => u());
}

function toData(joined: string[], groups: Record<string, GroupState>): Data {
  const d: Data = { groups: [], members: [], leagues: [], rules: [], days: [], counts: {}, scores: {}, paid: {} };
  for (const id of joined) {
    const g = groups[id];
    if (!g?.group) continue;
    d.groups.push(g.group);
    d.members.push(...g.members);
    d.leagues.push(...g.leagues);
    d.rules.push(...g.rules);
    d.days.push(...g.days);
    for (const e of g.entries) {
      for (const [ruleId, n] of Object.entries(e.counts)) {
        if (n > 0) d.counts[countKey(e.dayId, e.memberId, ruleId)] = n;
      }
      if (e.scores.length) d.scores[scoreKey(e.dayId, e.memberId)] = e.scores;
      if (e.paidCents !== undefined) d.paid[scoreKey(e.dayId, e.memberId)] = e.paidCents;
    }
  }
  d.members.sort((a, b) => a.name.localeCompare(b.name));
  d.leagues.sort((a, b) => a.name.localeCompare(b.name));
  d.rules.sort((a, b) => a.name.localeCompare(b.name));
  return d;
}

export type RuleInput = Omit<Rule, 'id' | 'deletedOn'>;

type Ctx = {
  data: Data;
  joined: string[];
  setJoined: (fn: (ids: string[]) => string[]) => void;
  seed: (groupId: string, group: Group) => void;
};

function createActions(get: () => Ctx) {
  const groupOfLeague = (leagueId: string) =>
    get().data.leagues.find((l) => l.id === leagueId)?.groupId;
  const groupOfDay = (dayId: string) => {
    const day = get().data.days.find((d) => d.id === dayId);
    return day && groupOfLeague(day.leagueId);
  };
  const leave = (groupId: string) => get().setJoined((ids) => ids.filter((i) => i !== groupId));

  /** Deletes many docs in batches (Firestore allows 500 writes per batch). */
  async function deleteAll(refs: ReturnType<typeof doc>[]) {
    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(db());
      refs.slice(i, i + 450).forEach((r) => batch.delete(r));
      await batch.commit();
    }
  }

  const dayDocs = (groupId: string, dayIds: Set<string>) => {
    const { data } = get();
    const memberIds = data.members.filter((m) => m.groupId === groupId).map((m) => m.id);
    return [...dayIds].flatMap((dayId) => [
      subDoc(groupId, 'days', dayId),
      ...memberIds.map((m) => subDoc(groupId, 'entries', entryId(dayId, m))),
    ]);
  };

  return {
    // Groups
    addGroup(name: string) {
      const code = newGroupCode();
      run(setDoc(groupRef(code), { name, createdAt: serverTimestamp() }));
      get().seed(code, { id: code, name });
      get().setJoined((ids) => [...ids, code]);
      return code;
    },
    /** Resolves to the normalized code, or null if no such group exists. */
    async joinGroup(input: string): Promise<string | null> {
      const code = normalizeCode(input);
      if (code.length < 8) return null;
      const snap = await getDoc(groupRef(code));
      if (!snap.exists()) return null;
      get().seed(code, { id: code, name: snap.data().name });
      get().setJoined((ids) => (ids.includes(code) ? ids : [...ids, code]));
      return code;
    },
    renameGroup(id: string, name: string) {
      run(updateDoc(groupRef(id), { name }));
    },
    /** Only removes the group from this phone. */
    leaveGroup: leave,
    /** Deletes the group for everyone. */
    deleteGroup(id: string) {
      const { data } = get();
      const leagueIds = new Set(data.leagues.filter((l) => l.groupId === id).map((l) => l.id));
      const dayIds = new Set(data.days.filter((d) => leagueIds.has(d.leagueId)).map((d) => d.id));
      const refs = [
        ...dayDocs(id, dayIds),
        ...data.members.filter((m) => m.groupId === id).map((m) => subDoc(id, 'members', m.id)),
        ...[...leagueIds].map((l) => subDoc(id, 'leagues', l)),
        ...data.rules.filter((r) => r.groupId === id).map((r) => subDoc(id, 'rules', r.id)),
      ];
      leave(id);
      run(deleteAll(refs).then(() => deleteDoc(groupRef(id))));
    },

    // Members
    addMember(groupId: string, name: string) {
      const ref = doc(sub(groupId, 'members'));
      run(setDoc(ref, { name }));
      return ref.id;
    },
    renameMember(id: string, name: string) {
      const m = get().data.members.find((x) => x.id === id);
      if (m) run(updateDoc(subDoc(m.groupId, 'members', id), { name }));
    },
    deleteMember(id: string) {
      const { data } = get();
      const m = data.members.find((x) => x.id === id);
      if (!m) return;
      const g = m.groupId;
      const batch = writeBatch(db());
      batch.delete(subDoc(g, 'members', id));
      for (const l of data.leagues.filter((x) => x.groupId === g && x.memberIds.includes(id))) {
        batch.update(subDoc(g, 'leagues', l.id), { memberIds: arrayRemove(id) });
      }
      const leagueIds = new Set(data.leagues.filter((l) => l.groupId === g).map((l) => l.id));
      for (const d of data.days.filter((x) => leagueIds.has(x.leagueId))) {
        batch.delete(subDoc(g, 'entries', entryId(d.id, id)));
        if (d.attendeeIds?.includes(id)) {
          batch.update(subDoc(g, 'days', d.id), { attendeeIds: arrayRemove(id) });
        }
      }
      run(batch.commit());
    },

    // Leagues
    addLeague(groupId: string, name: string) {
      const ref = doc(sub(groupId, 'leagues'));
      const memberIds = get()
        .data.members.filter((m) => m.groupId === groupId)
        .map((m) => m.id);
      run(setDoc(ref, { name, memberIds }));
      return ref.id;
    },
    renameLeague(id: string, name: string) {
      const g = groupOfLeague(id);
      if (g) run(updateDoc(subDoc(g, 'leagues', id), { name }));
    },
    deleteLeague(id: string) {
      const { data } = get();
      const g = groupOfLeague(id);
      if (!g) return;
      const dayIds = new Set(data.days.filter((d) => d.leagueId === id).map((d) => d.id));
      run(
        deleteAll([
          ...dayDocs(g, dayIds),
          ...data.rules.filter((r) => r.leagueId === id).map((r) => subDoc(g, 'rules', r.id)),
          subDoc(g, 'leagues', id),
        ]),
      );
    },
    setLeagueMember(leagueId: string, memberId: string, inLeague: boolean) {
      const g = groupOfLeague(leagueId);
      if (!g) return;
      run(
        updateDoc(subDoc(g, 'leagues', leagueId), {
          memberIds: inLeague ? arrayUnion(memberId) : arrayRemove(memberId),
        }),
      );
    },

    // Rules
    saveRule(rule: RuleInput, id?: string) {
      const { groupId, ...fields } = rule;
      const ref = id ? subDoc(groupId, 'rules', id) : doc(sub(groupId, 'rules'));
      const existing = get().data.rules.find((r) => r.id === id);
      run(
        setDoc(ref, {
          ...fields,
          threshold: fields.threshold ?? null,
          deletedOn: existing?.deletedOn ?? null,
        }),
      );
    },
    /** Soft delete: past play days keep their penalties. */
    deleteRule(id: string) {
      const r = get().data.rules.find((x) => x.id === id);
      if (r) run(updateDoc(subDoc(r.groupId, 'rules', id), { deletedOn: todayIso() }));
    },

    // Play days
    addDay(leagueId: string, date: string) {
      const league = get().data.leagues.find((l) => l.id === leagueId);
      if (!league) throw new Error('Liga nicht gefunden');
      const ref = doc(sub(league.groupId, 'days'));
      run(setDoc(ref, { leagueId, date, attendeeIds: league.memberIds }));
      return ref.id;
    },
    setDayDate(id: string, date: string) {
      const g = groupOfDay(id);
      if (g) run(updateDoc(subDoc(g, 'days', id), { date }));
    },
    deleteDay(id: string) {
      const g = groupOfDay(id);
      if (g) run(deleteAll(dayDocs(g, new Set([id]))));
    },
    /** Marking someone absent also clears their penalties and scores of that day. */
    setPresent(dayId: string, memberId: string, present: boolean) {
      const g = groupOfDay(dayId);
      if (!g) return;
      const batch = writeBatch(db());
      batch.update(subDoc(g, 'days', dayId), {
        attendeeIds: present ? arrayUnion(memberId) : arrayRemove(memberId),
      });
      if (!present) batch.delete(subDoc(g, 'entries', entryId(dayId, memberId)));
      run(batch.commit());
    },

    // Entries
    /** Applied as an atomic increment so taps from several phones add up. */
    setCount(dayId: string, memberId: string, ruleId: string, count: number) {
      const g = groupOfDay(dayId);
      if (!g) return;
      const delta = count - (get().data.counts[countKey(dayId, memberId, ruleId)] ?? 0);
      if (!delta) return;
      run(
        setDoc(
          subDoc(g, 'entries', entryId(dayId, memberId)),
          { dayId, memberId, counts: { [ruleId]: increment(delta) } },
          { merge: true },
        ),
      );
    },
    setScores(dayId: string, memberId: string, games: number[]) {
      const g = groupOfDay(dayId);
      if (!g) return;
      run(
        setDoc(
          subDoc(g, 'entries', entryId(dayId, memberId)),
          { dayId, memberId, scores: games },
          { merge: true },
        ),
      );
    },
    /** cents = amount paid for that day; null = mark as not paid */
    setPaid(dayId: string, memberId: string, cents: number | null) {
      const g = groupOfDay(dayId);
      if (!g) return;
      run(
        setDoc(
          subDoc(g, 'entries', entryId(dayId, memberId)),
          { dayId, memberId, paidCents: cents ?? deleteField() },
          { merge: true },
        ),
      );
    },
  };
}

export type Actions = ReturnType<typeof createActions>;

const StoreContext = createContext<{ data: Data; actions: Actions } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [joined, setJoinedState] = useState<string[] | null>(null);
  const [groups, setGroups] = useState<Record<string, GroupState>>({});
  const subscriptions = useRef(new Map<string, () => void>());

  // Load joined groups and the last known data, so the app opens instantly.
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(JOINED_KEY), AsyncStorage.getItem(CACHE_KEY)])
      .then(([j, c]) => {
        if (c) setGroups(JSON.parse(c));
        setJoinedState(j ? JSON.parse(j) : []);
      })
      .catch((e) => {
        console.warn('Lokale Daten konnten nicht geladen werden', e);
        setJoinedState([]);
      });
  }, []);

  useEffect(() => {
    if (joined) run(AsyncStorage.setItem(JOINED_KEY, JSON.stringify(joined)));
  }, [joined]);

  useEffect(() => {
    if (joined) run(AsyncStorage.setItem(CACHE_KEY, JSON.stringify(groups)));
  }, [groups, joined]);

  // Live subscriptions: one set of listeners per joined group.
  useEffect(() => {
    if (!joined) return;
    const subs = subscriptions.current;
    for (const id of joined) {
      if (subs.has(id)) continue;
      subs.set(
        id,
        subscribeGroup(
          id,
          (fn) => setGroups((all) => ({ ...all, [id]: fn(all[id] ?? emptyGroupState()) })),
          () => setJoinedState((ids) => (ids ?? []).filter((x) => x !== id)),
        ),
      );
    }
    for (const [id, unsub] of subs) {
      if (joined.includes(id)) continue;
      unsub();
      subs.delete(id);
      setGroups(({ [id]: _, ...rest }) => rest);
    }
  }, [joined]);

  useEffect(() => {
    const subs = subscriptions.current;
    return () => {
      subs.forEach((u) => u());
      subs.clear();
    };
  }, []);

  const data = useMemo(() => toData(joined ?? [], groups), [joined, groups]);

  const ctxRef = useRef<Ctx>(null!);
  ctxRef.current = {
    data,
    joined: joined ?? [],
    setJoined: (fn) => setJoinedState((ids) => fn(ids ?? [])),
    seed: (id, group) =>
      setGroups((all) => ({ ...all, [id]: { ...(all[id] ?? emptyGroupState()), group } })),
  };

  const actions = useMemo(() => createActions(() => ctxRef.current), []);
  const value = useMemo(() => ({ data, actions }), [data, actions]);

  if (!joined) return null;
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
