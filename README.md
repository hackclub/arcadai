# ArcadAI

The site for ArcadAI, a Hack Club program for building your first game in plain HTML, CSS and JavaScript.

Build a game with AI. Make it yours. Ship it, get rewarded.

## The three steps

1. **Your AI prompt.** Use any AI tool to generate the first version of a game. Submit the prompt, the tool, and a screenshot.
2. **Your own edits, no AI.** Open the code and change it by hand: at least five improvements. Submit a screenshot and the list.
3. **Your own features, in JavaScript.** Write new code that changes how the game plays. AI can explain, you write.

Then ship it on GitHub Pages and hand in the repo, the live link, a screenshot, and a few things you learned through the club workshop. ArcadAI runs through clubs only.

## Editing the site

There is no build step. Open `index.html` in a browser, or run `python -m http.server` in this folder.

- `index.html` holds all the copy, in page order. Each section is marked with a comment.
- `style.css` starts with the design tokens (colours, fonts, spacing). Change those to re-skin everything.
- `script.js` has the mobile menu, the copy button, and Orpheus Run, the mini game in the hero.
- `assets/` holds the images (WebP), the favicon, the Open Graph image and the Hack Club flag.
- `saved-copy.md` is the text kept from the previous site; the Clubs and Why AI sections come from it.

## Before launch

A few things carried over from the previous site that need checking (they are also marked with `TODO` comments in `index.html`):

- The workshop form (`forms.hackclub.com/host-arcadai-workshop`) returned 404 when this site was built.
- The requirements (ages 13 to 18, 1 hour on Hackatime, one submission each) and the Slack channel link are from the previous round.
- The example games are previous submissions.
