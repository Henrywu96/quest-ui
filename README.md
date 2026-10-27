# Quest UI

The design system behind my UI/UX portfolio and [Henry's Quest Town](https://github.com/henrywu96/mini-island). One set of colours, type, spacing and motion, shared by both sites.

Main portfolio: [henrywu.link](https://henrywu.link/)

## Why

The portfolio and Quest Town grew side by side, and an audit showed they had drifted into two systems:

- 10 colours had the same value on both sites but a different name on each.
- The portfolio used 24 font sizes and Quest Town 25.
- 7 of the 12 text and background pairs tested fell short of WCAG 2.2 AA, mostly small coral text, white text on coral buttons and the rarity badges.

Quest UI v0 brings each of those down to a small set of named values, and the colours that failed now pass.

| | Portfolio | Quest Town | Quest UI v0 |
| --- | --- | --- | --- |
| Font sizes | 24 | 25 | 9 steps |
| Corner radii | 10 | 15 | 5 |
| Shadows | 11 | 20 | 5 |
| Letter spacings | 8 | 8 | 3 |
| Motion durations | 16 | 7 | 3 |

## What's here

| File | What it is |
| --- | --- |
| `tokens/tokens.json` | Every token, in the [Design Tokens](https://www.designtokens.org/) format. The single source of truth. |
| `tokens/quest-ui.css` | The same tokens as CSS custom properties, plus `.qu-type-*` text style classes. Generated, not edited by hand. |
| `css/components.css` | Buttons, cards and rarity badges as plain CSS classes, built only from the tokens. |
| `scripts/build-tokens.mjs` | Builds the CSS and the site's copy of the tokens, and checks colour contrast. No dependencies. |
| `index.html`, `site/` | The documentation site. It draws its colour, contrast, type and motion sections from the tokens, so it always matches them. |

The tokens are also set up as variables and styles in a Figma file, so designs and code use the same names.
