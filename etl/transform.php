<?php

/**
 * Transform: Krebsdaten (BFS / NKRS) für die Datenbank aufbereiten
 *
 * Datenfluss dieser Datei:
 *
 *   eine CSV-Zeile = EIN Wert (eine Kennzahl, eine 5-Jahres-Altersgruppe)
 *     -> gesammelt pro Krebsart, Geschlecht, Periode, 10-Jahres-Gruppe  ($groups)
 *       -> eine Zeile mit vier Kennzahlen pro Gruppe                     ($transformedRows)
 *
 * Die Untersuchungseinheit wechselt also von «ein Messwert» zu
 * «eine Krebsart × Geschlecht × Periode × Altersgruppe».
 */

$rawRows = include __DIR__ . '/extract.php';

// ---------------------------------------------------------------------------
// Regeln als benannte Variablen (im Unterricht änderbar)
// ---------------------------------------------------------------------------

// Die CSV enthält jeden Wert 3×: Schweiz, Deutschschweiz, Westschweiz und Tessin.
// Der Zieldatensatz hat keine Regionsspalte -> wir behalten nur die ganze Schweiz.
$region = 'Schweiz';

// Übersetzung der Geschlechtsbezeichnungen aus der CSV auf englisch für die Zieldatenbank.
$genderMap = [
    'Männlich' => 'male',
    'Weiblich' => 'female',

];

// 5-Jahres-Gruppe (Originalwert) -> 10-Jahres-Gruppe (Zielwert).
// Alle anderen Altersklassen der CSV (z. B. «0-24 Jahre», «65-84 Jahre»,
// «75 Jahre und mehr») überlappen mit diesen und werden verworfen.
$ageGroupMap = [
    '0-4 Jahre'         => '0-9',
    '5-9 Jahre'         => '0-9',
    '10-14 Jahre'       => '10-19',
    '15-19 Jahre'       => '10-19',
    '20-24 Jahre'       => '20-29',
    '25-29 Jahre'       => '20-29',
    '30-34 Jahre'       => '30-39',
    '35-39 Jahre'       => '30-39',
    '40-44 Jahre'       => '40-49',
    '45-49 Jahre'       => '40-49',
    '50-54 Jahre'       => '50-59',
    '55-59 Jahre'       => '50-59',
    '60-64 Jahre'       => '60-69',
    '65-69 Jahre'       => '60-69',
    '70-74 Jahre'       => '70-79',
    '75-79 Jahre'       => '70-79',
    '80-84 Jahre'       => '80+',
    '85 Jahre und mehr' => '80+',
];

// Indikator + Kennzahl -> neue Variable.
// Übersetzungstabelle für Indikator-Kombinationen in einheitliche Spaltennamen für die Datenbank.
$metricMap = [
    'Inzidenz|Altersspezifische Rate'                  => 'incidence_rate',
    'Mortalität|Altersspezifische Rate'                => 'mortality_rate',
    'Inzidenz|Anzahl Fälle (jährlicher Mittelwert)'    => 'incidence_cases',
    'Mortalität|Anzahl Fälle (jährlicher Mittelwert)'  => 'mortality_cases',
];

// Raten darf man nicht einfach addieren oder mitteln: Sie müssen mit der
// Bevölkerungsgrösse jeder 5-Jahres-Gruppe gewichtet werden. Die Bevölkerung
// steht nicht in der CSV, lässt sich aber zurückrechnen:
//   Bevölkerung = Fälle / Rate × 100 000
// Dafür nehmen wir die Inzidenz von «Alle Krebsarten», weil dort (anders als
// bei seltenen Krebsarten) nie 0 Fälle stehen und die meisten Werte enthalten sind, somit ist die Rückrechnung am genauesten.
$referenceCancerType = 'Alle Krebsarten (total) (C00-C97*)';
$ratePer = 100000; //Bezugsgröße für Raten (pro 100'000 Personen)
$decimals = 4;

