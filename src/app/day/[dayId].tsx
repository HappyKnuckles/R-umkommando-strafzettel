import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  colors,
  confirm,
  Empty,
  Input,
  moneyColor,
  openColor,
  Muted,
  notify,
  Screen,
  SectionTitle,
  StatGrid,
  styles,
} from '../../components/ui';
import {
  formatAvg,
  formatCounts,
  formatDate,
  formatDateLong,
  formatMoney,
  parseDate,
  shiftIso,
} from '../../lib/format';
import {
  attendeeIds,
  daySummary,
  gamesOf,
  hasEntries,
  isAutomatic,
  leagueRules,
  memberDay,
  Payment,
  ruleCount,
  thresholdLabel,
} from '../../lib/stats';
import { useStore } from '../../lib/store';
import { Member, PlayDay, Rule } from '../../lib/types';

export default function DayScreen() {
  const { dayId, memberId: initialMember } = useLocalSearchParams<{
    dayId: string;
    memberId?: string;
  }>();
  const { data, actions } = useStore();
  const day = data.days.find((d) => d.id === dayId);
  const league = data.leagues.find((l) => l.id === day?.leagueId);

  const [dateText, setDateText] = useState(day ? formatDate(day.date) : '');
  const [selected, setSelected] = useState<string | undefined>(initialMember);
  const [scoreText, setScoreText] = useState('');
  const [editAttendance, setEditAttendance] = useState(
    () => !Object.keys({ ...data.counts, ...data.scores }).some((k) => k.startsWith(`${dayId}:`)),
  );

  useEffect(() => {
    if (day) setDateText(formatDate(day.date));
  }, [day?.date]);

  if (!day || !league) return <Empty text="Spieltag nicht gefunden." />;

  const rules = leagueRules(data, league);
  const present = attendeeIds(day, league);
  const candidates = data.members.filter(
    (m) =>
      m.groupId === league.groupId &&
      (league.memberIds.includes(m.id) || present.includes(m.id)),
  );
  const players = candidates.filter(
    (m) => present.includes(m.id) || hasEntries(data, day.id, m.id),
  );

  const togglePresent = (memberId: string, name: string) => {
    if (!present.includes(memberId)) return actions.setPresent(day.id, memberId, true);
    if (!hasEntries(data, day.id, memberId)) return actions.setPresent(day.id, memberId, false);
    confirm(
      `${name} als abwesend markieren?`,
      'Strafen, Ergebnisse und Zahlung von diesem Spieltag werden dabei gelöscht.',
      () => actions.setPresent(day.id, memberId, false),
      'Abwesend',
    );
  };
  const current = players.find((p) => p.id === selected) ?? players[0];
  const summary = daySummary(data, league, day);

  const commitDate = () => {
    const iso = parseDate(dateText);
    if (!iso) {
      notify('Ungültiges Datum', 'Bitte im Format TT.MM.JJJJ eingeben.');
      setDateText(formatDate(day.date));
      return;
    }
    actions.setDayDate(day.id, iso);
  };

  const addScores = () => {
    if (!current) return;
    const values = scoreText
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map((v) => Number(v));
    if (!values.length) return;
    if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 9999)) {
      notify('Ungültiges Ergebnis', 'Bitte ganze Zahlen eingeben, z.B. „145“ oder „145 162 133“.');
      return;
    }
    actions.setScores(day.id, current.id, [...gamesOf(data, day.id, current.id), ...values]);
    setScoreText('');
  };

  const removeScore = (index: number) => {
    if (!current) return;
    const games = gamesOf(data, day.id, current.id);
    actions.setScores(day.id, current.id, games.filter((_, i) => i !== index));
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: formatDateLong(day.date) }} />

      <Card>
        <Muted>{league.name}</Muted>
        <View style={[styles.row, { marginTop: 6 }]}>
          <Button
            title="‹"
            variant="secondary"
            small
            onPress={() => actions.setDayDate(day.id, shiftIso(day.date, -1))}
          />
          <Input
            value={dateText}
            onChangeText={setDateText}
            onBlur={commitDate}
            onSubmitEditing={commitDate}
            placeholder="TT.MM.JJJJ"
            keyboardType="numbers-and-punctuation"
            style={{ flex: 1, textAlign: 'center' }}
          />
          <Button
            title="›"
            variant="secondary"
            small
            onPress={() => actions.setDayDate(day.id, shiftIso(day.date, 1))}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>
            Wer ist da? ({present.length}/{candidates.length})
          </Text>
          <Button
            title={editAttendance ? 'Fertig' : 'Ändern'}
            variant="ghost"
            small
            onPress={() => setEditAttendance(!editAttendance)}
          />
        </View>
        {editAttendance ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {candidates.map((m) => (
              <Chip
                key={m.id}
                label={present.includes(m.id) ? `✓ ${m.name}` : m.name}
                active={present.includes(m.id)}
                onPress={() => togglePresent(m.id, m.name)}
              />
            ))}
            {candidates.length === 0 && (
              <Muted>Keine Spieler in dieser Liga. Füge sie in der Liga unter „Spieler“ hinzu.</Muted>
            )}
          </View>
        ) : (
          <Muted style={{ marginTop: 4 }}>
            {candidates.filter((m) => !present.includes(m.id)).length
              ? `Fehlt: ${candidates
                  .filter((m) => !present.includes(m.id))
                  .map((m) => m.name)
                  .join(', ')}`
              : 'Alle da'}
          </Muted>
        )}
      </Card>

      <Card>
        <StatGrid
          items={[
            { label: 'Mannschaftsgeld heute', value: formatMoney(summary.collected), color: colors.success },
            { label: 'Noch einzusammeln', value: formatMoney(summary.openIn), color: colors.money },
            ...(summary.openOut
              ? [{ label: 'Noch auszuzahlen', value: formatMoney(summary.openOut), color: colors.success }]
              : []),
            { label: 'Summe heute', value: formatMoney(summary.cents), color: moneyColor(summary.cents) },
            { label: 'Verstöße / Boni', value: `${summary.violations} / ${summary.bonuses}` },
            { label: 'Ø des Tages', value: formatAvg(summary.avg) },
            { label: 'Spiele', value: String(summary.games) },
          ]}
        />
      </Card>

      {players.length === 0 ? (
        <Empty text="Niemand als anwesend markiert." />
      ) : (
        <>
          <SectionTitle>Strafen</SectionTitle>
          <Card>
            <PenaltyGrid day={day} players={players} rules={rules} />
          </Card>

          <SectionTitle>Ergebnisse</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {players.map((p) => {
                const s = memberDay(data, rules, day, p.id);
                const paidMark = s.paid !== null && s.open === 0 ? ' ✓' : '';
                return (
                  <Chip
                    key={p.id}
                    label={s.cents ? `${p.name} · ${formatMoney(s.cents)}${paidMark}` : p.name}
                    active={p.id === current?.id}
                    onPress={() => setSelected(p.id)}
                  />
                );
              })}
            </View>
          </ScrollView>
        </>
      )}

      {current && (
        <Card>
          <Text style={styles.title}>Ergebnisse von {current.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>
            {gamesOf(data, day.id, current.id).map((g, i) => (
              <Pressable
                key={i}
                onPress={() => removeScore(i)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.primarySoft,
                  borderRadius: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ fontWeight: '700', color: colors.primary, fontSize: 16 }}>{g}</Text>
                <Text style={{ color: colors.muted }}>✕</Text>
              </Pressable>
            ))}
            {gamesOf(data, day.id, current.id).length === 0 && (
              <Muted>Noch keine Spiele eingetragen.</Muted>
            )}
          </View>
          <View style={styles.row}>
            <Input
              value={scoreText}
              onChangeText={setScoreText}
              placeholder="Ergebnis, z.B. 145"
              keyboardType="numbers-and-punctuation"
              onSubmitEditing={addScores}
              returnKeyType="done"
              style={{ flex: 1 }}
            />
            <Button title="+" onPress={addScores} disabled={!scoreText.trim()} style={{ minWidth: 48 }} />
          </View>
          <Muted style={{ marginTop: 8 }}>
            Ø heute: {formatAvg(memberDay(data, rules, day, current.id).avg)} · Tippe auf ein
            Ergebnis, um es zu löschen.
          </Muted>
        </Card>
      )}

      {players.length > 0 && (
        <>
          <SectionTitle>Übersicht des Tages</SectionTitle>
          <Card style={{ gap: 10 }}>
            {players.map((p) => {
              const s = memberDay(data, rules, day, p.id);
              return (
                <Pressable key={p.id} onPress={() => setSelected(p.id)} style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, color: colors.text, fontWeight: '600' }}>{p.name}</Text>
                    <Muted>
                      {s.games.length} Spiele · Ø {formatAvg(s.avg)} · {formatCounts(s)}
                    </Muted>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: moneyColor(s.cents), fontWeight: '700' }}>
                      {formatMoney(s.cents)}
                    </Text>
                    <PaidPill s={s} onChange={(cents) => actions.setPaid(day.id, p.id, cents)} />
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </>
      )}

      <Button
        title="Spieltag löschen"
        variant="danger"
        onPress={() =>
          confirm(
            'Spieltag löschen?',
            'Alle Strafen, Ergebnisse und Zahlungen dieses Spieltags werden gelöscht.',
            () => {
              router.back();
              actions.deleteDay(day.id);
            },
          )
        }
      />
    </Screen>
  );
}

