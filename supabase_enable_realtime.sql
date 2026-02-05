-- Enable Realtime on cash_requests table
-- This allows the application to receive real-time notifications when data changes

-- Enable publication for the cash_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE cash_requests;

-- Verify that realtime is enabled
-- You can check this in Supabase Dashboard > Database > Replication
