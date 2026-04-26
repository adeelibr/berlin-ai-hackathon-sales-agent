-- Defense-in-depth: realtime.messages has RLS enabled but no policies, which
-- blocks anon and grants authenticated nothing — except the app uses Realtime
-- only for postgres_changes, where Supabase enforces table RLS on the source
-- row before delivery (so other users' runs still cannot leak).
--
-- Add an explicit authenticated-only policy so behavior is documented and
-- broadcast/presence (if introduced later) is gated to logged-in users.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'authenticated_can_subscribe_realtime'
      AND polrelid = 'realtime.messages'::regclass
  ) THEN
    DROP POLICY "authenticated_can_subscribe_realtime" ON realtime.messages;
  END IF;
END $$;

CREATE POLICY "authenticated_can_subscribe_realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING ( (SELECT auth.uid()) IS NOT NULL );
