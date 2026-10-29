# Strafenkatalog

Expo-App (React Native) für Bowling-Strafkataloge: Gruppen, Ligen, Regeln, Anwesenheit, Strafen und Ergebnisse pro Spieltag. Alle Daten liegen in Firebase Firestore und werden live zwischen allen Handys synchronisiert.

## Firebase einrichten (einmalig)

1. Auf https://console.firebase.google.com ein Projekt anlegen (Google Analytics kann aus bleiben).
2. **Build → Firestore Database → Datenbank erstellen**, Standort `europe-west3 (Frankfurt)`, im Produktionsmodus starten.
3. Im Tab **Regeln** den Inhalt von [`firestore.rules`](firestore.rules) einfügen und **Veröffentlichen**.
4. **Projekteinstellungen → Allgemein → Meine Apps → Web-App (`</>`)** hinzufügen. Die angezeigten `firebaseConfig`-Werte in eine neue Datei `.env.local` eintragen (Vorlage: [`.env.example`](.env.example)).

## Starten

```bash
npm install
npx expo start
```

Dann den QR-Code mit der **Expo Go** App (iOS/Android) scannen. Nach Änderungen an `.env.local` Expo neu starten.

## Gruppen teilen

Jede Gruppe hat einen Code wie `RK4F-7Q9X`. Wer den Code unter „Gruppe beitreten“ eingibt, sieht und bearbeitet dieselben Daten live. Wer den Code kennt, hat vollen Zugriff – also nur in der eigenen Gruppe teilen.

## Aufbau

- `src/app/` – Screens (Expo Router)
  - `index.tsx` – Gruppen anlegen / beitreten
  - `group/[groupId]/` – Ligen, Mitglieder, Strafkatalog + Regel-Editor
  - `league/[leagueId]/` – Spieltage, Auswertung, Spieler; Spieler-Detail pro Liga
  - `day/[dayId].tsx` – Spieltag: Anwesenheit, Strafen zählen, Ergebnisse eintragen
- `src/lib/store.tsx` – Firestore-Sync (Live-Listener, Schreibzugriffe)
- `src/lib/stats.ts` – Berechnung von Beträgen, Verstößen, Anwesenheit und Durchschnitten
- `firestore.rules` – Sicherheitsregeln für Firestore