$audit = [
    'input_rows'           => 0, // Eingelesene Zeilen gesamt
    'other_region'         => 0, // Ignorierte Zeilen aus anderen Regionen
    'missing_status_m'     => 0, // Ignorierte Zeilen mit Status M
    'overlapping_age_group' => 0, // Ignorierte Zeilen mit überlappenden/nicht benötigten Altersgruppen
    'unknown_metric'       => 0, // Unbekannte Kennzahlen
    'invalid_value'        => 0, // Ungültige Werte
    'incomplete_groups'    => 0, // Zeilen mit unvollständigen Gruppen
    'missing_population'   => 0, // Zeilen ohne brechenbare Bevölkerung (Referenz-Krebsart nicht gefunden)
    'output_rows'          => 0, // Ausgegebene Zeilen gesamt
];

// ---------------------------------------------------------------------------
// Kleine, einzeln prüfbare Funktionen
// ---------------------------------------------------------------------------

/** Regel «Nicht benötigte Daten entfernen» + «Umbenennen». */ //Extrahiert relevante Spalten aus einer Rohzeile und weist standardisierte Schlüssel zu. */
function selectAndRename(array $row): array
{
    return [
        'region'      => $row['Sprachregion'] ?? '',
        'status'      => $row['OBS_STATUS'] ?? '',
        'time_span'   => trim($row['Periode'] ?? ''),
        'age_group'   => trim($row['Altersklassen'] ?? ''),
        'cancer_type' => trim($row['Krebsart'] ?? ''),
        'gender'      => trim($row['Geschlecht'] ?? ''),
        'indicator'   => trim($row['Indikator'] ?? ''),
        'measure'     => trim($row['Kennzahlen'] ?? ''),
        'value'       => trim($row['OBS_VALUE'] ?? ''),
    ];
}

/** Regel «Bereinigen»: OBS_STATUS = M heisst «Daten können nicht existieren». */
function isMissingStatus(string $status): bool
{
    return $status === 'M';
}

/** Regel «Fehlende Werte»: leer, nicht numerisch oder negativ -> null. */
function parseValue(string $value): ?float //Wandelt den Textwert in eine Fliesskommazahl um; liefert null bei ungültigen oder negativen Werten
{
    if ($value === '' || !is_numeric($value)) { // Gibt null zurück, wenn der String leer oder keine Zahl ist.
        return null;
    }
    $number = (float) $value; // String in Float
    return $number < 0 ? null : $number; // null bei negativen Zahlen
}

// Geschlecht aus der CSV zu male female, null bei allen anderen Werten
function mapGender(string $gender, array $genderMap): ?string
{
    return $genderMap[$gender] ?? null;
}

/** 5-Jahres-Gruppe -> 10-Jahres-Gruppe, null bei überlappenden Klassen. */
function mapAgeGroup(string $ageGroup, array $ageGroupMap): ?string
{
    return $ageGroupMap[$ageGroup] ?? null;
}

/** Kombinationen Indikator + Kennzahl werden zugeordnet: incidence_rate / mortality_rate / ... oder null. */
function mapMetric(string $indicator, string $measure, array $metricMap): ?string
{
    return $metricMap[$indicator . '|' . $measure] ?? null;
}

/** Eindeutiger Text-Schlüssel aus mehreren Teilen. */ //Mehrer Angaben (z.B. Krebsart, Geschlecht) mit | zu eindeutigem Schlüssel -> zusammengehörige Daten können genau einer Gruppe zugeordent und gefunden werden.
function buildKey(string ...$parts): string
{
    return implode('|', $parts);
}

/** Bevölkerung aus Fällen und Rate zurückrechnen; null, wenn Rate 0 ist. */
function estimatePopulation(float $cases, float $rate, int $ratePer): ?float
{
    return $rate > 0 ? $cases / $rate * $ratePer : null;
}

/** Fälle zweier 5-Jahres-Gruppen: einfach addieren. */
function sumValues(array $values): float
{
    return array_sum($values);
}

/**
 * Raten zweier 5-Jahres-Gruppen: bevölkerungsgewichteter Mittelwert.
 * $rates und $populations haben dieselben Schlüssel (die 5-Jahres-Gruppen).
 */
function weightedRate(array $rates, array $populations): float //Berechnet den nach Populationsgrösse gewichteten Mittelwert für Raten.
{
    $weightedSum = 0.0;
    foreach ($rates as $sourceAge => $rate) { // Multipliziert jede Rate mit der dazugehörigen Bevölkerungszahl und addiert sie auf.
        $weightedSum += $rate * $populations[$sourceAge];
    }
    return $weightedSum / array_sum($populations);
}

