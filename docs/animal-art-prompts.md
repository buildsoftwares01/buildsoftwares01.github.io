# 2D safari character artwork

Generated with the built-in image_gen tool. Each transparent sheet contains a 3 × 2 grid: two walking poses, eating, sleeping, playing and a surprised hop. The lion sheet was the style reference for the other four sheets. Final sheets are resized to 768 × 512 and compressed as WebP with transparency preserved.

## lion

Use case: illustration-story.
Asset type: a production-ready transparent 2D sprite sheet for a first-birthday safari invitation.
Draw one adorable baby LION character in six poses, laid out as a strict 3-column by 2-row grid of equal square cells, landscape canvas. Top row, left to right: walking with left feet forward, walking with right feet forward, eating a tiny leafy snack. Bottom row, left to right: curled up asleep with closed eyes, playing joyfully with a small sage-green ball, startled delighted hop with paws up.
Style: beautiful hand-drawn children's picture-book illustration, flat 2D shapes, subtle gouache texture, soft irregular warm-brown outlines, honey-gold cub with a fluffy caramel mane, cream muzzle, round black eyes, tiny blush cheeks, sweet smiling face, short rounded paws. Gentle warm muted colors to suit a cream, sage and terracotta birthday page. This must look like an illustrator's charming drawing, not a 3D render, not glossy, not a geometric construction.
Exact same lion design, scale and color in all six cells. Full body in every pose, centered in its cell, feet at a consistent baseline, generous 15% transparent padding inside each cell. Nothing may cross into another cell. No scenery, no floor, no cast shadows, no lettering, no labels, no grid lines, no borders. Background genuinely transparent.

## elephant

Use case: illustration-story. Asset type: transparent 2D sprite sheet for a first-birthday safari invitation.
Input image is ONLY a STYLE AND GRID reference. Replace the lion with one adorable baby ELEPHANT; powder sage-grey skin, big soft pink inner ears, little curved trunk, tiny rounded feet. Keep the same beautiful hand-painted children's picture-book style: flat 2D drawing, subtle gouache texture, soft warm brown outlines, round dark eyes, rosy cheeks, friendly smiling face. No 3D render, no glossy shading.
Draw exactly SIX separate poses of the SAME ELEPHANT, in the same strict THREE columns by TWO rows grid of equal square cells, landscape canvas. Top row left to right: walking left feet forward, walking right feet forward (genuinely different gait), eating a leafy twig. Bottom row: curled asleep with closed eyes, playing with a small sage-green ball, surprised joyful hop with hands or front feet up.
Same identity, color, and scale across six cells. Whole body visible, centered in each cell with 15% transparent padding and consistent foot baseline. Leave clear gutters. No other animal, no lions. No scenery, ground, shadows, text, labels, borders, or grid lines. Genuinely transparent background.

## giraffe

Use case: illustration-story. Asset type: transparent 2D sprite sheet for a first-birthday safari invitation.
Input image is ONLY a STYLE AND GRID reference. Replace the lion with one adorable baby GIRAFFE; warm biscuit-yellow skin, caramel patches, short ossicones, gently long neck, rounded hooves. Keep the same beautiful hand-painted children's picture-book style: flat 2D drawing, subtle gouache texture, soft warm brown outlines, round dark eyes, rosy cheeks, friendly smiling face. No 3D render, no glossy shading.
Draw exactly SIX separate poses of the SAME GIRAFFE, in the same strict THREE columns by TWO rows grid of equal square cells, landscape canvas. Top row left to right: walking left feet forward, walking right feet forward (genuinely different gait), eating a leafy twig. Bottom row: curled asleep with closed eyes, playing with a small sage-green ball, surprised joyful hop with hands or front feet up.
Same identity, color, and scale across six cells. Whole body visible, centered in each cell with 15% transparent padding and consistent foot baseline. Leave clear gutters. No other animal, no lions. No scenery, ground, shadows, text, labels, borders, or grid lines. Genuinely transparent background.

## monkey

