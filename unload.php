<?php
/**
 * Unload: Krebsdaten aus der Datenbank als JSON ausliefern
 *
 * Datenfluss dieser Datei:
 *
 *   Anfrage vom Browser / fetch()               (z. B. unload.php?gender=Frauen)
 *     -> SELECT mit JOIN auf cancer_types       (Name statt cancer_type_id)
 *       -> Zahlen sauber typisieren             (DECIMAL kommt als Text)
 *         -> json_encode                        (Antwort ans Frontend)
 *
 * Antwortet auf:
 *
 *   GET unload.php                                   alle Zeilen
 *   GET unload.php?cancer_type=...                   nur eine Krebsart
 *   GET unload.php?gender=...                        nur ein Geschlecht
 *   GET unload.php?time_span=...                     nur eine Periode
 *   GET unload.php?age_group=...                     nur eine Altersgruppe
 *
 * Die Filter lassen sich kombinieren:
 *   unload.php?cancer_type=...&gender=...&time_span=...
 *
 * Datenvertrag – ein Datensatz in der Antwort:
 *
 *   {
 *     "cancer_type":     "Lunge, Bronchien, Luftröhre (C33-C34)",   String
 *     "gender":          "...",                                     String
 *     "time_span":       "...",                                     String
 *     "age_group":       "...",                                     String
 *     "incidence_rate":  12.3456,                                   Number
 *     "mortality_rate":  4.5678,                                    Number
 *     "incidence_cases": 123.4567,                                  Number
 *     "mortality_cases": 45.6789                                    Number
 *   }
 *
 * Voraussetzung: cancer_types und cancer_data sind gefüllt (einmal load.php
 * aufrufen). Kein Treffer ergibt [] mit Status 200, ein Fehler ergibt
 * {"error": "..."} mit Status 500.
 */

// ---------------------------------------------------------------------------
// 1: Ausgabe als JSON
// ---------------------------------------------------------------------------
//
// Anders als load.php ist diese Datei kein Werkzeug, sondern ein Endpunkt.
// Der Header muss vor jeder Ausgabe stehen. Danach darf nur noch JSON kommen:
// kein echo, kein var_dump, kein HTML.

header('Content-Type: application/json; charset=utf-8');

// ---------------------------------------------------------------------------
// 2: Zugangsdaten laden
// ---------------------------------------------------------------------------
//
// Dieselbe config.php wie beim Load. Sie liefert $dsn, $username, $password
// und $options. Anzahl «/..» an eure Ordnerstruktur anpassen.

require __DIR__ . '/etl/config.php';

// ---------------------------------------------------------------------------
// 3: Eine Datenbankzeile in die Form des Datenvertrags bringen
// ---------------------------------------------------------------------------
//
// PDO liefert DECIMAL-Spalten als Text ("12.3456"). Das Frontend erwartet
// aber Zahlen, sonst rechnet Chart.js mit Strings. Darum hier (float).

function normalizeStatistic(array $row): array
{
    return [
        'cancer_type'     => $row['cancer_type'],
        'gender'          => $row['gender'],
        'time_span'       => $row['time_span'],
        'age_group'       => $row['age_group'],
        'incidence_rate'  => (float) $row['incidence_rate'],
        'mortality_rate'  => (float) $row['mortality_rate'],
        'incidence_cases' => (float) $row['incidence_cases'],
        'mortality_cases' => (float) $row['mortality_cases'],
    ];
}

// ---------------------------------------------------------------------------
// 4: Filter aus der URL lesen
// ---------------------------------------------------------------------------
//
// Jeder Filter ist optional. ?? '' setzt einen leeren String, wenn der
// Parameter fehlt; trim() entfernt versehentliche Leerzeichen.
//
// Der Schlüssel links ist der Name in der URL, rechts steht die Spalte in
// der Datenbank. Nur was hier steht, kann gefiltert werden – so kommt kein
// fremder Spaltenname aus der URL ins SQL.

$allowedFilters = [
    'cancer_type' => 'ct.name',
    'gender'      => 'cd.gender',
    'time_span'   => 'cd.time_span',
    'age_group'   => 'cd.age_group',
];

try {
    // -----------------------------------------------------------------------
    // 5: Verbinden
    // -----------------------------------------------------------------------

    $pdo = new PDO($dsn, $username, $password, $options);

    // -----------------------------------------------------------------------
    // 6: Nur die vereinbarten Felder lesen
    // -----------------------------------------------------------------------
    //
    // - kein SELECT *: der Endpunkt liefert nur, was im Datenvertrag steht
    // - ct.name AS cancer_type: das Frontend braucht den Namen, nicht die id
    // - JOIN sucht zu jeder Zeile in cancer_data die passende Krebsart

    $sql = 'SELECT ct.name AS cancer_type,
                   cd.gender,
                   cd.time_span,
                   cd.age_group,
                   cd.incidence_rate,
                   cd.mortality_rate,
                   cd.incidence_cases,
                   cd.mortality_cases
            FROM cancer_data AS cd
            JOIN cancer_types AS ct ON ct.id = cd.cancer_type_id';

    // -----------------------------------------------------------------------
    // 7: Optionale Filter als Prepared Statement anhängen
    // -----------------------------------------------------------------------
    //
    // Der Wert aus der URL landet nie direkt im SQL, sondern in $params.
    // Mehrere Filter werden mit AND verbunden.

    $conditions = [];
    $params = [];

    foreach ($allowedFilters as $parameter => $column) {
        $value = trim($_GET[$parameter] ?? '');

        if ($value !== '') {
            $conditions[] = $column . ' = :' . $parameter;
            $params[$parameter] = $value;
        }
    }

    if (count($conditions) > 0) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }

    // -----------------------------------------------------------------------
    // 8: Feste Sortierung
    // -----------------------------------------------------------------------
    //
    // Altersgruppen sind Text («5-9», «10-14», …). Alphabetisch sortiert käme
    // «10-14» vor «5-9». cd.id als letzte Stufe behält die Reihenfolge, in
    // der der Transform die Altersgruppen geliefert hat.

    $sql .= ' ORDER BY ct.name, cd.time_span, cd.gender, cd.id';

    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    // fetchAll() liefert bei null Treffern eine leere Liste -> []
    $rows = $statement->fetchAll();

    // -----------------------------------------------------------------------
    // 9: Als JSON antworten
    // -----------------------------------------------------------------------
    //
    // JSON_THROW_ON_ERROR macht Kodierungsfehler sichtbar (-> catch),
    // JSON_UNESCAPED_UNICODE hält «Luftröhre» lesbar.

    $data = array_map('normalizeStatistic', $rows);

    echo json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    // -----------------------------------------------------------------------
    // 10: Auch ein Fehler antwortet als JSON
    // -----------------------------------------------------------------------
    //
    // Die interne Meldung (z. B. falsches Passwort) gehört ins Server-Log
    // und nicht in die öffentliche Antwort.

    http_response_code(500);
    error_log('unload.php: ' . $error->getMessage());

    echo json_encode([
        'error' => 'Daten konnten nicht geladen werden.',
    ]);
}