type PayProps = { s: Payment & { cents: number }; onChange: (cents: number | null) => void };

function pillLabel(s: PayProps['s']): string {
  const done = s.paid !== null && s.open === 0;
  if (done) return s.paid! < 0 ? '✓ ausbezahlt' : '✓ bezahlt';
  if (s.paid === null) return s.cents > 0 ? 'offen' : 'auszahlen';
  return s.open > 0
    ? `${formatMoney(s.open)} nachzahlen`
    : `${formatMoney(-s.open)} zurückgeben`;
}

/**
 * Tap to settle the day's net amount (pay in, or pay out a credit), tap again to undo.
 * If the amount changed after settling, tapping settles the difference.
 */
function PaidPill({ s, onChange }: PayProps) {
  if (s.paid === null && s.cents === 0) return null;
  const done = s.paid !== null && s.open === 0;
  const label = pillLabel(s);
  const color = openColor(done ? 0 : s.open);
  return (
    <Pressable
      onPress={() => onChange(done || s.cents === 0 ? null : s.cents)}
      hitSlop={6}
      style={({ pressed }) => ({
        borderWidth: 1.5,
        borderColor: color,
        backgroundColor: done ? color : 'transparent',
        borderRadius: 999,
        paddingVertical: 3,
        paddingHorizontal: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: done ? '#fff' : color, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const NAME_WIDTH = 116;
const COL_WIDTH = 52;
const ROW_HEIGHT = 50;

/**
 * Rules down the side, players across the top: tap a cell to add one, hold it to take one
 * away. Automatic rules are only shown, they follow from the entered scores. The rule
 * column stays put while the player columns scroll sideways when they don't fit.
 */
function PenaltyGrid({ day, players, rules }: { day: PlayDay; players: Member[]; rules: Rule[] }) {
  const { data, actions } = useStore();
  const shown = rules.filter(
    (r) => !r.deletedOn || players.some((p) => ruleCount(data, r, day, p.id) > 0),
  );
  if (!shown.length) {
    return <Muted>Keine Regeln. Lege den Strafkatalog in der Liga unter „Regeln“ an.</Muted>;
  }

  return (
    <>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: NAME_WIDTH }}>
          <View style={grid.header} />
          {shown.map((rule) => (
            <View key={rule.id} style={grid.name}>
              <Text numberOfLines={1} style={grid.ruleName}>
                {rule.name}
                {rule.deletedOn ? ' (entfernt)' : ''}
              </Text>
              <Text numberOfLines={1} style={styles.muted}>
                {formatMoney(rule.amountCents)}
                {isAutomatic(rule) ? ` · ${thresholdLabel(rule)}` : ''}
              </Text>
            </View>
          ))}
          <View style={[grid.name, grid.totalRow]}>
            <Text style={grid.ruleName}>Summe</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View>
            <View style={grid.row}>
              {players.map((p) => (
                <View key={p.id} style={[grid.cell, grid.header]}>
                  <Text numberOfLines={1} style={grid.playerName}>
                    {p.name}
                  </Text>
                </View>
              ))}
            </View>
            {shown.map((rule) => (
              <View key={rule.id} style={grid.row}>
                {players.map((p) => (
                  <GridCell
                    key={p.id}
                    count={ruleCount(data, rule, day, p.id)}
                    color={moneyColor(rule.amountCents)}
                    automatic={isAutomatic(rule)}
                    onChange={(n) => actions.setCount(day.id, p.id, rule.id, n)}
                  />
                ))}
              </View>
            ))}
            <View style={[grid.row, grid.totalRow]}>
              {players.map((p) => {
                const cents = memberDay(data, rules, day, p.id).cents;
                return (
                  <View key={p.id} style={grid.cell}>
                    <Text style={[grid.total, { color: cents ? moneyColor(cents) : colors.muted }]}>
                      {cents ? formatMoney(cents) : '–'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
      <Muted style={{ marginTop: 8 }}>Tippen: +1 · Gedrückt halten: −1</Muted>
    </>
  );
}

function GridCell({
  count,
  color,
  automatic,
  onChange,
}: {
  count: number;
  color: string;
  automatic: boolean;
  onChange: (n: number) => void;
}) {
  if (automatic) {
    return (
      <View style={grid.cell}>
        <Text style={[grid.count, { color: count ? color : colors.border }]}>{count || '·'}</Text>
      </View>
    );
  }
  return (
    <View style={grid.cell}>
      <Pressable
        onPress={() => onChange(count + 1)}
        onLongPress={() => count > 0 && onChange(count - 1)}
        delayLongPress={350}
        style={({ pressed }) => [
          grid.tap,
          count > 0 && { backgroundColor: color, borderColor: color },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text style={[grid.count, { color: count ? '#fff' : colors.muted }]}>{count || '+'}</Text>
      </Pressable>
    </View>
  );
}

const grid = StyleSheet.create({
  row: { flexDirection: 'row' },
  header: { height: 32, justifyContent: 'flex-end', paddingBottom: 6 },
  name: { height: ROW_HEIGHT, justifyContent: 'center', paddingRight: 8 },
  cell: { width: COL_WIDTH, height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  tap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleName: { fontSize: 15, fontWeight: '600', color: colors.text },
  playerName: { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center', paddingHorizontal: 2 },
  count: { fontSize: 17, fontWeight: '700' },
  totalRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  total: { fontSize: 12, fontWeight: '700' },
});