/** Hat die Gruppe für jede Kennzahl genau die erwarteten 5-Jahres-Werte? */
function isCompleteGroup(array $values, array $metrics, array $expectedSources): bool //Überprüft, ob alle Werte vorhanden sind
{
    foreach ($metrics as $metric) { //geht Kennzahlen durch, holt Altersgruppenschlüssel für Kennzahl
        $found = array_keys($values[$metric] ?? []);
        sort($found); //sortiert alphabetisch
        if ($found !== $expectedSources) {
            return false;
        }
    }
    return true;
}

// Welche 5-Jahres-Gruppen gehören zu welcher 10-Jahres-Gruppe?
// ['0-9' => ['0-4 Jahre', '5-9 Jahre'], ...] – sortiert für den Vergleich oben.
// 10 Jahres Gruppe werden 5 Jahresgruppen zugeordnet und von jung nach alt sortiert.
$sourcesPerGroup = [];
foreach ($ageGroupMap as $source => $target) { //geht Quellen-Altersgruppen durch, ordnet sie der Ziel-Altersgruppe zu
    $sourcesPerGroup[$target][] = $source;
}
foreach ($sourcesPerGroup as &$sources) {
    sort($sources);
}
unset($sources); // Löscht refernz Variable, um versehentliche Änderungen zu vermeiden.

$metrics = array_values($metricMap);
$ageOrder = array_flip(array_keys($sourcesPerGroup)); // jung zu alt sortiert: '0-9' => 0, ... '80+' => 8

// ---------------------------------------------------------------------------
// Schritt 1: alle Rohzeilen durchlaufen, filtern und pro Gruppe sammeln
// ---------------------------------------------------------------------------
$groups = [];


foreach ($rawRows as $rawRow) { //Schleife für Zeilen der CSV.
    $audit['input_rows']++;
    $row = selectAndRename($rawRow); //Benennung wird vereinheitlicht

    if ($row['region'] !== $region) { //Filtert Region
        $audit['other_region']++;
        continue;
    }

    if (isMissingStatus($row['status'])) { // Zeilen mit Status 'M' werden herausgefiltert
        $audit['missing_status_m']++;
        continue;
    }
    $gender = mapGender($row['gender'], $genderMap); //Umbenennung und Abbruch, wenn unbekannt
    if ($gender === null) {
        continue;
    }

    $ageGroup = mapAgeGroup($row['age_group'], $ageGroupMap); //Umwandlung Altersgruppe, Abbruch bei überlappenden Gruppen
    if ($ageGroup === null) {
        $audit['overlapping_age_group']++;
        continue;
    }

    $metric = mapMetric($row['indicator'], $row['measure'], $metricMap); //Umwandlung in Kennzahlkombinationen, Abbruch
    if ($metric === null) {
        $audit['unknown_metric']++;
        continue;
    }

    $value = parseValue($row['value']); //Umwandlung in Float, Abbruch bei ungültigen Werten
    if ($value === null) {
        $audit['invalid_value']++;
        continue;
    }

    $key = buildKey($row['cancer_type'], $gender, $row['time_span'], $ageGroup); // Erstellt eindeutigen Schlüssel für Zielgruppe

    if (!isset($groups[$key])) { //Falls die Zielgruppe im Array $groups noch nicht existiert, erstelle die Grundstruktur
        $groups[$key] = [
            'time_span'   => $row['time_span'],
            'age_group'   => $ageGroup,
            'cancer_type' => $row['cancer_type'],
            'gender'      => $gender,
            'values'      => [], // [metric][5-Jahres-Gruppe] => Wert
        ];
    }

    // Prüft: Derselbe Wert zweimal wäre ein Fehler in der Quelle, kein Datenverlust.
    if (isset($groups[$key]['values'][$metric][$row['age_group']])) {
        throw new RuntimeException("Doppelter Wert: {$key} / {$metric} / {$row['age_group']}");
    }

    $groups[$key]['values'][$metric][$row['age_group']] = $value; //Speichert Wert in der Zielgruppe unter der Kennzahl und der 5-Jahres-Altersgruppe

}

// Referenz-Krebsart automatisch finden, falls der exakte Name abweicht.
if (!in_array($referenceCancerType, array_column($groups, 'cancer_type'), true)) {
    foreach ($groups as $group) {
        if (str_starts_with($group['cancer_type'], 'Alle Krebsarten')) {
            $referenceCancerType = $group['cancer_type'];
            break;
        }
    }
}

