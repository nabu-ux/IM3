# Lachende Lisa am Seitenende

Werkzeug: eingebautes `image_gen`, transparenter Hintergrund.

Finale Dateien:
- `lisa-gluecklich-lineart.png`: lachende Figur mit offenen Augen.
- `lisa-gluecklich-lineart-augen-zu.png`: passender Blinzelzustand.

Beide Bilder sind direkt in `index.html` eingebettet. Die Figur steht rechts an der unteren Seitenkante und gleitet beim Sichtbarwerden von unten herein. Nur die Augenbereiche des zweiten Bildes werden zum Blinzeln überblendet.

## Neue Illustration mit Referenzen

Referenzen: `lisa-krankenhaus-lineart.png` für den feinen Linien-Stil und `lisa-kaffee.png` für die wiedererkennbare Figur.

Exakter Prompt:

```text
Use case: illustration-story.
Asset type: new transparent character illustration for the bottom-right edge of an existing website.
Reference image 1 (hospital bed) defines the fine LINE-ART STYLE and the same girl; reference image 2 (coffee girl) is an additional CHARACTER/HAIRSTYLE reference only. Create another illustration of the same young adult woman Lisa, with the same face proportions, parted hair, two braids and bows, and simple short-sleeved blouse.
Primary request: Lisa is happy and laughing warmly, with lifted cheeks, a clear joyful open smile and friendly OPEN eyes that can later blink. Upright upper-body portrait, looking toward the viewer with a slight inward turn toward the left. Show her head, both braids and shoulders/chest; the lower torso must extend through and be CROPPED BY THE BOTTOM EDGE so she can appear to rise from the webpage bottom. Keep the head and hair fully inside the frame with a small clear top margin. No coffee cup, no bed, no props.
Composition: square 1024x1024 canvas; character centered, head in upper half, chest/torso cut off at the exact bottom edge, no empty strip below the body.
Style: match reference 1's delicate thin warm-ivory/white contour strokes and sparse pale-pink cheek hatching. Keep all large interiors, including face, hair and clothing, genuinely TRANSPARENT so the existing brick-red page colour shows through. Only tiny filled pupils and eye whites / a small glimpse of teeth are allowed. No broad white fills, grey washes, glow, opaque character silhouette or background. Fine light contours, not thick cartoon outlines.
No text, watermark, extra people, objects or new background. Preserve genuine alpha transparency.
```

## Geschlossene Augen

Bearbeitungsziel: `lisa-gluecklich-lineart.png`.

Exakter Prompt:

```text
Use case: precise-object-edit.
Asset type: matching blink frame for a transparent happy line-art character on an existing website.
Input image 1 is the EXACT EDIT TARGET and open-eye animation frame. Close ONLY both eyes into soft cheerful curved eyelid arcs for a brief happy blink. Keep the same joyful laughing mouth, cheek hatching and happy eyebrows completely unchanged.
Critical: preserve the exact same 1254x1254 square canvas, head/face position, head angle, eye-area placement, braids, bows, blouse, torso crop at bottom, and every other contour. Do not move or resize the character. This will be used only as a small eye-region overlay on the original frame.
Preserve the extremely delicate warm-ivory/white LINE ART and tiny pale-pink accents. Keep large interior regions, including face, hair and clothes, genuinely transparent alpha so the existing brick-red page shows through. No opaque white/grey skin or clothing fills, no painted silhouette, no halo or wash. Only fine closed-eyelid contours replace the pupils and eye whites. No text, new objects, background, tears or sad expression.
```

