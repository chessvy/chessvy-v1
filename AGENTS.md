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

- Chess logic lives in src/lib/chess (pure, unit-tested); Stockfish runs client-side in a Web Worker so no server compute is needed. The worker is created from a blob and the Stockfish wasm URL is passed in the worker URL hash — stockfish.js reads `self.location.hash` to find its wasm, which is empty for blob workers otherwise.
- Playback and evaluation formatting live in the pure chess library; playback timers and audio stay client-side so they can be tested without server resources.
- Completed position evaluations stream through the review progress callback, preserving white-perspective scores for the graph and bar.
- Public Chess.com avatars are fetched client-side and cached; platforms without public avatar fields use neutral player icons rather than invented profile photos.
- Board coordinates occupy separate grid tracks outside the squares so pieces remain unobstructed on all device sizes.
- Review effects use a shared icon-sized badge wrapper and a preloaded Web Audio manager; this keeps celebrations off pieces and avoids delayed sound downloads during playback.
- PGN exports rebuild the loaded mainline and headers through chess.js; clipboard and downloads never use potentially stale import text.
- Move-loss comparisons reuse a completed requested-depth MultiPV played line or use same-root restricted Stockfish searches; the graph uses independent white-perspective position scores, and complete MultiPV iterations prevent mismatched-depth comparisons.
- Engine search promises are cached only within one Engine instance using the full FEN and all search options; failures are evicted and termination clears reuse to avoid stale scores or cross-review state.