// ---------------------------------------------------------------------------
// Schritt 2: Bevölkerung pro Geschlecht, Periode und 5-Jahres-Gruppe schätzen
// ---------------------------------------------------------------------------
$populations = []; // [gender|time_span|5-Jahres-Gruppe] => Personen

foreach ($groups as $group) {
    if ($group['cancer_type'] !== $referenceCancerType) {
        continue;
    }
    foreach ($group['values']['incidence_cases'] ?? [] as $sourceAge => $cases) {
        $rate = $group['values']['incidence_rate'][$sourceAge] ?? null;
        if ($rate === null) {
            continue;
        }
        $population = estimatePopulation($cases, $rate, $ratePer);
        if ($population !== null) {
            $populations[buildKey($group['gender'], $group['time_span'], $sourceAge)] = $population;
        }
    }
}

if (count($populations) === 0) { //Wirft Fehler aus, wenns nicht berechnet werden kann
    throw new RuntimeException(
        "Keine Bevölkerungszahlen berechnet: Referenz-Krebsart «{$referenceCancerType}» nicht gefunden."
    );
}

// ---------------------------------------------------------------------------
// Schritt 3: pro Gruppe eine Zeile mit vier Kennzahlen bilden
// ---------------------------------------------------------------------------
$transformedRows = [];

foreach ($groups as $group) {
    $expectedSources = $sourcesPerGroup[$group['age_group']];

    // Fehlt eine der 8 Zahlen (4 Kennzahlen × 2 Teilgruppen), fliegt die ganze
    // Zeile raus – sonst wäre z. B. «80+» still nur «80-84».
    if (!isCompleteGroup($group['values'], $metrics, $expectedSources)) {
        $audit['incomplete_groups']++;
        continue;
    }

    $weights = [];
    foreach ($expectedSources as $sourceAge) {
        $weights[$sourceAge] = $populations[buildKey($group['gender'], $group['time_span'], $sourceAge)] ?? null;
    }
    if (in_array(null, $weights, true)) {
        $audit['missing_population']++;
        continue;
    }

    $v = $group['values'];

    // Gerundet wird erst hier, auf dem fertigen Ergebnis.
    $transformedRows[] = [
        'time_span'       => (string) $group['time_span'],
        'age_group'       => (string) $group['age_group'],
        'cancer_type'     => (string) $group['cancer_type'],
        'gender'          => (string) $group['gender'],
        'incidence_rate'  => round(weightedRate($v['incidence_rate'], $weights), $decimals),
        'mortality_rate'  => round(weightedRate($v['mortality_rate'], $weights), $decimals),
        'incidence_cases' => round(sumValues($v['incidence_cases']), $decimals),
        'mortality_cases' => round(sumValues($v['mortality_cases']), $decimals),
    ];
}

// ---------------------------------------------------------------------------
// Schritt 4: sortieren (Krebsart, Geschlecht, Periode, Alter aufsteigend)
// ---------------------------------------------------------------------------
// Die Altersgruppe wird über ihre Position in $ageGroupMap sortiert und nicht
// als Text. So ist die Reihenfolge garantiert 0-9, 10-19, …, 80+.
usort($transformedRows, function (array $a, array $b) use ($ageOrder): int {
    return [$a['cancer_type'], $a['gender'], $a['time_span'], $ageOrder[$a['age_group']]]
        <=> [$b['cancer_type'], $b['gender'], $b['time_span'], $ageOrder[$b['age_group']]];
});

$audit['output_rows'] = count($transformedRows);

//print_r($audit);

return [
    'rules' => [
        'region'                => $region,
        'age_groups'            => $sourcesPerGroup,
        'metrics'               => $metricMap,
        'dropped_status'        => 'M',
        'rate_aggregation'      => 'bevölkerungsgewichteter Mittelwert (Bevölkerung aus Inzidenz «' . $referenceCancerType . '»)',
        'cases_aggregation'     => 'Summe',
        'rate_unit'             => 'pro ' . $ratePer . ' Personen',
        'decimals'              => $decimals,
    ],
    'data'  => $transformedRows,
    'audit' => $audit,
];


