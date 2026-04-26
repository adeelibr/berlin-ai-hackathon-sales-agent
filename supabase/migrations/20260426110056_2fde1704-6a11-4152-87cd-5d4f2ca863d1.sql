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