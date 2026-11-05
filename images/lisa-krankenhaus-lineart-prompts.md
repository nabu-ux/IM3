# Krankenhaus-Illustration als transparente Line Art

Werkzeug: eingebautes `image_gen`, Modus Bildbearbeitung, transparenter Hintergrund.

Dateien:
- `lisa-krankenhaus-lineart.png`: trauriger Blick, transparente Innenflächen.
- `lisa-krankenhaus-lineart-augen-zu.png`: passende Augenvariante für die bestehende langsame Animation.

Beide PNGs sind zusätzlich direkt in `index.html` eingebettet. Die vorherigen Bilddateien bleiben erhalten.

## Line-Art-Bearbeitung

Eingaben: `lisa-krankenhaus-traurig.png` als Bearbeitungsziel und `lisa-kaffee.png` ausschließlich als Stilreferenz.

Exakter Prompt:

```text
Use case: style-transfer.
Asset type: transparent line-art PNG for an existing brick-red webpage.
Input image 1 is the EDIT TARGET: Lisa looking sad in the hospital bed. Input image 2 is ONLY THE STYLE REFERENCE: the same girl with coffee, drawn mainly with fine light contours and transparent interiors.
Primary request: Convert image 1 into a delicate, predominantly STROKE-ONLY LINE DRAWING matching image 2. Remove the broad white/grey filled surfaces and the glowing halo. Draw thin warm ivory/white contour lines, sparse light hatching, and a few tiny pale-pink strokes. The interior of the girl's face, hair, body/clothes, blanket, pillow, bed rails and headboard must be genuinely transparent so that the webpage colour shows THROUGH those shapes. Think fine ivory lines drawn on clear acetate, with no opaque paper or painted-in silhouettes. Small filled pupils and eye whites are allowed for legibility, like the coffee reference; all large surfaces must stay empty/transparent.
Invariants: preserve the exact same sad, tired face, gently raised inner eyebrows, downcast eyes and small downturned mouth. Preserve character identity, braids with bows, pose, hospital bed, pillow, blanket, perspective and exact 1536x1024 landscape composition and placement. No smiling and no exaggerated crying.
Transparency is essential: real alpha both outside AND INSIDE the drawing's shapes. No solid background, no checkerboard painted into the asset, no white face/white hair/white blanket, no grey washes, no glows or broad shadows. No new objects, text or watermark.
```

## Augen geschlossen

Eingabe: `lisa-krankenhaus-lineart.png`.

Exakter Prompt:

```text
Use case: precise-object-edit.
Asset type: second frame for the existing transparent stroke-only hospital-bed illustration.
Input image 1 is the exact edit target and first frame: the sad girl lying in bed drawn with thin warm-ivory contours and transparent interiors.
Change ONLY BOTH EYES to a gentle fully closed, tired expression: replace the open eye whites and pupils with two soft curved closed-eyelid lines. Preserve the sad eyebrows, downturned mouth and ALL other lines exactly.
Critical animation invariants: same 1536x1024 canvas, identical pixel placement, face/head geometry, braids, bows, pillow, blanket, bed and perspective. This is an eye-region animation overlay, so do not move or restyle anything.
Keep the transparent LINE ART: almost all pixels between contour lines, INCLUDING inside the face/hair/clothes/blanket/pillow/bed, must remain fully transparent (alpha zero). Keep the existing light ivory strokes and tiny pale-pink hatching. Closed eyelids should read clearly as delicate light contours over a brick-red background. Do not paint a white or grey face, do not fill the bedding, do not add a glow, halo, soft wash, shadow or opaque background. Preserve the existing alpha. No text, no smile, no tears, no new elements.
```

