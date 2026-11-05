# Lisa im Krankenhaus: Bildbearbeitung

Modus: eingebautes `image_gen`-Tool, zwei Bildbearbeitungen mit transparentem Hintergrund.

Ausgangsbild: die bestehende Krankenhaus-Illustration der Webseite. Die Ursprungsdateien unter `.codex/generated_images` bleiben erhalten. Beide bearbeiteten PNGs sind im Projekt gespeichert und zusätzlich direkt in `index.html` eingebettet.

## Trauriger Gesichtsausdruck

Datei: `lisa-krankenhaus-traurig.png`

Exakter Prompt:

```text
Use case: precise-object-edit.
Asset type: transparent illustration for the existing website about Lisa's cancer story.
Input image 1 is the EDIT TARGET: the existing drawing of Lisa lying in a hospital bed.
Primary request: Change only Lisa's facial expression so she looks unmistakably sad, worried and tired rather than smiling: softly raised inner eyebrow corners, a slightly downcast gaze, gently drooping eyelids, and a small downturned mouth. Keep the emotion restrained, vulnerable and empathetic, without exaggerated crying or added tears.
Invariants: Preserve the same girl's identity, exact face proportions and head position, two long braids with bows, hospital clothing, blanket, pillow, hospital bed, perspective, composition, original landscape 3:2 framing, and the same delicate ivory/white pencil line art with subtle grey shading and pale pink accents. Everything outside the expression should remain as close to the input as possible. Keep the entire bed and blanket visible within the frame.
Background: genuine transparent alpha, suitable for placing over the website's existing brick-red background. Preserve existing transparency and soft edges; no solid background, no checkerboard drawn into the image, no black rectangle, no new vignette.
No text, logos, extra people, extra objects, or change to the illustration style.
```

## Geschlossene Augen

Datei: `lisa-krankenhaus-traurig-augen-zu.png`

Eingabe: `lisa-krankenhaus-traurig.png`.

Exakter Prompt:

```text
Use case: precise-object-edit.
Asset type: second animation frame of the same sad Lisa hospital-bed illustration for an existing website.
Input image 1 is the EDIT TARGET and the exact first animation frame. Change ONLY the eyelids and pupils: Lisa gently closes BOTH eyes completely, as a tired, sad person quietly resting. Keep the sad raised inner eyebrows and the small downturned mouth exactly unchanged. The eyes should be soft closed curved eyelid lines, with no visible iris or pupil.
CRITICAL animation invariants: identical 1536x1024 landscape canvas, exact same framing and pixel alignment, face position, head angle, braids, face shading, grey translucent skin tones, blush, hospital gown, pillow, blanket, bed, line thickness and ivory/white/pale-pink pencil style. Do not tilt or move the head or bed. Do not redraw or restyle anything outside the two eye areas. This image will be used as a local eye-region overlay on the first frame, so alignment and matching surrounding skin are essential.
Preserve genuine transparent alpha and the existing soft edges. No solid background, no checkerboard pattern, no text, no tears, no new elements, no smile.
```

## Animation

Nur die beiden Augenbereiche des zweiten Bildes werden eingeblendet. Die ursprünglichen Augen werden synchron ausgeblendet. Gesichtsausdruck und Krankenhausbett bleiben außerhalb dieser Bereiche unverändert. Das langsame Schließen und Öffnen dauert 1,05 Sekunden. Die Animation pausiert außerhalb des sichtbaren Bereichs, in einem verborgenen Tab und bei reduzierter Bewegung.

