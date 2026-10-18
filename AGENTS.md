<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Chess logic lives in src/lib/chess (pure, unit-tested); Stockfish runs client-side in a Web Worker so no server compute is needed.
- Playback and evaluation formatting live in the pure chess library; playback timers and audio stay client-side so they can be tested without server resources.
- Completed position evaluations stream through the review progress callback, preserving white-perspective scores for the graph and bar.
- Public Chess.com avatars are fetched client-side and cached; platforms without public avatar fields use neutral player icons rather than invented profile photos.
- Board coordinates occupy separate grid tracks outside the squares so pieces remain unobstructed on all device sizes.
