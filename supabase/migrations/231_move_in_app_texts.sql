-- 231: "Text me the app link" on the move-in Done screen — cap texts per setup link.
alter table move_in_invites add column if not exists app_texts_sent integer not null default 0;
