import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  Card,
  confirm,
  Empty,
  Input,
  Label,
  Muted,
  notify,
  Screen,
  Segmented,
} from '../../../components/ui';
import { centsToInput, parseMoney } from '../../../lib/format';
import { useStore } from '../../../lib/store';
import { RuleKind } from '../../../lib/types';

type Sign = 'penalty' | 'credit';

export default function RuleScreen() {
  const { leagueId, ruleId } = useLocalSearchParams<{ leagueId: string; ruleId?: string }>();
  const { data, actions } = useStore();
  const league = data.leagues.find((l) => l.id === leagueId);
  const existing = data.rules.find((r) => r.id === ruleId);

  const [name, setName] = useState(existing?.name ?? '');
  const [condition, setCondition] = useState(existing?.condition ?? '');
  const [amount, setAmount] = useState(
    existing ? centsToInput(Math.abs(existing.amountCents)) : '',
  );
  const [sign, setSign] = useState<Sign>(existing && existing.amountCents < 0 ? 'credit' : 'penalty');
  const [kind, setKind] = useState<RuleKind>(existing?.kind ?? 'count');
  const [threshold, setThreshold] = useState(existing?.threshold?.toString() ?? '');

  if (!league) return <Empty text="Liga nicht gefunden." />;

  const save = () => {
    const amountCents = parseMoney(amount);
    if (!name.trim()) return notify('Name fehlt', 'Bitte gib der Regel einen Namen.');
    if (amountCents === null) return notify('Ungültiger Betrag', 'Bitte z.B. 0,10 eingeben.');
    const thresholdNum = parseInt(threshold, 10);
    if (kind !== 'count' && !(thresholdNum > 0))
      return notify('Grenze fehlt', 'Bitte gib eine Punktzahl als Grenze ein.');

    actions.saveRule(
      {
        groupId: league.groupId,
        leagueId: league.id,
        name: name.trim(),
        condition: condition.trim(),
        amountCents: sign === 'credit' ? -amountCents : amountCents,
        kind,
        threshold: kind !== 'count' ? thresholdNum : undefined,
      },
      existing?.id,
    );
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Regel bearbeiten' : 'Neue Regel' }} />
      <Card>
        <Label>Name</Label>
        <Input value={name} onChangeText={setName} placeholder="z.B. Pudel" />

        <Label>Bedingung / Beschreibung</Label>
        <Input
          value={condition}
          onChangeText={setCondition}
          placeholder="z.B. Kugel landet in der Rinne"
          multiline
          style={{ minHeight: 60, textAlignVertical: 'top' }}
        />

        <Label>Art</Label>
        <Segmented<Sign>
          options={[
            { key: 'penalty', label: '+ Strafe' },
            { key: 'credit', label: '− Gutschrift' },
          ]}
          value={sign}
          onChange={setSign}
        />

        <Label>{sign === 'credit' ? 'Gutschrift pro Mal (€)' : 'Strafe pro Verstoß (€)'}</Label>
        <Input
          value={amount}
          onChangeText={setAmount}
          placeholder="0,10"
          keyboardType="decimal-pad"
        />
        <Muted style={{ marginTop: 8 }}>
          {sign === 'credit'
            ? 'Wird vom Betrag abgezogen, z.B. für eine Neun oder einen Kranz.'
            : 'Wird zum Betrag addiert.'}
        </Muted>
      </Card>

      <Card>
        <Label>Wie wird gezählt?</Label>
        <Segmented<RuleKind>
          options={[
            { key: 'count', label: 'Manuell' },
            { key: 'scoreBelow', label: 'Spiel unter …' },
            { key: 'scoreAbove', label: 'Spiel ab …' },
          ]}
          value={kind}
          onChange={(k) => {
            setKind(k);
            // Sensible default for new rules: low scores cost, high scores earn
            if (!existing && k !== 'count') setSign(k === 'scoreAbove' ? 'credit' : 'penalty');
          }}
        />
        {kind === 'count' ? (
          <Muted style={{ marginTop: 8 }}>
            Wird am Spieltag per +/− für jeden Spieler gezählt.
          </Muted>
        ) : (
          <>
            <Label>{kind === 'scoreBelow' ? 'Spiel unter … Punkten' : 'Spiel ab … Punkten'}</Label>
            <Input
              value={threshold}
              onChangeText={setThreshold}
              placeholder={kind === 'scoreBelow' ? 'z.B. 100' : 'z.B. 200'}
              keyboardType="number-pad"
            />
            <Muted style={{ marginTop: 8 }}>
              {kind === 'scoreBelow'
                ? 'Jedes eingetragene Spiel mit weniger Punkten zählt automatisch einmal.'
                : 'Jedes eingetragene Spiel mit mindestens so vielen Punkten zählt automatisch einmal.'}
              {' '}Für Stufen mehrere Regeln anlegen – pro Spiel gilt nur die genaueste, z.B. bei
              „unter 180“ und „unter 160“ kostet eine 150 nur die Strafe für „unter 160“.
            </Muted>
          </>
        )}
      </Card>

      <Muted>Gilt nur für die Liga „{league.name}“.</Muted>
      {existing && (
        <Muted>Änderungen am Betrag gelten auch für alle bisherigen Spieltage.</Muted>
      )}
      <Button title="Speichern" onPress={save} />
      {existing && (
        <Button
          title="Regel entfernen"
          variant="danger"
          onPress={() =>
            confirm(
              `„${existing.name}“ entfernen?`,
              'Die Regel verschwindet aus dem Katalog. Bereits erfasste Strafen bleiben erhalten.',
              () => {
                actions.deleteRule(existing.id);
                router.back();
              },
              'Entfernen',
            )
          }
        />
      )}
    </Screen>
  );
}
