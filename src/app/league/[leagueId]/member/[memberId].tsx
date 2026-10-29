import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import {
  Card,
  colors,
  Empty,
  Money,
  moneyColor,
  openColor,
  Muted,
  Screen,
  SectionTitle,
  StatGrid,
  styles,
} from '../../../../components/ui';
import { formatAvg, formatDateLong, formatMoney, formatOpen } from '../../../../lib/format';
import { memberLeague } from '../../../../lib/stats';
import { useStore } from '../../../../lib/store';

export default function MemberLeagueScreen() {
  const { leagueId, memberId } = useLocalSearchParams<{ leagueId: string; memberId: string }>();
  const { data } = useStore();
  const league = data.leagues.find((l) => l.id === leagueId);
  const member = data.members.find((m) => m.id === memberId);
  if (!league || !member) return <Empty text="Nicht gefunden." />;

  const s = memberLeague(data, league, member.id);

  return (
    <Screen>
      <Stack.Screen options={{ title: `${member.name} · ${league.name}` }} />
      <Card>
        <StatGrid
          items={[
            {
              label: s.open < 0 ? 'Guthaben auszuzahlen' : 'Noch offen',
              value: formatMoney(Math.abs(s.open)),
              color: openColor(s.open),
            },
            { label: 'Beglichen (netto)', value: formatMoney(s.paid), color: colors.success },
            { label: 'Summe gesamt', value: formatMoney(s.cents), color: moneyColor(s.cents) },
            { label: 'Verstöße', value: String(s.violations) },
            { label: 'Boni', value: String(s.bonuses) },
            { label: 'Ø gesamt', value: formatAvg(s.avg) },
            { label: 'Bestes Spiel', value: s.best?.toString() ?? '–' },
            { label: 'Anwesend', value: `${s.attended}/${s.totalDays} Tage` },
            { label: 'Spiele', value: String(s.games.length) },
          ]}
        />
      </Card>

      {s.perRule.length > 0 && (
        <>
          <SectionTitle>Nach Regel</SectionTitle>
          <Card style={{ gap: 8 }}>
            {s.perRule.map(({ rule, count, cents }) => (
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

      <SectionTitle>Nach Spieltag</SectionTitle>
      {s.days.length === 0 && <Empty text="Noch keine Einträge." />}
      {s.days.map((d) => (
        <Card key={d.day.id} onPress={() => router.push(`/day/${d.day.id}?memberId=${member.id}`)}>
          <View style={styles.rowBetween}>
            <Text style={[styles.title, { flex: 1 }]}>{formatDateLong(d.day.date)}</Text>
            <Money cents={d.cents} />
          </View>
          <Muted style={{ marginTop: 4 }}>
            {d.games.length
              ? `Spiele: ${d.games.join(' · ')}  —  Ø ${formatAvg(d.avg)}`
              : 'Keine Ergebnisse eingetragen'}
          </Muted>
          {d.perRule.length > 0 && (
            <Muted style={{ marginTop: 2 }}>
              {d.perRule.map((r) => `${r.count}× ${r.rule.name}`).join(', ')}
            </Muted>
          )}
          {(d.cents !== 0 || d.paid !== null) && (
            <Muted style={{ marginTop: 2, color: openColor(d.open) }}>
              {d.paid === null
                ? formatOpen(d.open)
                : d.open === 0
                  ? `✓ ${d.paid < 0 ? 'ausbezahlt' : 'bezahlt'} (${formatMoney(Math.abs(d.paid))})`
                  : `${formatMoney(d.paid)} beglichen · ${formatOpen(d.open)}`}
            </Muted>
          )}
        </Card>
      ))}
    </Screen>
  );
}
