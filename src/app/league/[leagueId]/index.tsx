import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import {
  Button,
  Card,
  colors,
  Empty,
  Money,
  moneyColor,
  openColor,
  Muted,
  Screen,
  Segmented,
  SectionTitle,
  StatGrid,
  styles,
} from '../../../components/ui';
import { formatAvg, formatCounts, formatDateLong, formatMoney, formatOpen, todayIso } from '../../../lib/format';
import {
  average,
  daySummary,
  leagueDays,
  leagueMoney,
  leagueParticipants,
  leagueRules,
  memberLeague,
} from '../../../lib/stats';
import { useStore } from '../../../lib/store';

type Tab = 'days' | 'stats' | 'players';

export default function LeagueScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { data, actions } = useStore();
  const [tab, setTab] = useState<Tab>('days');

  const league = data.leagues.find((l) => l.id === leagueId);
  if (!league) return <Empty text="Liga nicht gefunden." />;

  const days = leagueDays(data, league.id);
  const groupMembers = data.members.filter((m) => m.groupId === league.groupId);

  const newDay = () => {
    const today = todayIso();
    const existing = days.find((d) => d.date === today);
    router.push(`/day/${existing?.id ?? actions.addDay(league.id, today)}`);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: league.name }} />
      <Segmented<Tab>
        options={[
          { key: 'days', label: 'Spieltage' },
          { key: 'stats', label: 'Auswertung' },
          { key: 'players', label: `Spieler (${league.memberIds.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'days' && (
        <>
          <MoneyCard leagueId={league.id} />
          <Button title="+ Spieltag heute starten" onPress={newDay} />
          {days.length === 0 && <Empty text="Noch keine Spieltage." />}
          {days.map((d) => {
            const s = daySummary(data, league, d);
            return (
              <Card key={d.id} onPress={() => router.push(`/day/${d.id}`)}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{formatDateLong(d.date)}</Text>
                    <Muted>
                      {s.present} da · {formatCounts(s)} · Ø {formatAvg(s.avg)}
                    </Muted>
                    <Muted>
                      Eingenommen {formatMoney(s.collected)}
                      {s.openIn > 0 ? ` · offen ${formatMoney(s.openIn)}` : ''}
                      {s.openOut > 0 ? ` · auszuzahlen ${formatMoney(s.openOut)}` : ''}
                    </Muted>
                  </View>
                  <Money cents={s.cents} />
                </View>
              </Card>
            );
          })}
        </>
      )}

      {tab === 'stats' && <LeagueStats leagueId={league.id} />}

      {tab === 'players' && (
        <>
          {groupMembers.length === 0 && (
            <Empty text="Die Gruppe hat noch keine Mitglieder. Füge sie in der Gruppe hinzu." />
          )}
          {groupMembers.map((m) => (
            <Card key={m.id}>
              <View style={styles.rowBetween}>
                <Text style={[styles.title, { flex: 1 }]}>{m.name}</Text>
                <Switch
                  value={league.memberIds.includes(m.id)}
                  onValueChange={(v) => actions.setLeagueMember(league.id, m.id, v)}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            </Card>
          ))}
          <Muted>
            Wer aus der Liga genommen wird, behält seine bisherigen Strafen und Ergebnisse in der
            Auswertung.
          </Muted>
        </>
      )}
    </Screen>
  );
}

function MoneyCard({ leagueId }: { leagueId: string }) {
  const { data } = useStore();
  const league = data.leagues.find((l) => l.id === leagueId)!;
  const money = leagueMoney(data, league);
  return (
    <Card>
      <StatGrid
        items={[
          { label: 'Mannschaftsgeld', value: formatMoney(money.collected), color: colors.success },
          { label: 'Noch einzusammeln', value: formatMoney(money.openIn), color: colors.money },
          ...(money.openOut
            ? [{ label: 'Noch auszuzahlen', value: formatMoney(money.openOut), color: colors.success }]
            : []),
        ]}
      />
    </Card>
  );
}

function LeagueStats({ leagueId }: { leagueId: string }) {
  const { data } = useStore();
  const league = data.leagues.find((l) => l.id === leagueId)!;

  const players = leagueParticipants(data, league)
    .map((m) => ({ member: m, s: memberLeague(data, league, m.id) }))
    .sort((a, b) => b.s.cents - a.s.cents);
  const allGames = players.flatMap((p) => p.s.games);
  const totalCents = players.reduce((a, p) => a + p.s.cents, 0);
  const totalViolations = players.reduce((a, p) => a + p.s.violations, 0);
  const totalBonuses = players.reduce((a, p) => a + p.s.bonuses, 0);

  const ruleTotals = leagueRules(data, league)
    .map((rule) => {
      const count = players.reduce(
        (a, p) => a + (p.s.perRule.find((r) => r.rule.id === rule.id)?.count ?? 0),
        0,
      );
      return { rule, count, cents: count * rule.amountCents };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.cents - a.cents);

  return (
    <>
      <MoneyCard leagueId={league.id} />
      <Card>
        <StatGrid
          items={[
            { label: 'Summe gesamt', value: formatMoney(totalCents), color: moneyColor(totalCents) },
            { label: 'Verstöße', value: String(totalViolations) },
            { label: 'Boni', value: String(totalBonuses) },
            { label: 'Ø Liga', value: formatAvg(average(allGames)) },
            { label: 'Spieltage', value: String(leagueDays(data, league.id).length) },
          ]}
        />
      </Card>

      <SectionTitle>Spieler</SectionTitle>
      {players.length === 0 && <Empty text="Noch keine Spieler." />}
      {players.map(({ member, s }) => (
        <Card key={member.id} onPress={() => router.push(`/league/${league.id}/member/${member.id}`)}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{member.name}</Text>
              <Muted>
                {s.attended}/{s.totalDays} Tage da · {formatCounts(s)} · Ø {formatAvg(s.avg)}
              </Muted>
              <Muted style={{ color: openColor(s.open) }}>
                {formatOpen(s.open)}
              </Muted>
            </View>
            <Money cents={s.cents} />
            <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
          </View>
        </Card>
      ))}

      {ruleTotals.length > 0 && (
        <>
          <SectionTitle>Nach Regel</SectionTitle>
          <Card style={{ gap: 8 }}>
            {ruleTotals.map(({ rule, count, cents }) => (
              <View key={rule.id} style={styles.rowBetween}>
                <Text style={{ flex: 1, color: colors.text }}>
                  {count}× {rule.name}
                  {rule.deletedOn ? ' (entfernt)' : ''}
                </Text>
                <Text style={{ color: moneyColor(cents), fontWeight: '600' }}>{formatMoney(cents)}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