Use case: illustration-story. Asset type: transparent 2D sprite sheet for a first-birthday safari invitation.
Input image is ONLY a STYLE AND GRID reference. Replace the lion with one adorable baby MONKEY; warm cocoa-brown fur, cream face and tummy, curly tail, little round ears, tiny rounded hands. Keep the same beautiful hand-painted children's picture-book style: flat 2D drawing, subtle gouache texture, soft warm brown outlines, round dark eyes, rosy cheeks, friendly smiling face. No 3D render, no glossy shading.
Draw exactly SIX separate poses of the SAME MONKEY, in the same strict THREE columns by TWO rows grid of equal square cells, landscape canvas. Top row left to right: walking left feet forward, walking right feet forward (genuinely different gait), eating a small banana. Bottom row: curled asleep with closed eyes, playing with a small sage-green ball, surprised joyful hop with hands or front feet up.
Same identity, color, and scale across six cells. Whole body visible, centered in each cell with 15% transparent padding and consistent foot baseline. Leave clear gutters. No other animal, no lions. No scenery, ground, shadows, text, labels, borders, or grid lines. Genuinely transparent background.

## tiger

Use case: illustration-story. Asset type: transparent 2D sprite sheet for a first-birthday safari invitation.
Input image is ONLY a STYLE AND GRID reference. Replace the lion with one adorable baby TIGER CUB; warm apricot-orange fur, soft brown stripes, cream cheeks and tummy, rounded paws and little ears. Keep the same beautiful hand-painted children's picture-book style: flat 2D drawing, subtle gouache texture, soft warm brown outlines, round dark eyes, rosy cheeks, friendly smiling face. No 3D render, no glossy shading.
Draw exactly SIX separate poses of the SAME TIGER CUB, in the same strict THREE columns by TWO rows grid of equal square cells, landscape canvas. Top row left to right: walking left feet forward, walking right feet forward (genuinely different gait), eating a tiny leafy snack. Bottom row: curled asleep with closed eyes, playing with a small sage-green ball, surprised joyful hop with hands or front feet up.
Same identity, color, and scale across six cells. Whole body visible, centered in each cell with 15% transparent padding and consistent foot baseline. Leave clear gutters. No other animal, no lions. No scenery, ground, shadows, text, labels, borders, or grid lines. Genuinely transparent background.


## Tiger floor roll

Generated with the built-in image_gen tool using the tiger sheet as an identity/style reference. Saved as `public/assets/animals/tiger-roll.webp`, resized to 320 × 320 with transparency preserved.

Use case: illustration-story. Asset type: one transparent 2D animation character for a first-birthday safari webpage.
Input image is a STYLE AND IDENTITY reference for the tiger cub. Draw exactly one same adorable warm apricot tiger cub, with brown stripes, cream muzzle and tummy, pink rosy cheeks, little round ears, friendly dark eyes, soft hand-painted gouache texture and warm-brown outlines.
New pose: playful awake tiger curled into a compact ROUND ball on its back/side, cuddling its own tucked paws, smiling with happy open eyes, tail curled tightly around its body. Show the cream tummy and tiny paw pads. This curled circular silhouette will be animated rotating gently along the floor, so keep all paws and tail tucked within the rounded silhouette, with the face readable and balanced. No sleeping closed eyes. No toy or food.
Beautiful flat 2D children's picture-book drawing, matching the reference, no 3D rendering. Square canvas, whole tiger centered with generous 18% transparent padding on all sides. One character only, not a sprite sheet. No scenery, ground, shadow, text, labels, borders or additional objects. Genuinely transparent background.

## Animation update (October 2026)

The original artwork is retained. The renderer caches each cropped pose and creates continuous in-between frames with 32 joined texture strips. The strips are composed at integer texture coordinates before the character is scaled or rotated, preventing seams in translucent artwork. Each activity combines pose changes with head/neck movement, body bends, breathing, steps, hops or rolling. The monkey uses its joyful-hop pose while airborne; the tiger has a crouch, roll, bounce and settle cycle. No additional generated source images are needed.

All six local WebP files preload in the page head and decode in parallel at startup. Animals below the fold are painted immediately too. Controls remain hidden and disabled until their actual artwork is ready; there are no emoji placeholders. The header offers Pause/Resume animations, and device reduced-motion preferences keep the animals still. Rendering also pauses while an animal is offscreen or the document is hidden, and behind an open dialog. Tapping an animal gives a gentle greeting, with a still greeting when motion is paused.
