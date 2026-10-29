import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  AddRow,
  Card,
  confirm,
  Empty,
  IconButton,
  Muted,
  notify,
  Screen,
  SectionTitle,
  styles,
} from '../components/ui';
import { firebaseConfigured } from '../lib/firebase';
import { shareGroup } from '../lib/share';
import { formatCode, useStore } from '../lib/store';

export default function GroupsScreen() {
  if (!firebaseConfigured) return <SetupHint />;
  return <Groups />;
}

function Groups() {
  const { data, actions } = useStore();
  const [joining, setJoining] = useState(false);

  const join = async (input: string) => {
    setJoining(true);
    try {
      const code = await actions.joinGroup(input);
      if (code) router.push(`/group/${code}`);
      else notify('Code nicht gefunden', 'Prüfe den Gruppencode und versuche es erneut.');
    } catch (e) {
      notify('Keine Verbindung', 'Beitreten ist nur online möglich.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen>
      <SectionTitle>Deine Gruppen</SectionTitle>
      {data.groups.length === 0 && (
        <Empty text="Noch keine Gruppe. Leg eine an oder tritt mit einem Code bei." />
      )}
      {data.groups.map((g) => {
        const members = data.members.filter((m) => m.groupId === g.id).length;
        const leagues = data.leagues.filter((l) => l.groupId === g.id).length;
        return (
          <Card key={g.id} onPress={() => router.push(`/group/${g.id}`)}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{g.name}</Text>
                <Muted>
                  {members} Mitglieder · {leagues} Ligen · Code {formatCode(g.id)}
                </Muted>
              </View>
              <IconButton icon="⤴" onPress={() => shareGroup(g.name, g.id)} />
              <IconButton
                icon="✕"
                onPress={() =>
                  confirm(
                    `„${g.name}“ verlassen?`,
                    'Die Gruppe verschwindet nur von diesem Handy. Mit dem Code kannst du jederzeit wieder beitreten.',
                    () => actions.leaveGroup(g.id),
                    'Verlassen',
                  )
                }
              />
            </View>
          </Card>
        );
      })}

      <SectionTitle>Gruppe beitreten</SectionTitle>
      <AddRow placeholder={joining ? 'Suche…' : 'Gruppencode, z.B. RK4F-7Q9X'} onAdd={join} />

      <SectionTitle>Neue Gruppe</SectionTitle>
      <AddRow
        placeholder="Gruppenname, z.B. Räumkommando"
        onAdd={(name) => router.push(`/group/${actions.addGroup(name)}`)}
      />
    </Screen>
  );
}

function SetupHint() {
  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Firebase ist noch nicht eingerichtet</Text>
        <Muted style={{ marginTop: 8 }}>
          Kopiere .env.example nach .env.local, trage die Werte aus der Firebase-Konsole ein und
          starte „npx expo start“ neu. Details stehen in der README.
        </Muted>
      </Card>
    </Screen>
  );
}
