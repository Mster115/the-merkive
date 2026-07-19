-- Starter content packs for The Merkive games
insert into content_packs (id, game_id, title, locale, payload)
values (
  '11111111-1111-1111-1111-111111111111',
  'zaplash',
  'Starter Zaplash Pack',
  'en',
  '{"prompts": ["What is the real reason alien life hasn''t visited Earth?", "Describe a weird house rule for Monopoly."]}'::jsonb
) on conflict (id) do nothing;
