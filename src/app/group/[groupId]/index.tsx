import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  AddRow,
  Button,
  Card,
  colors,
  confirm,
  Empty,
  IconButton,
  Money,
  Muted,
  openColor,
  Screen,
  Segmented,
  SectionTitle,
  StatGrid,
  styles,
  TextPrompt,
} from '../../../components/ui';
import { formatMoney, formatOpen } from '../../../lib/format';
import {
  isAutomatic,
  leagueDays,
  leagueMoney,
  memberTotals,
  thresholdLabel,
} from '../../../lib/stats';
import { shareGroup } from '../../../lib/share';
import { formatCode, useStore } from '../../../lib/store';
import { Rule } from '../../../lib/types';

type Tab = 'leagues' | 'members' | 'rules';

export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data, actions } = useStore();
  const [tab, setTab] = useState<Tab>('leagues');
  const [renaming, setRenaming] = useState<{ kind: 'member' | 'league'; id: string; name: string } | null>(null);

  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return <Empty text="Gruppe nicht gefunden." />;

  const members = data.members.filter((m) => m.groupId === group.id);
  const leagues = data.leagues.filter((l) => l.groupId === group.id);
  const rules = data.rules.filter((r) => r.groupId === group.id && !r.deletedOn);
  const groupMoney = leagues
    .map((l) => leagueMoney(data, l))
    .reduce(
      (a, m) => ({
        collected: a.collected + m.collected,
        openIn: a.openIn + m.openIn,
        openOut: a.openOut + m.openOut,
      }),
      { collected: 0, openIn: 0, openOut: 0 },
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: group.name }} />
      <Card>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Muted>Gruppencode zum Beitreten</Muted>
            <Text style={[styles.title, { fontSize: 22, letterSpacing: 2 }]}>
              {formatCode(group.id)}
            </Text>
          </View>
          <Button title="Teilen" small variant="secondary" onPress={() => shareGroup(group.name, group.id)} />
        </View>
      </Card>
      <Segmented<Tab>
        options={[
          { key: 'leagues', label: `Ligen (${leagues.length})` },
          { key: 'members', label: `Mitglieder (${members.length})` },
          { key: 'rules', label: `Regeln (${rules.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'leagues' && (
        <>
          {leagues.length > 0 && (
            <Card>
              <StatGrid
                items={[
                  { label: 'Mannschaftsgeld gesamt', value: formatMoney(groupMoney.collected), color: colors.success },
                  { label: 'Noch einzusammeln', value: formatMoney(groupMoney.openIn), color: colors.money },
                  ...(groupMoney.openOut
                    ? [{ label: 'Noch auszuzahlen', value: formatMoney(groupMoney.openOut), color: colors.success }]
                    : []),
                ]}
              />
            </Card>
          )}
          {leagues.length === 0 && <Empty text="Noch keine Liga. Z.B. „Sonntagsliga“." />}
          {leagues.map((l) => {
            const money = leagueMoney(data, l);
            return (
              <Card key={l.id} onPress={() => router.push(`/league/${l.id}`)}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{l.name}</Text>
                    <Muted>
                      {l.memberIds.length} Spieler · {leagueDays(data, l.id).length} Spieltage
                    </Muted>
                    <Muted>
                      Eingenommen {formatMoney(money.collected)}
                      {money.openIn > 0 ? ` · offen ${formatMoney(money.openIn)}` : ''}
                      {money.openOut > 0 ? ` · auszuzahlen ${formatMoney(money.openOut)}` : ''}
                    </Muted>
                  </View>
                  <Money cents={money.cents} />
                  <IconButton
                    icon="✎"
                    onPress={() => setRenaming({ kind: 'league', id: l.id, name: l.name })}
                  />
                  <IconButton
                    icon="🗑"
                    onPress={() =>
                      confirm(
                        `„${l.name}“ löschen?`,
                        'Alle Spieltage, Strafen und Ergebnisse dieser Liga werden gelöscht.',
                        () => actions.deleteLeague(l.id),
                      )
                    }
                  />
                </View>
              </Card>
            );
          })}
          <SectionTitle>Neue Liga</SectionTitle>
          <AddRow placeholder="z.B. Sonntagsliga" onAdd={(name) => actions.addLeague(group.id, name)} />
          {members.length > 0 && (
            <Muted>Neue Ligen enthalten automatisch alle Mitglieder der Gruppe.</Muted>
          )}
        </>
      )}

      {tab === 'members' && (
        <>
          {members.length === 0 && <Empty text="Noch keine Mitglieder." />}
          {members.map((m) => {
            const totals = memberTotals(data, m.id);
            const inLeagues = leagues.filter((l) => l.memberIds.includes(m.id)).map((l) => l.name);
            return (
              <Card key={m.id}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{m.name}</Text>
                    <Muted>{inLeagues.length ? inLeagues.join(', ') : 'In keiner Liga'}</Muted>
                    <Muted style={{ color: openColor(totals.open) }}>
                      {formatOpen(totals.open)}
                      {totals.paid !== 0 ? ` · ${formatMoney(totals.paid)} beglichen` : ''}
                    </Muted>
                  </View>
                  <Text style={{ color: openColor(totals.open), fontWeight: '700', fontSize: 16 }}>
                    {formatMoney(Math.abs(totals.open))}
                  </Text>
                  <IconButton
                    icon="✎"
                    onPress={() => setRenaming({ kind: 'member', id: m.id, name: m.name })}
                  />
                  <IconButton
                    icon="🗑"
                    onPress={() =>
                      confirm(
                        `${m.name} entfernen?`,
                        `Alle Strafen, Ergebnisse und Zahlungen von ${m.name} werden gelöscht (${formatOpen(totals.open)}). Bereits beglichene ${formatMoney(totals.paid)} verschwinden dann auch aus dem Mannschaftsgeld. Um jemanden nur aus einer Liga zu nehmen, nutze dort den Tab „Spieler“.`,
                        () => actions.deleteMember(m.id),
                      )
                    }
                  />
                </View>
              </Card>
            );
          })}
          <SectionTitle>Neues Mitglied</SectionTitle>
          <AddRow placeholder="Name" onAdd={(name) => actions.addMember(group.id, name)} />
          {leagues.length > 0 && (
            <Muted>
              Neue Mitglieder sind noch in keiner Liga – füge sie in der Liga unter „Spieler“ hinzu.
            </Muted>
          )}
        </>
      )}

      {tab === 'rules' && (
        <>
          {rules.length === 0 && (
            <Empty text="Der Strafkatalog ist leer. Füge z.B. „Pudel – 0,10 €“ hinzu." />
          )}
          {rules.map((r) => (
            <RuleCard
              key={r.id}
              rule={r}
              leagueName={leagues.find((l) => l.id === r.leagueId)?.name}
              onPress={() => router.push(`/group/${group.id}/rule?ruleId=${r.id}`)}
            />
          ))}
          <Button title="+ Regel hinzufügen" onPress={() => router.push(`/group/${group.id}/rule`)} />
        </>
      )}

      <Button
        title="Gruppe für alle löschen"
        variant="danger"
        style={{ marginTop: 24 }}
        onPress={() =>
          confirm(
            `„${group.name}“ für alle löschen?`,
            'Alle Mitglieder, Ligen, Regeln, Spieltage, Strafen und Ergebnisse werden für alle Mitglieder endgültig gelöscht.',
            () => {
              router.replace('/');
              actions.deleteGroup(group.id);
            },
          )
        }
      />

      <TextPrompt
        visible={!!renaming}
        title={renaming?.kind === 'league' ? 'Liga umbenennen' : 'Mitglied umbenennen'}
        initial={renaming?.name}
        onSubmit={(name) => {
          if (!renaming) return;
          if (renaming.kind === 'league') actions.renameLeague(renaming.id, name);
          else actions.renameMember(renaming.id, name);
        }}
        onClose={() => setRenaming(null)}
      />
    </Screen>
  );
}

function RuleCard({
  rule,
  leagueName,
  onPress,
}: {
  rule: Rule;
  leagueName?: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress}>
      <View style={styles.rowBetween}>
        <Text style={[styles.title, { flex: 1 }]}>{rule.name}</Text>
        <Money cents={rule.amountCents} />
      </View>
      {!!rule.condition && <Text style={{ color: colors.text, marginTop: 4 }}>{rule.condition}</Text>}
      <Muted style={{ marginTop: 6 }}>
        {rule.amountCents < 0 ? 'Gutschrift · ' : ''}
        {isAutomatic(rule)
          ? `Automatisch: pro Spiel ${thresholdLabel(rule)} Punkten`
          : 'Manuell gezählt'}
        {' · '}
        {leagueName ?? 'Alle Ligen'}
      </Muted>
    </Card>
  );
}
