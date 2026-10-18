# Chessvy — Phase 1: Foundation

## Before building (your steps)
1. Connect your existing project: Settings → General → External Supabase → Connect.
2. Upload the Chessvy logo in chat.

Once connected, I first inspect existing tables, policies and triggers, and add only what is missing. Nothing gets dropped or overwritten.

## What Phase 1 delivers
- **Sign-in flow**: sign up, log in, forgot password, reset password, email-confirm callback, logout. Private pages are protected with no flicker.
- **App layout**: dark workspace, collapsible sidebar on desktop, hamburger menu on mobile. Pages: Dashboard, Review/Import, My Games, Settings (Insights shown later, not as a fake button).
- **Board**: legal moves only, drag-and-drop and tap-to-move, promotion picker, flip board, last-move highlight, red check effect, coordinates.
- **PGN import**: paste or upload a file; bad PGNs show a clear error.
- **Move list + navigation**: first/prev/next/last, click a move to jump, arrow-key shortcuts.
- **Real Stockfish review** (runs in the browser): evaluation bar, evaluation graph, best move per position, accuracy, and move classifications from measured eval loss.
- **Your icons**: Best, Excellent, Good, Inaccuracy, Mistake, Blunder, Great, Genius, Miss, plus win/draw/defeat result icons. Badge sits in the destination square's corner and moves inward on edges/corners and when flipped; the moved piece shifts down slightly.
- **Save and reopen** games and reviews; My Games list; Dashboard with real counts and recent reviews.
- **All text white**; hierarchy by size/weight only.

## Known gaps to flag
- **Book icon is missing** from the ZIP. I'll draw a matching original fallback; send a real one anytime.
- "Book" detection needs an opening database; Phase 1 uses a small openly-licensed opening list (ECO). 
- Deferred to later phases: Chess.com/Lichess import, sounds, board/piece themes, insights reports.

## Technical details
- chess.js (rules) + react-chessboard (board); Stockfish WASM in a Web Worker, depth-limited, results cached per review.
- Tables (only if absent): profiles, saved_games, game_reviews, analyzed_moves, user_settings — each with owner column, GRANTs, RLS (own rows only; owner can't be reassigned), cascading deletes, indexes on owner + created_at.
- Classification thresholds in one tunable module with unit tests (eval-loss bands, Genius/Great/Miss rules); badge-placement function with unit tests for edges, corners and flipped board.
- Icons uploaded as CDN assets; logo too once received.
