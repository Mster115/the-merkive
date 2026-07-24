insert into daily_puzzles (id, game_id, puzzle_date, status, payload, source_refs, fact_check, generated_by)
values
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'merk-mini',
    '2026-07-25',
    'draft',
    '{"clues": ["Sample clue 1"], "solution": "MERK"}',
    '[{"url": "https://example.com/ref1", "title": "Reference 1"}]',
    '{"status": "passed", "notes": "Automated verification clear"}',
    'pipeline'
  ),
  (
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'merk-grid',
    '2026-07-25',
    'draft',
    '{"grid": [[1,2],[3,4]]}',
    '[]',
    '{"status": "passed"}',
    'manual'
  );
